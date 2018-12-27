'use strict';

const express = require('express');
const AdmZip = require('adm-zip');
const sqlite3 = require('sqlite3').verbose();
const helper = require('./helper');

// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ALL = process.env.ALL || false;
// const PATH = process.env.DATA_PATH || './node_9_11_2/data.zip';
const PATH = process.env.DATA_PATH || 'C:\\data.zip';
const RE_FILENAME = new RegExp('account(.)+json');
const DB = new sqlite3.Database(':memory:');
DB.on('error', console.error);

// Defining middleware
function dbmiddle(req, res, next) {
  req.db = DB;
  next();
}


(async() => {
  // App
  const app = express();
  
  // Using it in an app for all routes (you can replace * with any route you want)
  app.use('*', dbmiddle)

  app.get('/', (req, res) => {
    res.send('Hello world\n');
  });

  app.get('/premium', async (req, res) => {
    const sql = "SELECT * FROM accounts_premium LIMIT 3";
    const rows = await helper.func.selectAsync(req.db, sql);
    // const rows = [];
    // req.db.each("SELECT * FROM accounts_premium LIMIT 3", (err, row) => {
    //   if (err) {
    //     res.json({err});
    //   } else {
    //     rows.push(row);
    //   }
    // }, (err, cnt) => {
    //   if (err) {
    //     res.json({err});
    //   } else {
    //     res.json(rows);
    //   }
    // });
    res.json(rows);
  });

  
  app.get('/premium_all', async (req, res) => {
    const sql = `
      SELECT ap.*, datetime(ap.finish, 'unixepoch') as dt
           , case when date('now') between datetime(ap.start, 'unixepoch') and datetime(ap.finish, 'unixepoch') then 1 else 2 end as b
           , strftime('%s', date('1990-01-01 00:00:00')) as s
        FROM accounts_premium ap
       WHERE strftime('%s', 'now') between ap.start and ap.finish
    `;
    const rows = await helper.func.selectAsync(req.db, sql);
    res.json(rows);
  });

  app.get('/interests', async (req, res) => {
    const q = req.query;
    let sql = "SELECT * FROM accounts_interest LIMIT 30";
    if (q.interests_constains) {
      const vals = q["interests_constains"].split(',').map(i => `'${i}'`).join(',');
      sql = `
      WITH agg AS (SELECT acc_id, count(*) 
        FROM accounts_interest
       WHERE interest IN (${vals})
       GROUP BY acc_id
       HAVING (count(*) > 0)) 
      SELECT * FROM agg`;
    }

    const rows = await helper.func.selectAsync(req.db, sql);
    res.json(rows);
  });

  app.get('/accounts/filter', async (req, res) => {
    const wheres = [];
    let iSQL = '';
    let lSQL = '';
    let limit = false;
    let valArr = [];
    let cnt = 0;
    // res.json(req.query);
    const q = req.query;
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        let vals = '';
        switch (prop) {
          case 'limit':
            limit = val;
            break;
          case 'email_domain':
            wheres.push(`email LIKE '%@${val}'`);
            break;
          case 'fname_any':
            vals = val.split(',').map(i => `'${i}'`).join(',');
            wheres.push(`fname IN (${vals})`);
            break;
          case 'sname_starts':
            wheres.push(`sname LIKE '${val}%'`);
            break;
          case 'phone_code':
            wheres.push(`phone LIKE '8(${val})%'`);
            break;
          case 'city_any':
            vals = val.split(',').map(i => `'${i}'`).join(',');
            wheres.push(`city IN (${vals})`);
            break;
          case 'birth_year':
            wheres.push(`birth BETWEEN strftime('%s', date('${val}-01-01')) 
              AND strftime('%s', datetime('${Number(val) + 1}-01-01')) - 1
            `);
            break;  
          case 'premium_now':
            wheres.push(`strftime('%s', 'now') between pstart and pfinish`);
            break;
          case 'interests_any':
          case 'interests_contains':
            valArr = val.split(',');
            cnt = valArr.length;
            vals = valArr.map(i => `'${i}'`).join(',');           
            iSQL = `
              SELECT acc_id AS ext_id
                FROM accounts_interest 
               WHERE interest IN (${vals})
               GROUP BY acc_id
            `;
            if (prop === "interests_contains") iSQL = `${iSQL} \n HAVING (count(*) >= ${cnt})`
            break;   
          case 'likes_contains':
            valArr = val.split(',');
            cnt = valArr.length;
            vals = valArr.map(i => `'${i}'`).join(',');           
            lSQL = `
              SELECT acc_id AS ext_id
                FROM accounts_like 
               WHERE like_id IN (${vals})
               GROUP BY acc_id
              HAVING (count(*) >= ${cnt})
            `;
            break;             
        default:
          const arr = prop.split('_');
          const field = arr[0];
          const oper = arr[1];
          if (oper === 'null') {
            if (Number(val)) { 
              wheres.push(`${field} IS NULL`)
            } else { 
              wheres.push(`${field} IS NOT NULL`)
            }
          } else if (helper.FILTERED_SIMPLE_FIELDS.includes(field)) {
            // const val = q[prop];
            const op = helper.FILTER_OPERATIONS[oper];
            console.log(`${field} : ${oper} : ${op} : ${val}`);
            wheres.push(`${field} ${op} '${val}'`);
          }
          break;
        }
      }
    }
    // res.json(wheres);
    // console.log(wheres.join(" "));
    // email, country, id, status, birth
    let sql = `
      SELECT *
        FROM accounts`;
    if (iSQL || lSQL) {
      if (iSQL !== "" && lSQL !== "") {
        sql = `
          WITH i AS (${iSQL}),
               l AS (${lSQL})
          ${sql} JOIN i USING(ext_id) JOIN l USING(ext_id)
      `;
      } else if (iSQL) {
        sql = `
          WITH i AS (${iSQL})
          ${sql} JOIN i USING(ext_id)
        `;
      } else {
        sql = `
          WITH l AS (${lSQL})
          ${sql} JOIN l USING(ext_id)
        `;       
      }
    }

    if (wheres.length) {
      sql = ` ${sql}
        WHERE  ${wheres.join('\n AND ')}`;
    }
    if (limit) sql = sql + `\n LIMIT ${limit}`;
    const rows = await helper.func.selectAsync(req.db, sql);
    res.json({accounts: rows, wheres});
  });

  app.get('/accounts/group', async (req, res) => {
    res.json({"groups": []});
  });

  app.get('/accounts/:id/recommend', async (req, res) => {
    res.json({"accounts": []});
  });

  app.get('/accounts/:id/suggest', async (req, res) => {
    res.json({"accounts": []});
  });

  app.post('/accounts/new', async (req, res) => {
    res.json(201, {});
  });

  app.post('/accounts/likes', async (req, res) => {
    res.json(202, {});
  });

  app.post('/accounts/:id', async (req, res) => {
    res.json(202, {});
  });


  try {
    await bootstrap();
  } catch(err) {
    console.error(err);
  }
  
  app.listen(PORT, HOST);
  console.log(`Running on http://${HOST}:${PORT}`);
})();

