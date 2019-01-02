const debug = require('debug')('accounts:helper');

const SQL_CREATE_ACCOUNTS =
`CREATE TABLE accounts
  ( id INTEGER PRIMARY KEY AUTO_INCREMENT
  , email varchar(100), fname varchar(50)
  , sname varchar(50), status varchar(50)
  , country varchar(50), city varchar(50)
  , phone varchar(16), sex char(1)
  , joined integer, birth integer
  , premium integer
  , pstart integer, pfinish integer
  )`;

const SQL_INSERT_ACCOUNTS =
  `INSERT INTO accounts
    ( id, email, fname, sname, status
    , country, city, phone, sex, joined 
    , birth, premium, pstart, pfinish)
   VALUES ?`;

const SQL_INSERT_ACCOUNT =
   `INSERT INTO accounts
     ( id, email, fname, sname, status
     , country, city, phone, sex, joined 
     , birth, premium, pstart, pfinish)
    VALUES
     ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? );`;

const SQL_CREATE_INDEX_EMAIL = `CREATE UNIQUE INDEX ix_email
  ON accounts(email);`;


const SQL_CREATE_ACCOUNTS_LIKE =
`CREATE TABLE accounts_like
  ( id INTEGER PRIMARY KEY AUTO_INCREMENT
  , like_id integer
  , like_ts integer
  , acc_id integer
  )`;

const SQL_INSERT_ACCOUNTS_LIKE =
  `INSERT INTO accounts_like
    ( like_id, like_ts, acc_id)
   VALUES ?`;
   
const SQL_CREATE_INDEX_LIKES = `CREATE INDEX ix_likes 
  ON accounts_like(like_id, acc_id);`;


const SQL_CREATE_ACCOUNTS_INTEREST =
`CREATE TABLE accounts_interest
  ( id INTEGER PRIMARY KEY AUTO_INCREMENT
  , interest varchar(100)
  , acc_id integer
  )`;

const SQL_INSERT_ACCOUNTS_INTEREST =
`INSERT INTO accounts_interest
  ( interest, acc_id)
VALUES ?`;

const SQL_CREATE_INDEX_INTERESTS = `CREATE INDEX ix_interests 
  ON accounts_interest(interest, acc_id);`;

const SQL_CREATE_INDEX_INTERESTS$ACC_ID = `CREATE INDEX ix_interests$acc_id
  ON accounts_interest(acc_id);`;

const SQL_ADD_REF_KEY_INTEREST= ` ALTER TABLE accounts_interest 
  ADD CONSTRAINT fk_ai$acc_id FOREIGN KEY (acc_id) REFERENCES accounts(id);`;

const SQL_ADD_REF_KEY_LIKE= ` ALTER TABLE accounts_like
  ADD CONSTRAINT fk_al$acc_id FOREIGN KEY (acc_id) REFERENCES accounts(id);`;


const SQL_ANALYZE_ACCOUNTS = 'ANALYZE TABLE accounts';
const SQL_ANALYZE_INTEREST = 'ANALYZE TABLE accounts_interest';
const SQL_ANALYZE_LIKE     = 'ANALYZE TABLE accounts_like';


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


const GROUP_KEYS = [
  'sex', 'status', 'country', 'city'
];

const GROUP_FILTER_FIELDS = [
  'sex', 'status', 'country', 'city', 'sname', 'fname'
];


const INDECES_SIMPLE_TEST = [
  'status', 'sex', 'city', 'country', 
  'premium',  'joined', 'birth'
];

const INDECES_SIMPLE_PROD = [
  'phone', 'fname', 'sname',
];

const INDECES_COMPOUND_TEST = [
  ['pstart', 'pfinish']
];

const INDECES_COMPOUND_PROD = [
  ['birth', 'country'], ['status', 'sex'], 
  ['country', 'status'], ['country', 'sex'], 
  ['country', 'status', 'sex'],
  ['birth', 'country', 'status'],
  ['city', 'status'], ['city', 'sex'],
  ['city', 'status', 'sex'],
  ['birth', 'city', 'status'],
  ['joined', 'city', 'status']
];


function getIndexCreation(fields = []) {
  const log = debug.extend('getIndexCreation');

  if (!fields.length) throw new Error('Empty list of fields');
  const cmd = `CREATE INDEX ix_${fields.join('_')} ON accounts(${fields.join(',')});`;
  log(cmd);
  return cmd;
}

module.exports = exports = {
    SQL_CREATE_ACCOUNTS,
    SQL_INSERT_ACCOUNTS,
    SQL_INSERT_ACCOUNT,
    SQL_CREATE_INDEX_EMAIL,
    SQL_CREATE_ACCOUNTS_LIKE,
    SQL_INSERT_ACCOUNTS_LIKE,
    SQL_CREATE_INDEX_LIKES,
    SQL_CREATE_ACCOUNTS_INTEREST,
    SQL_INSERT_ACCOUNTS_INTEREST,
    SQL_CREATE_INDEX_INTERESTS,
    SQL_CREATE_INDEX_INTERESTS$ACC_ID,
    SQL_ADD_REF_KEY_INTEREST,
    SQL_ADD_REF_KEY_LIKE,
    SQL_ANALYZE_ACCOUNTS,
    SQL_ANALYZE_INTEREST,
    SQL_ANALYZE_LIKE,
    FILTERED_SIMPLE_FIELDS,
    FILTERED_COMP_FIELDS,
    FILTER_OPERATIONS,
    GROUP_KEYS,
    GROUP_FILTER_FIELDS,
    INDECES_SIMPLE_TEST,
    INDECES_SIMPLE_PROD,
    INDECES_COMPOUND_TEST,
    INDECES_COMPOUND_PROD,
    func: {
      getIndexCreation
    }
};