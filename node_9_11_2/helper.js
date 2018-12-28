const debug = require('debug')('accounts:helper');

const SQL_CREATE_ACCOUNTS =
`CREATE TABLE accounts
  ( id INTEGER PRIMARY KEY AUTOINCREMENT
  , email text, fname text
  , sname text, status text
  , country text, city text
  , phone text, sex text
  , joined integer, birth integer
  , premium integer
  , pstart integer, pfinish integer
  )`;

const SQL_INSERT_ACCOUNTS =
  `INSERT INTO accounts
    ( id, email, fname, sname, status
    , country, city, phone, sex, joined 
    , birth, premium, pstart, pfinish)
   VALUES
    ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`;

const SQL_CREATE_INDEX_PREMIUM = `CREATE INDEX ix_premium 
  ON accounts(premium);`;

const SQL_CREATE_INDEX_COUNTRY = `CREATE INDEX ix_country
  ON accounts(country);`;

const SQL_CREATE_INDEX_CITY = `CREATE INDEX ix_city
  ON accounts(country);`;

const SQL_CREATE_ACCOUNTS_LIKE =
`CREATE TABLE accounts_like
  ( id INTEGER PRIMARY KEY AUTOINCREMENT
  , like_id integer
  , like_ts integer
  , acc_id integer
  , FOREIGN KEY(acc_id) REFERENCES accounts(id))`;

const SQL_INSERT_ACCOUNTS_LIKE =
  `INSERT INTO accounts_like
    ( like_id, like_ts, acc_id)
   VALUES ( ?, ?, ? )`;
   

const SQL_CREATE_INDEX_LIKES = `CREATE INDEX ix_likes 
  ON accounts_like(like_id, acc_id);`;

const SQL_CREATE_ACCOUNTS_INTEREST =
`CREATE TABLE accounts_interest
  ( id INTEGER PRIMARY KEY AUTOINCREMENT
  , interest text
  , acc_id integer
  , FOREIGN KEY(acc_id) REFERENCES accounts(id))`;


const SQL_INSERT_ACCOUNTS_INTEREST =
`INSERT INTO accounts_interest
  ( interest, acc_id)
 VALUES ( ?, ? )`;


const SQL_CREATE_INDEX_INTERESTS = `CREATE INDEX ix_interests 
  ON accounts_interest(interest, acc_id);`;

const FILTERED_SIMPLE_FIELDS = [
  'sex', 'email', 'status',
  'fname', 'sname', 'phone',
  'country', 'city', 'birth'
];

const FILTERED_COMP_FIELDS = [
  'interests', 'likes'
];

const FILTER_OPERATIONS = {
  "eq": "=",
  "neq": "!=",
  "lt": "<",
  "gt": ">"
};

function selectAsync (db, sql) {
  const log = debug.extend('selectAsync');
  log(sql);
  return new Promise((resolve, reject) =>{
    const rows = [];
    db.each(sql, (err, row) => {
      if (err) return reject(err);
      rows.push(row);
    }, (err, cnt) => {
      if (err) return reject(err);
      log(`${cnt} rows`);
      resolve(rows);
    });
  });
}

function updateAsync (db, sql, params) {
  const log = debug.extend('updateAsync');
  log(sql);
  log(params);
  return new Promise((resolve, reject) =>{
    db.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function analyzeAsync (db) {
  // const log = debug.extend('analyzeAsync');
  return new Promise((resolve, reject) =>{
    db.exec("ANALYZE", (err) => {
      // log(err);
      if (err) return reject(err);
      resolve();
    });
  });
}

function execAsync (db, cmd) {
  const log = debug.extend('execAsync');
  log(cmd);
  return new Promise((resolve, reject) =>{
    db.exec(cmd, (err) => {
      // log(err);
      if (err) return reject(err);
      resolve();
    });
  });
}


function createIndexAsync (db, field, table = 'accounts') {
  const log = debug.extend('createIndexAsync');
  const cmd = `CREATE INDEX ix_${field} ON ${table}(${field});`;
  log(cmd);
  return new Promise((resolve, reject) =>{
    db.exec(cmd, (err) => {
      // log(err);
      if (err) return reject(err);
      resolve();
    });
  });
}

// function processAccAsync (db, acc) {
//   const log = debug.extend('processAccAsync');
//   acc.id = acc.id || null;
//   // const cmd = `CREATE INDEX ix_${field} ON ${table}(${field});`;
//   log(cmd);
//   return new Promise((resolve, reject) =>{
//     db.exec(cmd, (err) => {
//       // log(err);
//       if (err) return reject(err);
//       resolve();
//     });
//   });
// }



module.exports = exports = {
    SQL_CREATE_ACCOUNTS,
    SQL_INSERT_ACCOUNTS,
    SQL_CREATE_INDEX_PREMIUM,
    SQL_CREATE_INDEX_COUNTRY,
    SQL_CREATE_INDEX_CITY,
    SQL_CREATE_ACCOUNTS_LIKE,
    SQL_INSERT_ACCOUNTS_LIKE,
    SQL_CREATE_INDEX_LIKES,
    SQL_CREATE_ACCOUNTS_INTEREST,
    SQL_INSERT_ACCOUNTS_INTEREST,
    SQL_CREATE_INDEX_INTERESTS,
    FILTERED_SIMPLE_FIELDS,
    FILTERED_COMP_FIELDS,
    FILTER_OPERATIONS,
    func: {
      selectAsync,
      updateAsync,
      analyzeAsync,
      execAsync,
      createIndexAsync
    }
};