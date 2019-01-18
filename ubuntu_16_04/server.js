'use strict';
const debug = require('debug')('accounts:server');

const express = require('express');
const bodyParser = require('body-parser');

const database = require('./mysql');
const helper = require('./helper');
const config = require('./config');
const monet = require('./monet.js');

// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
let MAX_ID = 0;
const STATUSES = {
  "свободны": 1,
  "заняты": 2,
  "всё сложно": 3
};
const SEX = {
  "m": 1,
  "f": 0
};

const INTERESTS = {};
const COUNTRIES = {};
const CITIES = {};
const FNAMES = {};
const SNAMES = {};

let INSERTS = 0;
let UPDATES = 0;
let LIKES = 0;

const mysql = new database.mysql({
     mysql: {
        master: config.mysqlConn,
        // replicas: [config.mysqlConn, config.mysqlConn],
        replicas: Array(10).fill(config.mysqlConn),
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
    const log = debug.extend('interests');
    
    const q = req.query;
    let sql = "SELECT * FROM accounts_interest LIMIT 30";
    if (q.interests_constains) {
      const vals = q["interests_constains"].split(',').map(i => INTERESTS[i]).join(',');
      sql = `
      SELECT acc_id, count(*) 
        FROM accounts_interest
       WHERE interest IN (${vals})
       GROUP BY acc_id
       HAVING (count(*) > 0) `;
    }
    
    log(sql);
    const rows = await req.db.queryToMaster(sql);
    res.json(rows);
  });

  app.get('/suggest', async (req, res) => {
    const log = debug.extend('suggest_test');
    
    const q = req.query;
    log(q);
    if (!q.id) return res.status(400).json([]);
    
    let sql = false;
    let limit = 100;
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        switch (prop) {
          case 'id':
          case 'query_id':
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) return res.status(400).json([]);
            if (limit < 1) return res.status(400).json([]);
            break;
          case 'city':
          case 'country':
            if (!val) return res.status(400).json([]);
            switch (prop) {
              case 'city':
                sql = `select * from similarity_in_city(${q.id}, ${CITIES[val]})`; break;
              case 'country':
                sql = `select * from similarity_in_ctry(${q.id}, ${COUNTRIES[val]})`; break;
            }
            break;
          default:
            return res.status(400).json([]);
        }
      }
    }
    if (!sql) return res.json({"accounts": []});
    sql = `${sql} limit ${limit};`;
    log(sql);
    let rows = await monet.queryAsync(sql);
    log(rows.data);
    return res.json({"accounts": rows});
  });
  
  app.get('/likes', async (req, res) => {
    const log = debug.extend('likes');
    
    const q = req.query;
    log(q);
    if (!q.id) return res.status(400).json([]);
    
    let sql = false;
    let limit = 100;
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        switch (prop) {
          case 'id':
          case 'query_id':
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) return res.status(400).json([]);
            if (limit < 1) return res.status(400).json([]);
            break;
          default:
            return res.status(400).json([]);
        }
      }
    }
    
    sql = `SELECT * FROM likes WHERE liker = ${q.id} limit ${limit};`;
    log(sql);
    let rows = await monet.queryAsync(sql);
    log(rows.data);
    return res.json(rows);
  });


  app.get('/accounts/filter', async (req, res) => {
    const label = `filter_parse_${req.query.query_id}`;
    /* console.time(label); */
    // const now = new Date() / 1000;
    const now = 1546083844;
    const log = debug.extend('filter');
    
    if (UPDATES || INSERTS) {
      UPDATES = 0;
      INSERTS = 0;
      // const label = 'UPSERT_COMMIT_' + req.query.query_id;
      // console.time(label);
      await req.db.queryToMaster('COMMIT;');
      // console.timeEnd(label);
    }

    const fields = new Set();
    const wheres = [];
    let iSQL = '';
    let lSQL = '';
    let limit = false;
    let valArr = [];
    let cnt = 0;
    // res.json(req.query);
    const q = req.query;
    // if (q.likes_contains) { /* console.timeEnd(label); */ return res.status(200).json({accounts: []}); }
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        let vals = '';
        switch (prop) {
          case 'city_gt':
          case 'city_lt':
          case 'country_gt':
          case 'country_lt':
          case 'country_neq':
          case 'sname_lt':
            /* console.timeEnd(label); */ 
            return res.status(400).json([]);
          case 'query_id':
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) { /* console.timeEnd(label); */ return res.status(400).json([]); }
            break;
          case 'email_domain':
            fields.add('email');
            wheres.push(`email LIKE '%@${val}'`);
            break;
          case 'fname_any':
            fields.add('fname');
            vals = val.split(',').map(f => FNAMES[f]).join(',');
            wheres.push(`fname IN (${vals})`);
            break;
          case 'sname_starts':
            fields.add('sname');
            vals = Object.keys(SNAMES).filter(k => k.startsWith(val)).map(s => SNAMES[s]).join(',');
            wheres.push(`sname IN (${vals})`);
            break;
          case 'phone_code':
            fields.add('phone');
            wheres.push(`phone LIKE '8(${val})%'`);
            break;
          case 'city_any':
            fields.add('city');
            let errors = false;
            vals = val.split(',').map(c => {
              const city = CITIES[c];
              if (city) {
                return city;
              } else {
                errors = true;
                return city;
              }
            }).join(',');
            if (errors) { /* console.timeEnd(label); */ return res.status(400).json([]); }
            wheres.push(`city IN (${vals})`);
            break;
          case 'birth_year':
            fields.add('birth');
            wheres.push(`birth BETWEEN UNIX_TIMESTAMP(date '${val}-01-01') 
              AND UNIX_TIMESTAMP(date '${Number(val) + 1}-01-01') - 1
            `);
            break;  
          case 'premium_now':
            /* console.timeEnd(label); */ 
            // return res.status(200).json({accounts: []});
            fields.add('premium');
            fields.add('pstart');
            fields.add('pfinish');
            wheres.push(`${now} between pstart and pfinish`);
            break;
          case 'interests_any':
          case 'interests_contains':
            valArr = val.split(',');
            cnt = valArr.length;
            vals = valArr.map(i => INTERESTS[i]).join(',');           
            iSQL = `
              SELECT acc_id AS id
                FROM accounts_interest 
               WHERE interest IN (${vals})
               GROUP BY acc_id
            `;
            if (prop === "interests_contains") iSQL = `${iSQL} \n HAVING (count(*) >= ${cnt})`;
            break;   
          case 'likes_contains':
            const lbl = label + ':likes_contains';
            // console.time(lbl);
            /* console.timeEnd(label); */ 
            // return res.status(200).json({accounts: []});
            valArr = val.split(',');
            cnt = valArr.length;
            if (!cnt) res.status(400).json([]);
            
            vals = valArr.join(',');
            if (cnt === 1) {
              lSQL = `
                SELECT liker
                  FROM likes 
                 WHERE likee = ${vals}
                 LIMIT ${limit * 3 || 100};
              `;            
            } else {
              lSQL = `
                SELECT liker
                  FROM likes 
                 WHERE likee IN (${vals})
                 GROUP BY liker
                HAVING (count(likee) >= ${cnt})
                LIMIT ${limit * 3 || 100};
              `;              
            }
            try {
              log(lSQL);
              const likers = await monet.queryAsync(lSQL);
              if (!likers.data.length) return res.status(200).json({accounts: []});
              
              const ids = likers.data.map(l => l[0]).join(',');
              wheres.push(`id IN (${ids})`);
            } catch(e) {
              // console.timeEnd(lbl);
              console.error(e);
              return res.status(500).json([]);
            }
            
            // console.timeEnd(lbl);
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
                fields.add('premium');
                fields.add('pstart');
                fields.add('pfinish');
              } else {
                fields.add(field);
              }
              wheres.push(`${field} IS NOT NULL`);
            }
          } else if (helper.FILTERED_SIMPLE_FIELDS.includes(field)) {
            if (val.indexOf(',') > -1) { /* console.timeEnd(label); */ return res.status(400).json([]); }
            // const val = q[prop];
            const op = helper.FILTER_OPERATIONS[oper];
            if (!op) { /* console.timeEnd(label); */ return res.status(400).json([]); }
            log(`${field} : ${oper} : ${op} : ${val}`);
            if (field == 'premium') {
              fields.add('premium');
              fields.add('pstart');
              fields.add('pfinish');
            } else {
              fields.add(field);
            }
            
            let ref_val = true;
            switch (field) {
              case 'sex':
                ref_val = SEX[val];
                break;
              case 'status':
                ref_val = STATUSES[val];
                break;      
              case 'fname':
                ref_val = FNAMES[val];
                break;  
              case 'sname':
                ref_val = SNAMES[val];
                break;   
              case 'country':
                ref_val = COUNTRIES[val];
                break;    
              case 'city':
                ref_val = CITIES[val];
                break;  
              default:
                wheres.push(`${field} ${op} '${val}'`);
                break;
            }
            if (Number.isInteger(ref_val)) {
              wheres.push(`${field} ${op} ${ref_val}`);
            } else if (!ref_val) {
              /* console.timeEnd(label); */ 
              return res.status(400).json([]);
            }
          } else { 
            /* console.timeEnd(label); */ 
            return res.status(400).json([]);
          }
          break;
        }
      }
    }
    
    fields.add('email');
    fields.add('id');
    let unique = [...fields];
    for(let f = 0, len = unique.length; f < len; f++) {
      const col = unique[f];
      switch (col) {
        case 'sex':
          unique[f] = "IF(sex = 1,'m','f') as sex";
          break;
        case 'status':
          unique[f] = "(SELECT status.name FROM status WHERE status.id = status) as status";
          break;     
        case 'fname':
          unique[f] = "(SELECT fname.name FROM fname WHERE fname.id = fname) as fname";
          break;  
        case 'sname':
          unique[f] = "(SELECT sname.name FROM sname WHERE sname.id = sname) as sname";
          break;   
        case 'country':
          unique[f] = "(SELECT country.name FROM country WHERE country.id = country) as country";
          break;    
        case 'city':
          unique[f] = "(SELECT city.name FROM city WHERE city.id = city) as city";
          break;  
        default:
          break;
      }
    }

    let sql = `
      SELECT ${unique.join(',')}
        FROM accounts`;
    if (iSQL) {
      sql = `
        ${sql} JOIN (${iSQL}) i USING(id)
      `;
    }

    if (wheres.length) {
      sql = ` ${sql}
        WHERE  ${wheres.join('\n AND ')}`;
    }
    sql = ` ${sql}
        ORDER BY id DESC`;
    
    if (limit) sql = sql + `\n LIMIT ${limit}`;
    let rows = [];
    const label2 = label + ':exec';
    try {
      log(sql);
      /* console.timeEnd(label); */
      // console.time(label2);
      rows = await req.db.queryToReplica(sql);
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
      /* console.timeEnd(label2); */
      console.log(`FILTER_ERROR: ${req.url}`);
      // console.error(e);
      return res.status(500).json({e});
    }
    // res.json({accounts: rows, wheres});
    /* console.timeEnd(label2); */
    const label3 = label + ':resp';
    // console.time(label3);
    res.json({accounts: rows});
    /* console.timeEnd(label3); */
  });

  app.get('/accounts/group', async (req, res) => {
    const label = `group_parse_${req.query.query_id}`;
    // console.time(label); 
    const log = debug.extend('group');

    const F_SEL = {
      'sex': "IF(sex = 1,'m','f') as sex",
      'status': "(SELECT status.name FROM status WHERE status.id = status) as status",
      'fname': "(SELECT fname.name FROM fname WHERE fname.id = fname) as fname",  
      'sname':"(SELECT sname.name FROM sname WHERE sname.id = sname) as sname",
      'country': "(SELECT country.name FROM country WHERE country.id = country) as country",
      'city': "(SELECT city.name FROM city WHERE city.id = city) as city",
      'interest': '(SELECT interest.name FROM interest WHERE interest.id = accounts_interest.interest) as interests',
    };

    if (UPDATES || INSERTS) {
      UPDATES = 0;
      INSERTS = 0;
      // const label = 'UPSERT_COMMIT_' + req.query.query_id;
      // console.time(label);
      await req.db.queryToMaster('COMMIT;');
      // console.timeEnd(label);
    }

    const q = req.query;
    if (!q.keys) { /* console.timeEnd(label); */ return res.status(400).json([]); }
    
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
      } else {
        /* console.timeEnd(label); */ 
        return res.status(400).json([]);
      }
    } else {
      if (check.length > 1) { /* console.timeEnd(label); */ return res.status(400).json([]); }
    }
    
    // if (q.likes) { /* console.timeEnd(label); */ return res.status(200).json({groups: []});}

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
            if (![-1, 1].includes(order)) { /* console.timeEnd(label); */ return res.status(400).json([]); }
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) { /* console.timeEnd(label); */ return res.status(400).json([]); }
            break;
          case 'birth':
          case 'joined':
            wheres.push(`${prop} BETWEEN UNIX_TIMESTAMP(date '${val}-01-01') 
              AND UNIX_TIMESTAMP(date '${Number(val) + 1}-01-01') - 1
            `);
            break;
          case 'interests':
            hasInterests = true;
            wheres.push(`interest = ${INTERESTS[val]}`);
            break;
          case 'likes': 
            // const lbl = label + ':likes';
            // console.time(lbl);
          
            const lSQL = `
              SELECT liker
                FROM likes 
               WHERE likee = ${val};`;            
            try {
              log(lSQL);
              const likers = await monet.queryAsync(lSQL);
              if (!likers.data.length) return res.status(200).json({groups: []});
              
              const ids = likers.data.map(l => l[0]).join(',');
              wheres.push(`id IN (${ids})`);
            } catch(e) {
              // console.timeEnd(lbl);
              console.error(e);
              return res.status(500).json([]);
            }
            
            // console.timeEnd(lbl);
            break;    
          default:
            if (helper.GROUP_FILTER_FIELDS.includes(prop)) {
              switch (prop) {
                case 'sex':
                  wheres.push(`${prop} = '${SEX[val]}'`); break;
                case 'status':
                  wheres.push(`${prop} = '${STATUSES[val]}'`); break;
                case 'city':
                  wheres.push(`${prop} = '${CITIES[val]}'`); break;
                case 'country':
                  wheres.push(`${prop} = '${COUNTRIES[val]}'`); break;
                case 'fname':
                  wheres.push(`${prop} = '${FNAMES[val]}'`); break;
                case 'sname':
                  wheres.push(`${prop} = '${SNAMES[val]}'`); break;
                default:
                  wheres.push(`${prop} = '${val}'`);
              }
            } else {
              /* console.timeEnd(label); */ 
              return res.status(400).json([]);
            }
            break;
        }
      }
    }
    const fields = keys.map(k => F_SEL[k]);
    let sql = `
      SELECT ${fields.join(',')}, count(accounts.id) as count
        FROM accounts`;
    if (hasInterests) {
      // sql = sql.replace('interest', );
      sql = `${sql}
        JOIN accounts_interest
          ON accounts.id = accounts_interest.acc_id`;
    }
    if (wheres.length) {
      sql = ` ${sql}
        WHERE  ${wheres.join('\n AND ')}`;
    }
    
    const orderKeys = ['count'].concat(keys.map(k => k === 'interest' ? 'interests' : k));
    sql = ` ${sql}
        GROUP BY ${keys.join(',')}
        ORDER BY ${orderKeys.join(order === 1 ? ' ASC,' : ' DESC, ')} ${order === 1 ? ' ASC' : ' DESC'}
        LIMIT ${limit}`;
        let rows = [];
    try {
      log(sql);
      /* console.timeEnd(label); */ 
      rows = await req.db.queryToReplica(sql);
    } catch(e) {
      console.log(`GROUP_ERROR: ${req.url}`);
      // console.error(e);
      return res.status(500).json({e});
    }
    if (rows.length) {
      const rl = rows.length;
      for(let r = 0; r < rl; r++){
        const row = rows[r];
        const kl = keys.length;
        for(let k = 0; k < kl; k++){
          const key = keys[k];
          const val = row[key]
          if (!val) {
            delete row[key];
          } 
          // else {
          //   switch (key) {
          //     case 'city':
          //       row[key] = CITIES[val]; break;
          //     case 'country':
          //       row[key] = COUNTRIES[val]; break;
          //     case 'fname':
          //       row[key] = FNAMES[val]; break;
          //     case 'sname':
          //       row[key] = SNAMES[val]; break;
          //   }
          // }
        }
      }
    }
    res.json({groups: rows});
  });

  app.get('/accounts/:id/recommend', async (req, res) => {
    const log = debug.extend('recommend');

    if (UPDATES || INSERTS) {
      UPDATES = 0;
      INSERTS = 0;
      // const label = 'UPSERT_COMMIT_' + req.query.query_id;
      // console.time(label);
      await req.db.queryToMaster('COMMIT;');
      // console.timeEnd(label);
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({});
    if (id > MAX_ID) return res.status(404).json({});
    
    const wheres = [];
    let limit = 20;
    const q = req.query;
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        switch (prop) {
          case 'query_id':
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) return res.status(400).json([]);
            if (limit < 1) return res.status(400).json([]);
            break;
          case 'city':
          case 'country':
           if (!val) return res.status(400).json([]);
            switch (prop) {
              case 'city':
                wheres.push(`${prop} = '${CITIES[val]}'`); break;
              case 'country':
                wheres.push(`${prop} = '${COUNTRIES[val]}'`); break;
            }
            if (!val) return res.status(400).json([]);
            break;
          default:
            return res.status(400).json([]);
        }
      }
    }
    // return res.json({"accounts": []});

    wheres.push(`acc.sex != (select sex from accounts where id = ${id})`);
    wheres.push(`acc_i.interest in (select interest from accounts_interest where acc_id = ${id})`);
    wheres.push(`acc_id != ${id}`);
    let sql = `
      SELECT id, email
           , (SELECT status.name FROM status WHERE status.id = status) as status
           , (SELECT fname.name FROM fname WHERE fname.id = fname) as fname
           , (SELECT sname.name FROM sname WHERE sname.id = sname) as sname
           , birth, premium, pstart, pfinish
           , case status when 1 then 1000 when 3 then 2000 when 2 then 3000 end as s_ind
           , i.cnt
           , (select abs(accounts.birth - a.birth) from accounts a where a.id = ${id}) as b_diff
        FROM accounts
        JOIN (
          SELECT acc_id, count(acc_id) as cnt
            FROM accounts_interest acc_i
            JOIN accounts acc ON acc.id = acc_i.acc_id
           WHERE ${wheres.join('\n AND ')}
           GROUP 
              BY  acc_id
            ) i
          ON accounts.id = i.acc_id
       ORDER BY s_ind, b_diff
       LIMIT ${limit}`;

    let rows = [];
    try {
      log(sql);
      rows = await req.db.queryToReplica(sql);
    } catch(e) {
      console.log(`RECOMMEND_ERROR: ${q.query_id}`);
      console.error(e);
      return res.status(500).json({e});
    }
    if (rows.length) {
      rows.forEach(row => {
        if (!row.premium) {
          delete row.premium;
        } else {
          row.premium = {
            start: row.pstart,
            finish: row.pfinish
          };
        }
        delete row.pstart;
        delete row.pfinish;
        delete row.s_ind;
        delete row.cnt;
        delete row.b_diff;
        return row;
      });
    }
    // res.json({groups: rows});
    
    res.json({"accounts": rows});
  });

  app.get('/accounts/:id/suggest', async (req, res) => {
    const log = debug.extend('suggest');

    if (UPDATES || INSERTS) {
      UPDATES = 0;
      INSERTS = 0;
      // const label = 'UPSERT_COMMIT_' + req.query.query_id;
      // console.time(label);
      await req.db.queryToMaster('COMMIT;');
      // console.timeEnd(label);
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({});
    if (id > MAX_ID) return res.status(404).json({});
    
    let sql = false;
    let limit = 20;
    const q = req.query;
    for (let prop in q) {
      if (q.hasOwnProperty(prop)) {
        const val = q[prop];
        switch (prop) {
          case 'query_id':
            break;
          case 'limit':
            limit = Number(val);
            if (!Number.isInteger(limit)) return res.status(400).json([]);
            if (limit < 1) return res.status(400).json([]);
            break;
          case 'city':
          case 'country':
            if (!val) return res.status(400).json([]);
            switch (prop) {
              case 'city':
                sql = `select * from similarity_in_city(${id}, ${CITIES[val]})`; break;
              case 'country':
                sql = `select * from similarity_in_ctry(${id}, ${COUNTRIES[val]})`; break;
            }
            break;
          default:
            return res.status(400).json([]);
        }
      }
    }
    if (!sql) return res.json({"accounts": []});
    sql = `${sql} limit ${limit};`;
    log(sql);
    let rows = await monet.queryAsync(sql);
    log(rows.data);
    if (!rows.data.length) return res.json({"accounts": []});
    const ids = rows.data.map(r => r[2]).join(',');
    sql = `SELECT f.name as fname, a.email, st.name as status, a.id, s.name as sname
      FROM accounts a
      JOIN status st
        ON a.status = st.id
      LEFT
      JOIN fname    f
        ON a.fname = f.id
      LEFT
      JOIN sname    s
        ON a.sname = s.id
     WHERE a.id IN (${ids}) 
     ORDER BY id DESC`;
    log(sql);
    rows = await mysql.queryToReplica(sql);
    const keys = ['fname', 'email', 'status', 'sname'];
    if (rows.length) {
      rows.forEach(row => {
        keys.forEach(k => {
          if (!row[k]) delete row[k];
        });
      });
    }
    return res.json({"accounts": rows});
  });

  app.post('/accounts/new', async (req, res) => {
    // return res.status(201).json({});
    const log = debug.extend('new');
    log(req.body);
    
    if (!Number.isInteger(req.body.id)) return res.status(400).json({});
    
    MAX_ID = Math.max(MAX_ID,req.body.id);
    const acc = req.body;
    if (acc.status && !STATUSES[acc.status]) return res.status(400).json({});
    
    const reEmail = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/; 
    if (!reEmail.test(acc.email)) return res.status(400).json({});
    
    // console.time('findEmail');
    // let rows = [];
    // rows = await req.db.queryToReplica(`SELECT id FROM accounts WHERE email = '${acc.email}';`);
    // console.timeEnd('findEmail');
    // if (rows.length) return res.status(400).json({});
    
    let params = [];
    const likes = [];
    const interests = [];
    if (acc.premium) {
      if (!(typeof acc.premium === 'object')) {
        return res.status(400).json({});
      }
      params = [
        acc.id, acc.email, FNAMES[acc.fname], SNAMES[acc.sname], STATUSES[acc.status], 
        COUNTRIES[acc.country], CITIES[acc.city], acc.phone, SEX[acc.sex], acc.joined,
        acc.birth, 1, acc.premium.start, acc.premium.finish
      ];
    } else {
      params = [
        acc.id, acc.email, FNAMES[acc.fname], SNAMES[acc.sname], STATUSES[acc.status], 
        COUNTRIES[acc.country], CITIES[acc.city], acc.phone, SEX[acc.sex], acc.joined,
        acc.birth, null, null, null
      ];            
    }
    // return res.status(201).json({});

    req.db.queryToMaster(helper.SQL_INSERT_ACCOUNT, params)
      .catch(e => {
        console.log(`NEW_ERROR: ${req.query.query_id}`);
        console.error(e.code + ': ' + e.errno);
        return res.status(500).json({e});
      })
    ++INSERTS;
    if (INSERTS > 30) {
      INSERTS = 0;
      // const label = 'NEW_COMMIT_' + req.query.query_id;
      // console.time(label);
      await req.db.queryToMaster('COMMIT;');
      // console.timeEnd(label);
    }
    return res.status(201).json({})
    
    if (acc.interests) {
      acc.interests.forEach((interest) => interests.push([interest, acc.id]));
    }
    
    if (acc.likes) {
      acc.likes.forEach((like) => likes.push([like.id, like.ts, acc.id]));
    }

    try {
      if (likes.length) {
        await req.db.queryToReplica(helper.SQL_INSERT_ACCOUNTS_LIKE, [likes]);
      }
      if (interests.length) {
        await req.db.queryToReplica(helper.SQL_INSERT_ACCOUNTS_INTEREST, [interests]);
      }
      // await req.db.queryToReplica(helper.SQL_INSERT_ACCOUNT, params);
      return res.status(201).json({});
    } catch(e) {
      console.log(`NEW_ERROR: ${req.query.query_id}`);
      console.error(e.code + ': ' + e.errno);
      return res.status(400).json({});
    }
  });

  app.post('/accounts/likes', async (req, res) => {
    const lbl = 'post_likes_' + req.query.query_id;
    console.time(lbl);

    const log = debug.extend('likes');
    log(req.body);

    const likes = req.body.likes;
    if (!likes) return res.status(400).json({});
    if (!Array.isArray(likes)) return res.status(400).json({});
    
    // await monet.queryAsyncMaster('START TRANSACTION;');
    const params = [];
    for (let i = 0, len = likes.length; i < len; i++) {
      const like = likes[i];
      if (!Number.isInteger(like.ts)) return res.status(400).json({}); 
      if (!Number.isInteger(like.liker)) return res.status(400).json({}); 
      if (!Number.isInteger(like.likee)) return res.status(400).json({});

      if (like.liker > MAX_ID) return res.status(400).json({});
      if (like.likee > MAX_ID) return res.status(400).json({});

      const rows = await mysql.queryToReplica(`SELECT * FROM accounts WHERE id = ${like.liker};`);
      const acc = rows[0];
      params.push([like.likee, like.liker, like.ts, acc.country, acc.city, acc.sex]);
    }
    LIKES++;
    try {
      await monet.insertLikesAsync(params);
      // const values = params.map(p => `(${p[0]}, ${p[1]}, ${p[2]}, ${p[3]}, ${p[4]}, ${p[5]})`).join(',');
      // await monet.queryAsyncMaster(`
      //   INSERT INTO likes (likee, liker, ts, ctry, city, sex)
      //   VALUES ${values};  
      // `);
    } catch (e) {
      console.error(e);
      console.timeEnd(lbl);
      return res.status(400).json({});
    }
    // if (LIKES > 10) {
    //   await monet.queryAsyncMaster('COMMIT;');
    // }
    console.timeEnd(lbl);
    res.status(202).json({});
  });

  app.post('/accounts/:id', async (req, res) => {
    // return res.status(202).json({});
    const log = debug.extend('upd');
    log(req.params.id);
    log(req.body);
    
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({});
    
    // console.time('findById');
    let rows = [];
    // rows = await req.db.queryToReplica('SELECT id FROM accounts WHERE id = ?', req.params.id);
    // console.timeEnd('findById');
    // if (!rows.length) return res.status(404).json({});
    
    if (id > MAX_ID) {
      // console.log(`404: id=${id}, MAX_ID=${MAX_ID}, q_id=${req.query.query_id}`)
      return res.status(404).json({});
    }
    const acc = req.body;
    if (acc.joined && !Number.isInteger(acc.joined)) return res.status(400).json({});
    if (acc.birth && !Number.isInteger(acc.birth)) return res.status(400).json({});
    if (acc.sex && !SEX[acc.sex]) return res.status(400).json({});

    if (acc.status && !STATUSES[acc.status]) return res.status(400).json({});

    if (acc.email) {
      const reEmail = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/; 
      if (!reEmail.test(acc.email)) return res.status(400).json({});
      
      rows = await req.db.queryToReplica(`SELECT id FROM accounts WHERE email = '${acc.email}';`);
      if (rows.length) {
        if (rows[0].id != id) return res.status(400).json({});
      }
    }
    
    // if (acc.phone) {
    //   const rePhone = /^8\(9[0-9]{2}\)[0-9]{7}$/; 
    //   if (!rePhone.test(acc.phone)) return res.status(400).json({});
    // }
    
    if (acc.likes) {
      const likes = acc.likes;
      for (let i = 0, len = likes.length; i < len ;i++) {
        const like = likes[i];
        if (!Number.isInteger(like.ts)) return res.status(400).json({}); 
      }
    }

    let sql = 'UPDATE accounts SET \n';
    const fields = [];
    const params = [];
    
    if (acc.premium) {
      if (!(typeof acc.premium === 'object')) {
        return res.status(400).json({});
      }
      const premium = acc.premium;
      fields.push('premium  = ?', 'pstart  = ?', 'pfinish  = ?');
      params.push(1, premium.start, premium.finish);
      delete acc.premium;
    }
    if (acc.interests) return res.status(202).json({});
    // return res.status(202).json({});
    for (let prop in acc) {
      if (acc.hasOwnProperty(prop)) {
        const val = acc[prop];
        
        if (helper.FILTERED_SIMPLE_FIELDS.includes(prop)) {
          fields.push(`${prop}  = ?`);
          switch (prop) {
            case 'sex':
              params.push(SEX[val]);             
              break;
            case 'status':
              params.push(STATUSES[val]);             
              break;
            case 'fname':
              params.push(FNAMES[val]);             
              break;
            case 'sname':
              params.push(SNAMES[val]);             
              break;
            case 'country':
              params.push(COUNTRIES[val]);             
              break;
            case 'city':
              params.push(CITIES[val]);             
              break;
            default:
              params.push(val);
              break;
          }
        }
      }
    }
    params.push(id);
    sql = sql + fields.join(',\n') + "\n WHERE id = ?";
    // return res.status(202).json({});
    log(sql);
    req.db.queryToMaster(sql, params)
      .catch(e => {
        console.log(`UPD_ERROR: ${req.query.query_id}`);
        console.error(e.code + ': ' + e.errno);
        return res.status(500).json({e});
      });
    ++UPDATES;
    if (UPDATES > 30) {
      UPDATES = 0;
      // const label = 'UPD_COMMIT_' + req.query.query_id;
      // console.time(label);
      await req.db.queryToMaster('COMMIT;');
      // console.timeEnd(label);
    }
    return res.status(202).json({});
  });

  /**
   * MAIN CALL
   */
  try {
    await start();
  } catch(err) {
    console.error(err);
  }
  
  app.listen(PORT, HOST);
  console.log(`Running on http://${HOST}:${PORT}`);
})();

async function start() {
  let rows = [];
  rows = await mysql.queryToMaster('SELECT max(id) as max_id FROM accounts;');
  MAX_ID = rows[0].max_id;
  rows = await mysql.queryToMaster('SELECT id, name FROM interest;');
  rows.forEach(i => INTERESTS[i.name] = i.id);
  rows = await mysql.queryToMaster('SELECT id, name FROM country;');
  rows.forEach(i => COUNTRIES[i.name] = i.id);
  rows = await mysql.queryToMaster('SELECT id, name FROM city;');
  rows.forEach(i => CITIES[i.name] = i.id);
  rows = await mysql.queryToMaster('SELECT id, name FROM fname;');
  rows.forEach(i => FNAMES[i.name] = i.id);
  rows = await mysql.queryToMaster('SELECT id, name FROM sname;');
  rows.forEach(i => SNAMES[i.name] = i.id);
  await mysql.queryToMaster('SET autocommit=0;');
  return;
}

function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms);
  });
}