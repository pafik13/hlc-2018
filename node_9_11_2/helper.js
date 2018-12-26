const debug = require('debug')('accounts:helper');

const SQL_CREATE_ACCOUNTS =
`CREATE TABLE accounts
  ( id INTEGER PRIMARY KEY AUTOINCREMENT
  , email text, fname text
  , sname text, status text
  , country text, city text
  , phone text, sex text
  , joined integer, birth integer
  , ext_id integer)`;

const SQL_INSERT_ACCOUNTS =
  `INSERT INTO accounts
    ( ext_id, email, fname, sname, status
    , country, city, phone, sex, joined, birth)
   VALUES
    ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`;

const SQL_CREATE_ACCOUNTS_LIKE =
`CREATE TABLE accounts_like
  ( id INTEGER PRIMARY KEY AUTOINCREMENT
  , like_id integer
  , like_ts integer
  , acc_id integer
  , FOREIGN KEY(acc_id) REFERENCES accounts(ext_id))`;

const SQL_INSERT_ACCOUNTS_LIKE =
  `INSERT INTO accounts_like
    ( like_id, like_ts, acc_id)
   VALUES ( ?, ?, ? )`;

const SQL_CREATE_ACCOUNTS_PREMIUM = 
`CREATE TABLE accounts_premium
  ( id INTEGER PRIMARY KEY AUTOINCREMENT
  , start integer
  , finish integer
  , acc_id integer
  , FOREIGN KEY(acc_id) REFERENCES accounts(ext_id))`;


const SQL_INSERT_ACCOUNTS_PREMIUM = 
  `INSERT INTO accounts_premium
    ( start, finish, acc_id )
   VALUES ( ?, ?, ? )`;

const SQL_CREATE_ACCOUNTS_INTEREST =
`CREATE TABLE accounts_interest
  ( id INTEGER PRIMARY KEY AUTOINCREMENT
  , interest text
  , acc_id integer
  , FOREIGN KEY(acc_id) REFERENCES accounts(ext_id))`;

  
const SQL_INSERT_ACCOUNTS_INTEREST =
`INSERT INTO accounts_interest
  ( interest, acc_id)
 VALUES ( ?, ? )`;

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
  "lt": "<"
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
  })
}

module.exports = exports = {
    SQL_CREATE_ACCOUNTS,
    SQL_INSERT_ACCOUNTS,
    SQL_CREATE_ACCOUNTS_LIKE,
    SQL_INSERT_ACCOUNTS_LIKE,
    SQL_CREATE_ACCOUNTS_PREMIUM,
    SQL_INSERT_ACCOUNTS_PREMIUM,
    SQL_CREATE_ACCOUNTS_INTEREST,
    SQL_INSERT_ACCOUNTS_INTEREST,
    FILTERED_SIMPLE_FIELDS,
    FILTERED_COMP_FIELDS,
    FILTER_OPERATIONS,
    func: {
      selectAsync
    }
};