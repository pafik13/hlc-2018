const debug = require('debug')('accounts:helper');

const SQL_TMP_TABLE_SIZE = 'SET GLOBAL tmp_table_size = 1024 * 1024 * 1024;';
const SQL_HEAP_TABLE_SIZE = 'SET GLOBAL max_heap_table_size = 1024 * 1024 * 1024;';

const SQL_CREATE_ACCOUNTS =
`CREATE TABLE accounts
  ( id MEDIUMINT UNSIGNED PRIMARY KEY
  , email varchar(50) NOT NULL, fname SMALLINT UNSIGNED
  , sname SMALLINT UNSIGNED, status TINYINT(2) UNSIGNED NOT NULL
  , country TINYINT UNSIGNED, city SMALLINT UNSIGNED
  , phone varchar(16), sex BOOLEAN
  , joined integer NOT NULL, birth integer
  , premium BOOLEAN
  , pstart integer, pfinish integer
  ) ENGINE=MEMORY`;

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
`CREATE TABLE likes
  ( likee MEDIUMINT UNSIGNED NOT NULL
  , liker MEDIUMINT UNSIGNED NOT NULL
  )`;

const SQL_INSERT_ACCOUNTS_LIKE =
  `INSERT INTO likes
    ( likee, liker)
   VALUES ?`;
   
const SQL_CREATE_INDEX_LIKES = `CREATE INDEX ix_likes 
  ON likes(likee, liker);`;


const SQL_CREATE_ACCOUNTS_INTEREST =
`CREATE TABLE accounts_interest
  ( interest TINYINT UNSIGNED
  , acc_id MEDIUMINT UNSIGNED NOT NULL
  ) ENGINE=MEMORY`;

const SQL_INSERT_ACCOUNTS_INTEREST =
`INSERT INTO accounts_interest
  ( interest, acc_id)
VALUES ?`;

const SQL_CREATE_INDEX_INTERESTS = `CREATE INDEX ix_interests 
  ON accounts_interest(interest, acc_id);`;

const SQL_CREATE_INDEX_INTERESTS$ACC_ID = `CREATE INDEX ix_interests$acc_id
  ON accounts_interest(acc_id);`;

const SQL_ADD_REF_KEY_ACCOUNTS_INTEREST$ACC_ID = ` ALTER TABLE accounts_interest 
  ADD CONSTRAINT fk_ai$acc_id FOREIGN KEY (acc_id) REFERENCES accounts(id);`;

const SQL_ADD_REF_KEY_ACCOUNTS_INTEREST$INTEREST = ` ALTER TABLE accounts_interest 
  ADD CONSTRAINT fk_ai$interest FOREIGN KEY (interest) REFERENCES interest(id);`;

const SQL_ADD_REF_KEY_LIKE= ` ALTER TABLE likes
  ADD CONSTRAINT liker FOREIGN KEY (liker) REFERENCES accounts(id);`;


const SQL_ANALYZE_ACCOUNTS = 'ANALYZE TABLE accounts';
const SQL_ANALYZE_INTEREST = 'ANALYZE TABLE accounts_interest';
const SQL_ANALYZE_LIKE     = 'ANALYZE TABLE likes';


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
  'status', 'city', 'country', 'birth'
];

const INDECES_SIMPLE_PROD = [
  'phone', 'fname', 'sname',
];

const INDECES_COMPOUND_TEST = [
  ['city', 'sex'], ['country', 'sex'], ['status', 'sex']
];

const INDECES_COMPOUND_PROD = [
  ['birth', 'country'], 
  ['country', 'status'],  
  ['country', 'status', 'sex'],
  ['birth', 'country', 'status'],
  ['city', 'status'],
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

function getDictCreation(tableName, idType = 'TINYINT') {
  const log = debug.extend('getDictCreation');

  if (!tableName) throw new Error('Empty tableName');
  const cmd = `CREATE TABLE ${tableName} 
    ( id ${idType} UNSIGNED PRIMARY KEY
    , name VARCHAR(50)
    );`;
  log(cmd);
  return cmd;
}

function getDictInsertion(tableName) {
  const log = debug.extend('getDictInsertion');

  if (!tableName) throw new Error('Empty tableName');
  const cmd = `INSERT INTO ${tableName} (id, name) VALUES ?`;
  log(cmd);
  return cmd;
}

function getDictRefference(tableName, colName, dictName) {
  const log = debug.extend('getDictRefference');

  if (!tableName) throw new Error('Empty tableName');
  if (!colName) throw new Error('Empty tableName');
  const dict = dictName ? dictName : colName;

  const cmd = `ALTER TABLE ${tableName} ADD CONSTRAINT ref_${tableName}$${colName} 
    FOREIGN KEY (${colName}) REFERENCES ${dict}(id);`;
  log(cmd);
  return cmd;
}

module.exports = exports = {
    SQL_TMP_TABLE_SIZE,
    SQL_HEAP_TABLE_SIZE,
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
    SQL_ADD_REF_KEY_ACCOUNTS_INTEREST$ACC_ID,
    SQL_ADD_REF_KEY_ACCOUNTS_INTEREST$INTEREST,
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
      getIndexCreation,
      getDictCreation,
      getDictInsertion,
      getDictRefference
    }
};