console.time('bootstrap');

const debug = require('debug')('accounts:boot');
const monetLog = debug.extend('monetdb');
const { createArrayCsvWriter } = require('csv-writer');
const MDB = require('monetdb')();

const AdmZip = require('adm-zip');

const database = require('./mysql');
const helper = require('./helper');
const config = require('./config');

const TEMP_CSV_FILE = '/tmp/likes.csv';
const IS_LOAD_TO_MONETDB = Boolean(process.env.IS_LOAD_TO_MONETDB) || false;;
const monet = new MDB(config.monetConn);

const ALL = Boolean(process.env.ALL) || false;
// const PATH = process.env.DATA_PATH || './node_9_11_2/data.zip';
// const PATH = process.env.DATA_PATH || 'C:\\data.zip';
const PATH = process.env.DATA_PATH || './data.zip';
const RE_FILENAME = new RegExp('account(.)+json');

// Dictionaries
const INTERESTS = {};
let INTEREST = 0;

const COUNTRIES = {};
let COUNTRY = 0;

const CITIES = {};
let CITY = 0;

const FNAMES = {};
let FNAME = 0;

const SNAMES = {};
let SNAME = 0;

const STATUSES = {
  "свободны": 1,
  "заняты": 2,
  "всё сложно": 3
};

const SEX = {
  "m": 1,
  "f": 0
};


let PROD = false;

const mysql = new database.mysql({
     mysql: {
        master: config.mysqlConn,
        replicas: [config.mysqlConn, config.mysqlConn],
      mysqlReplication: true
    },
});

const logInsertEnd = debug.extend('insertEnd');
function insertEnd() {
  global.gc();
  logInsertEnd(`memory (MB): ${process.memoryUsage().rss / 1048576}`);
}

async function insertDict(objDict, objName) {
  let params = [];
  Object.keys(objDict).forEach(key => params.push([objDict[key], key]));
  await mysql.queryToReplica(helper.func.getDictInsertion(objName), [params]);
}

