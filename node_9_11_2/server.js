'use strict';
const debug = require('debug')('accounts:server');

const express = require('express');
const bodyParser = require('body-parser');
const AdmZip = require('adm-zip');
const sqlite3 = require('sqlite3').verbose();
const helper = require('./helper');

// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ALL = process.env.ALL || false;
// const PATH = process.env.DATA_PATH || './node_9_11_2/data.zip';
// const PATH = process.env.DATA_PATH || 'C:\\data.zip';
const PATH = process.env.DATA_PATH || './data.zip';
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
  app.use('*', dbmiddle);

  app.use(bodyParser.json());

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
    const log = debug.extend('filter');
    
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
              SELECT acc_id AS id
                FROM accounts_interest 
               WHERE interest IN (${vals})
               GROUP BY acc_id
            `;
            if (prop === "interests_contains") iSQL = `${iSQL} \n HAVING (count(*) >= ${cnt})`;
            break;   
          case 'likes_contains':
            valArr = val.split(',');
            cnt = valArr.length;
            vals = valArr.map(i => `'${i}'`).join(',');           
            lSQL = `
              SELECT acc_id AS id
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
              wheres.push(`${field} IS NULL`);
            } else { 
              wheres.push(`${field} IS NOT NULL`);
            }
          } else if (helper.FILTERED_SIMPLE_FIELDS.includes(field)) {
            // const val = q[prop];
            const op = helper.FILTER_OPERATIONS[oper];
            log(`${field} : ${oper} : ${op} : ${val}`);
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
      SELECT email, country, id, status, birth
        FROM accounts`;
    if (iSQL || lSQL) {
      if (iSQL !== "" && lSQL !== "") {
        sql = `
          WITH i AS (${iSQL}),
               l AS (${lSQL})
          ${sql} JOIN i USING(id) JOIN l USING(id)
      `;
      } else if (iSQL) {
        sql = `
          WITH i AS (${iSQL})
          ${sql} JOIN i USING(id)
        `;
      } else {
        sql = `
          WITH l AS (${lSQL})
          ${sql} JOIN l USING(id)
        `;       
      }
    }

    if (wheres.length) {
      sql = ` ${sql}
        WHERE  ${wheres.join('\n AND ')}`;
    }
    if (limit) sql = sql + `\n LIMIT ${limit}`;
    let rows = [];
    try {
      rows = await helper.func.selectAsync(req.db, sql);
    } catch(e) {
      console.log(`FILTER_ERROR: ${q.query_id}`);
    }
    // res.json({accounts: rows, wheres});
    res.json({accounts: rows});
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
    return res.status(201).json({});
    const log = debug.extend('new');
    log(req.body);
    const stmtAcc = DB.prepare(helper.SQL_INSERT_ACCOUNTS);
    const acc = req.body;
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
    stmtAcc.finalize();
    
    const stmtAccLikes = DB.prepare(helper.SQL_INSERT_ACCOUNTS_LIKE);
      // console.log(acc);
    if (acc.likes) {
      for (let j = 0, len = acc.likes.length; j < len; j++) {
        const like = acc.likes[j];
        stmtAccLikes.run([like.id, like.ts, acc.id]);
      }
    }
    stmtAccLikes.finalize();

    const stmtAccInts = DB.prepare(helper.SQL_INSERT_ACCOUNTS_INTEREST);
    // console.log(acc);
    if (acc.interests) {
      for (let j = 0, len = acc.interests.length; j < len; j++) {
        const interest = acc.interests[j];
        stmtAccInts.run([interest, acc.id]);
      }
    }
    stmtAccInts.finalize();
  
    res.status(201).json({});
  });

  app.post('/accounts/likes', async (req, res) => {
    res.status(202).json({});
  });

  app.post('/accounts/:id', async (req, res) => {
    return res.status(202).json({});
    const log = debug.extend('upd');
    log(req.params.id);
    log(req.body);
    
    let sql = 'UPDATE accounts SET \n';
    const fields = [];
    const params = [];
    const vals = req.body;
    if (vals.premium) {
      const premium = vals.premium;
      fields.push('premium  = ?', 'pstart  = ?', 'pfinish  = ?');
      params.push(1, premium.start, premium.finish);
      delete vals.premium;
    }
    for (let prop in vals) {
      if (vals.hasOwnProperty(prop)) {
        const val = vals[prop];
        
        
        if (helper.FILTERED_SIMPLE_FIELDS.includes(prop)) {
          fields.push(`${prop}  = ?`);
          params.push(val);
        }
      }
    }
    params.push(req.params.id);
    sql = sql + fields.join(',\n') + "\n WHERE id = ?";
    
    try {
      await helper.func.updateAsync(req.db, sql, params);
      return res.status(202).json({});
    } catch(e) {
      log(e);
      return res.status(404).json({});
    }
    
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
  console.log(`PATH=${PATH}`);
  // await sleep(1000);
  DB.serialize(function() {
    DB.run(helper.SQL_CREATE_ACCOUNTS);
    DB.run(helper.SQL_CREATE_ACCOUNTS_LIKE);
    // DB.run(helper.SQL_CREATE_ACCOUNTS_PREMIUM);
    DB.run(helper.SQL_CREATE_ACCOUNTS_INTEREST);
  });
  
  await helper.func.createIndexAsync(DB, 'birth');
  await helper.func.createIndexAsync(DB, 'city');
  await helper.func.createIndexAsync(DB, 'country');
  await helper.func.createIndexAsync(DB, 'premium');

  // await helper.func.execAsync(DB, helper.SQL_CREATE_INDEX_CITY);
  // await helper.func.execAsync(DB, helper.SQL_CREATE_INDEX_COUNTRY);
  // await helper.func.execAsync(DB, helper.SQL_CREATE_INDEX_PREMIUM);
  await helper.func.execAsync(DB, helper.SQL_CREATE_INDEX_LIKES);
  await helper.func.execAsync(DB, helper.SQL_CREATE_INDEX_INTERESTS);

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
        
        
        // DB.exec("ANALYZE");
      });
    }
  });

  // await helper.func.analyzeAsync(DB);
  // await helper.func.selectAsync()
  console.log(`Ended bootstrap...`);
  console.timeEnd('bootstrap');
}

function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms);
  });
}