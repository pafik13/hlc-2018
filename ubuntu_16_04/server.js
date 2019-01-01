'use strict';
const debug = require('debug')('accounts:server');

const express = require('express');
const bodyParser = require('body-parser');

const database = require('./mysql');
const helper = require('./helper');
const config = require('./config');

// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
let CURRENT_ID = 0;


const mysql = new database.mysql({
     mysql: {
        master: config.mysqlConn,
        replicas: [config.mysqlConn, config.mysqlConn],
      mysqlReplication: true
    },
});

// Defining middleware
function dbmiddle(req, res, next) {
  req.db = mysql;
  next();
}


(async() => {
  // App
  const app = express();
  
  // Using it in an app for all routes (you can replace * with any route you want)
  await mysql.connect();
  app.use('*', dbmiddle);

  app.use(bodyParser.json());

  app.get('/', (req, res) => {
    res.send('Hello world\n');
  });

  app.get('/premium', async (req, res) => {
    const sql = "SELECT * FROM accounts_premium LIMIT 3";
    const rows = await req.db.queryToMaster(sql);
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
    const rows = await req.db.queryToMaster(sql);
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

    const rows = await req.db.queryToMaster(sql);
    res.json(rows);
  });

  app.get('/accounts/filter', async (req, res) => {
    const now = new Date() / 1000;
    const log = debug.extend('filter');
    
    const fields = [];
    const wheres = [];
    let iSQL = '';
    let lSQL = '';
    let limit = false;
    let valArr = [];
    let cnt = 0;
    // res.json(req.query);
    const q = req.query;
    if (q.likes_contains) return res.status(200).json({accounts: []});
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        let vals = '';
        switch (prop) {
          case 'query_id':
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) return res.status(400).json([]);
            break;
          case 'email_domain':
            fields.push('email');
            wheres.push(`email LIKE '%@${val}'`);
            break;
          case 'fname_any':
            fields.push('fname');
            vals = val.split(',').map(i => `'${i}'`).join(',');
            wheres.push(`fname IN (${vals})`);
            break;
          case 'sname_starts':
            fields.push('sname');
            wheres.push(`sname LIKE '${val}%'`);
            break;
          case 'phone_code':
            fields.push('phone');
            wheres.push(`phone LIKE '8(${val})%'`);
            break;
          case 'city_any':
            fields.push('city');
            vals = val.split(',').map(i => `'${i}'`).join(',');
            wheres.push(`city IN (${vals})`);
            break;
          case 'birth_year':
            fields.push('birth');
            wheres.push(`birth BETWEEN UNIX_TIMESTAMP(date '${val}-01-01') 
              AND UNIX_TIMESTAMP(date '${Number(val) + 1}-01-01') - 1
            `);
            break;  
          case 'premium_now':
            fields.push('premium', 'pstart', 'pfinish');
            wheres.push(`${now} between pstart and pfinish`);
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
            return res.status(200).json({accounts: []});
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
            const isOn = Number(val);
            if (Number.isNaN(isOn)) return res.status(400).json([]); 
            if (isOn) { 
              wheres.push(`${field} IS NULL`);
            } else {
              if (field == 'premium') {
                fields.push('premium', 'pstart', 'pfinish');
              } else {
                fields.push(field);
              }
              wheres.push(`${field} IS NOT NULL`);
            }
          } else if (helper.FILTERED_SIMPLE_FIELDS.includes(field)) {
            if (val.indexOf(',') > -1) return res.status(400).json([]);
            // const val = q[prop];
            const op = helper.FILTER_OPERATIONS[oper];
            if (!op) return res.status(400).json([]);
            log(`${field} : ${oper} : ${op} : ${val}`);
            if (field == 'premium') {
              fields.push('premium', 'pstart', 'pfinish');
            } else {
              fields.push(field);
            }
            wheres.push(`${field} ${op} '${val}'`);
          } else {
            return res.status(400).json([]);
          }
          break;
        }
      }
    }
    // res.json(wheres);
    // console.log(wheres.join(" "));
    // email, country, id, status, birth
    let unique = [...new Set(fields)];
    if (!unique.includes('email')) {
      unique.push('email');
    }
    unique.push('id');
    let sql = `
      SELECT ${unique.join(',')}
        FROM accounts`;
    if (iSQL || lSQL) {
      if (iSQL !== "" && lSQL !== "") {
        sql = `
          ${sql} JOIN (${iSQL}) i USING(id) JOIN (${lSQL}) l USING(id)
      `;
      } else if (iSQL) {
        sql = `
          ${sql} JOIN (${iSQL}) i USING(id)
        `;
      } else {
        sql = `
          ${sql} JOIN (${lSQL}) l USING(id)
        `;       
      }
    }

    if (wheres.length) {
      sql = ` ${sql}
        WHERE  ${wheres.join('\n AND ')}`;
    }
    sql = ` ${sql}
        ORDER BY id DESC`;
    
    if (limit) sql = sql + `\n LIMIT ${limit}`;
    let rows = [];
    try {
      log(sql);
      rows = await req.db.queryToMaster(sql);
      if (unique.includes('premium')) {
        rows = rows.map((row) => {
          row.premium = {
            start: row.pstart,
            finish: row.pfinish
          };
          delete row.pstart;
          delete row.pfinish;
          return row;
        });
      }
    } catch(e) {
      console.log(`FILTER_ERROR: ${q.query_id}`);
      console.error(e);
    }
    // res.json({accounts: rows, wheres});
    res.json({accounts: rows});
  });

  app.get('/accounts/group', async (req, res) => {
    const log = debug.extend('group');
    
    const q = req.query;
    if (!q.keys) return res.status(400).json([]);
    if (q.likes) return res.status(200).json({groups: []});
    
    let hasInterests = false;
    const keys = q.keys.split(',');
    const check = keys.filter(k => {
      return !helper.GROUP_KEYS.includes(k);
    });
    
    if (check.length === 1) {
      if (check[0] === 'interests') {
        hasInterests = true;
        const index = keys.indexOf('interests');
        if (index !== -1) {
            keys.splice(index, 1);
        }
        keys.push('interest');
      }
    } else {
      if (check.length > 1) return res.status(400).json([]);
    }
    
    const wheres = [];
    let limit = 50;
    let order = 1;
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        switch (prop) {
          case 'keys':
            break;
          case 'query_id':
            break;
          case 'order':
            order = Number(val);
            if (![-1, 1].includes(order)) return res.status(400).json([]);
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) return res.status(400).json([]);
            break;
          case 'birth':
          case 'joined':
            wheres.push(`${prop} BETWEEN UNIX_TIMESTAMP(date '${val}-01-01') 
              AND UNIX_TIMESTAMP(date '${Number(val) + 1}-01-01') - 1
            `);
            break;
          case 'interests':
            hasInterests = true;
            wheres.push(`interest = '${val}'`);
            break;
          default:
            if (helper.GROUP_FILTER_FIELDS.includes(prop)) {
              wheres.push(`${prop} = '${val}'`);
            } else {
              return res.status(400).json([]);
            }
            break;
        }
      }
    }

    let sql = `
      SELECT ${keys.join(',')}, count(accounts.id) as count
        FROM accounts`;
    if (hasInterests) {
      sql = `${sql}
        JOIN accounts_interest
          ON accounts.id = accounts_interest.id`;
    }
    if (wheres.length) {
      sql = ` ${sql}
        WHERE  ${wheres.join('\n AND ')}`;
    }
    
    // let orderBy = '';
    // if (keys.length === 1) {
    //   orderBy = `${keys[0]} ${order === 1 ? ' ASC' : ' DESC'}`;
    // } else {
    //   orderBy = `${keys.join(order === 1 ? ' ASC,' : ' DESC, ')}`;
    // }
    
    const orderKeys = ['count'].concat(keys);
    
    sql = ` ${sql}
        GROUP BY ${keys.join(',')}
        ORDER BY ${orderKeys.join(order === 1 ? ' ASC,' : ' DESC, ')} ${order === 1 ? ' ASC' : ' DESC'}
        LIMIT ${limit}`;
        let rows = [];
    try {
      log(sql);
      rows = await req.db.queryToMaster(sql);
    } catch(e) {
      console.log(`GROUP_ERROR: ${q.query_id}`);
      console.error(e);
    }
    if (rows.length) {
      rows.forEach(row => {
        keys.forEach(k => {
          if (!row[k]) delete row[k];
        });
      });
    }
    res.json({groups: rows});
  });

  app.get('/accounts/:id/recommend', async (req, res) => {
    res.json({"accounts": []});
  });

  app.get('/accounts/:id/suggest', async (req, res) => {
    res.json({"accounts": []});
  });

  app.post('/accounts/new', async (req, res) => {
    // return res.status(201).json({});
    const log = debug.extend('new');
    log(req.body);
    // const stmtAcc = DB.prepare(helper.SQL_INSERT_ACCOUNTS);
    const acc = req.body;
    let rows = [];
    if (acc.email) {
      rows = await mysql.queryToMaster(`SELECT id FROM accounts WHERE email = '${acc.email}';`);
      if (rows.length) return res.status(400).json({});
    }

    let params = [];
    const likes = [];
    const interests = [];
    ++CURRENT_ID;
    acc.id = CURRENT_ID;
    if (acc.premium) {
      params = [
        acc.id, acc.email, acc.fname, acc.sname, acc.status, 
        acc.country, acc.city, acc.phone, acc.sex, acc.joined,
        acc.birth, 1, acc.premium.start, acc.premium.finish
      ];
    } else {
      params = [
        acc.id, acc.email, acc.fname, acc.sname, acc.status, 
        acc.country, acc.city, acc.phone, acc.sex, acc.joined,
        acc.birth, null, null, null
      ];            
    }
    await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNT, params);
    
    if (acc.interests) {
      acc.interests.forEach((interest) => interests.push([interest, acc.id]));
    }
    
    if (acc.likes) {
      acc.likes.map((like) => likes.push([like.id, like.ts, acc.id]));
    }

    try {
      await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS_LIKE, [likes]);
      await mysql.queryToReplica(helper.SQL_INSERT_ACCOUNTS_INTEREST, [interests]);
      // await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNT, params);
      return res.status(201).json({});
    } catch(err) {
      console.error(err);
      return res.status(400).json({});
    }

    // // console.log(acc);
    // if (acc.premium) {
    //   stmtAcc.run([
    //     acc.id, acc.email, acc.fname, acc.sname, acc.status, 
    //     acc.country, acc.city, acc.phone, acc.sex, acc.joined,
    //     acc.birth, 1, acc.premium.start, acc.premium.finish
    //   ]);
    // } else {
    //   stmtAcc.run([
    //     acc.id, acc.email, acc.fname, acc.sname, acc.status, 
    //     acc.country, acc.city, acc.phone, acc.sex, acc.joined,
    //     acc.birth, null, null, null
    //   ]);            
    // }
    // stmtAcc.finalize();
    
    // const stmtAccLikes = DB.prepare(helper.SQL_INSERT_ACCOUNTS_LIKE);
    //   // console.log(acc);
    // if (acc.likes) {
    //   for (let j = 0, len = acc.likes.length; j < len; j++) {
    //     const like = acc.likes[j];
    //     stmtAccLikes.run([like.id, like.ts, acc.id]);
    //   }
    // }
    // stmtAccLikes.finalize();

    // const stmtAccInts = DB.prepare(helper.SQL_INSERT_ACCOUNTS_INTEREST);
    // // console.log(acc);
    // if (acc.interests) {
    //   for (let j = 0, len = acc.interests.length; j < len; j++) {
    //     const interest = acc.interests[j];
    //     stmtAccInts.run([interest, acc.id]);
    //   }
    // }
    // stmtAccInts.finalize();
  
    
  });

  app.post('/accounts/likes', async (req, res) => {
    res.status(202).json({});
  });

  app.post('/accounts/:id', async (req, res) => {
    return res.status(202).json({});
    // const log = debug.extend('upd');
    // log(req.params.id);
    // log(req.body);
    
    // let sql = 'UPDATE accounts SET \n';
    // const fields = [];
    // const params = [];
    // const vals = req.body;
    // if (vals.premium) {
    //   const premium = vals.premium;
    //   fields.push('premium  = ?', 'pstart  = ?', 'pfinish  = ?');
    //   params.push(1, premium.start, premium.finish);
    //   delete vals.premium;
    // }
    // for (let prop in vals) {
    //   if (vals.hasOwnProperty(prop)) {
    //     const val = vals[prop];
        
        
    //     if (helper.FILTERED_SIMPLE_FIELDS.includes(prop)) {
    //       fields.push(`${prop}  = ?`);
    //       params.push(val);
    //     }
    //   }
    // }
    // params.push(req.params.id);
    // sql = sql + fields.join(',\n') + "\n WHERE id = ?";
    
    // try {
    //   await helper.func.updateAsync(req.db, sql, params);
    //   return res.status(202).json({});
    // } catch(e) {
    //   log(e);
    //   return res.status(404).json({});
    // }
    
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
  const rows = await mysql.queryToMaster('SELECT max(id) as max_id FROM accounts;');
  CURRENT_ID = rows[0].max_id;
  return;
}

function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms);
  });
}