(async () => {

    const log = debug.extend('main');
    log('Try to connect');
    await mysql.connect(); // MYSQL
    await monet.connect(); // MonetDB
    log('Connected');
    try {
        await mysql.queryToMaster(helper.SQL_TMP_TABLE_SIZE);
        await mysql.queryToMaster(helper.SQL_HEAP_TABLE_SIZE);

        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS);
        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS_INTEREST);
        
        await mysql.queryToMaster(helper.func.getDictCreation('fname', 'SMALLINT'));
        await mysql.queryToMaster(helper.func.getDictCreation('sname', 'SMALLINT'));
        await mysql.queryToMaster(helper.func.getDictCreation('country'));
        await mysql.queryToMaster(helper.func.getDictCreation('city', 'SMALLINT'));
        await mysql.queryToMaster(helper.func.getDictCreation('interest'));
        await mysql.queryToMaster(helper.func.getDictCreation('status'));
    } catch (error) {
        log(error);
    }
    const zip = new AdmZip(PATH);
    const entries = zip.getEntries();
    log(`entries.length = ${entries.length}`);
    console.time('inserts');
    PROD = entries.length > 3;
    for(let e = 0, len = entries.length; e < len; e++) {
      log(`iteration: ${e}`);
      log(`memory (MB): ${process.memoryUsage().rss / 1048576}`);
      let i = entries[e];
      if (RE_FILENAME.test(i.entryName)) {
        log(i.entryName);

        const data = JSON.parse(i.getData().toString('utf8'));
        log(Array.isArray(data.accounts));
            
        const lenAccs = ALL ? data.accounts.length : 100;
        log(lenAccs);
        const accounts = [];
        const likes = [];
        const interests = [];
        const csvWriter = createArrayCsvWriter({
            header: ['likee', 'liker', 'ts', 'country', 'city', 'sex'],
            path: TEMP_CSV_FILE
        });
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          if (acc.country){
            if (!COUNTRIES[acc.country]) {
              COUNTRIES[acc.country] = ++COUNTRY;
            }
          }
          
          if (acc.city){
            if (!CITIES[acc.city]) {
              CITIES[acc.city] = ++CITY;
            }
          }
          
          if (acc.fname){
            if (!FNAMES[acc.fname]) {
              FNAMES[acc.fname] = ++FNAME;
            }
          }
          
          if (acc.sname){
            if (!SNAMES[acc.sname]) {
              SNAMES[acc.sname] = ++SNAME;
            }
          }
          
          let params = [];
          if (acc.premium) {
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
          accounts.push(params);

          if (acc.interests) {
            acc.interests.forEach(interest => {
              if (!INTERESTS[interest]) INTERESTS[interest] = ++INTEREST;
              interests.push([INTERESTS[interest], acc.id]);
            });
          }
          
          if (acc.likes) {
            acc.likes.forEach((like) => likes.push([
              like.id, acc.id, like.ts, 
              Boolean(acc.country) ? COUNTRIES[acc.country] : 0,
              Boolean(acc.city) ? CITIES[acc.city] : 0,
              Boolean(SEX[acc.sex])
            ]));
          }
        }
        
        if (IS_LOAD_TO_MONETDB) {
          monetLog(`likes.length=${likes.length}`);
          const sql = `COPY OFFSET 6 INTO likes FROM '${TEMP_CSV_FILE}' USING  DELIMITERS ',';`;
          console.time('write');
          await csvWriter.writeRecords(likes);      // returns a promise
          console.timeEnd('write');
          const res = await monet.query(sql);
          monetLog(res);
          insertEnd();
        }
        
        const a = mysql.queryToReplica(helper.SQL_INSERT_ACCOUNTS, [accounts]);
        // insertEnd();
        
        const ai = mysql.queryToReplica(helper.SQL_INSERT_ACCOUNTS_INTEREST, [interests]);
        await Promise.all([a, ai]);
        insertEnd();
      }
    }
    
    await Promise.all([
      insertDict(FNAMES, 'fname'), insertDict(SNAMES, 'sname'), insertDict(COUNTRIES, 'country'),
      insertDict(CITIES, 'city'), insertDict(INTERESTS, 'interest'), insertDict(STATUSES, 'status')
    ]);
    
    console.timeEnd('inserts');
    
    console.time('references');
    console.timeEnd('references');
    
    console.time('indeces');
    try {
      await mysql.queryToMaster(helper.SQL_CREATE_INDEX_INTERESTS);
      await mysql.queryToMaster(helper.SQL_CREATE_INDEX_EMAIL);
      for (let field of helper.INDECES_SIMPLE_TEST) {
        await mysql.queryToMaster(helper.func.getIndexCreation([field]));
      }
      
      for (let fields of helper.INDECES_COMPOUND_TEST) {
        await mysql.queryToMaster(helper.func.getIndexCreation(fields));
      }
      
      if (PROD) {
        await mysql.queryToMaster(helper.SQL_CREATE_INDEX_INTERESTS$ACC_ID);
        
        for (let field of helper.INDECES_SIMPLE_PROD) {
          await mysql.queryToMaster(helper.func.getIndexCreation([field]));
        }   
        for (let fields of helper.INDECES_COMPOUND_PROD) {
          await mysql.queryToMaster(helper.func.getIndexCreation(fields));
        }
      }
    } catch (error) {
      log(error);
    }
    console.timeEnd('indeces');
    
    console.time('analyze');
    try {
      await mysql.queryToMaster(helper.SQL_ANALYZE_ACCOUNTS);
      await mysql.queryToMaster(helper.SQL_ANALYZE_INTEREST);
    } catch (error) {
      log(error);
    }
    console.timeEnd('analyze');
    
    console.timeEnd('bootstrap');
    log(`Bootstrap is ended...`);
    process.exit();

})();

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms);
    });
  }