async function bootstrap() {
  console.time('bootstrap');
  console.log(`Starting bootstrap...`);
  console.log(`PATH=${PATH}`)
  // await sleep(1000);
  DB.serialize(function() {
    DB.run(helper.SQL_CREATE_ACCOUNTS);
    DB.run(helper.SQL_CREATE_ACCOUNTS_LIKE);
    DB.run(helper.SQL_CREATE_ACCOUNTS_PREMIUM);
    DB.run(helper.SQL_CREATE_ACCOUNTS_INTEREST);
  });

  const zip = new AdmZip(PATH);
  const entries = zip.getEntries();
  entries.forEach((i) => {
    if (RE_FILENAME.test(i.entryName)) {
      console.log(i.entryName);
      // console.log(i.getData().toString('utf8'));
      // console.log(JSON.parse(i.getData().toString('utf8')));
      const data = JSON.parse(i.getData().toString('utf8'));
      console.log(Array.isArray(data.accounts));
      DB.serialize(function() {      
        const lenAccs = ALL ? data.accounts.length : 100;
        console.log(lenAccs);
        const stmtAcc = DB.prepare(helper.SQL_INSERT_ACCOUNTS);
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          // console.log(acc);
          if (acc.premium) {
            stmtAcc.run([
              acc.id, acc.email, acc.fname, acc.sname, acc.status, 
              acc.country, acc.city, acc.phone, acc.sex, acc.joined,
              acc.birth, 1, acc.premium.start, acc.premium.finish
            ]);
          } else {
            stmtAcc.run([
              acc.id, acc.email, acc.fname, acc.sname, acc.status, 
              acc.country, acc.city, acc.phone, acc.sex, acc.joined,
              acc.birth, null, null, null
            ]);            
          }
        }
        stmtAcc.finalize();
      
        const stmtAccLikes = DB.prepare(helper.SQL_INSERT_ACCOUNTS_LIKE);
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          // console.log(acc);
          if (acc.likes) {
            for (let j = 0, len = acc.likes.length; j < len; j++) {
              const like = acc.likes[j];
              stmtAccLikes.run([like.id, like.ts, acc.id]);
            }
          }
        }
        stmtAccLikes.finalize();

        const stmtAccPrem = DB.prepare(helper.SQL_INSERT_ACCOUNTS_PREMIUM);
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          const premium = acc.premium;
          // console.log(acc);
          if (premium) stmtAccPrem.run([premium.start, premium.finish, acc.id]);
        }
        stmtAccPrem.finalize();

        const stmtAccInts = DB.prepare(helper.SQL_INSERT_ACCOUNTS_INTEREST);
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          // console.log(acc);
          if (acc.interests) {
            for (let j = 0, len = acc.interests.length; j < len; j++) {
              const interest = acc.interests[j];
              stmtAccInts.run([interest, acc.id]);
            }
          }
        }
        stmtAccInts.finalize();
        
        DB.run("ANALYZE");
      });
    }
  });
  console.log(`Ended bootstrap...`);
  console.timeEnd('bootstrap');
}

function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms);
  })
}