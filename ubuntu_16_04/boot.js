console.time('bootstrap');

const debug = require('debug')('accounts:boot');
const AdmZip = require('adm-zip');

const database = require('./mysql');
const helper = require('./helper');

const ALL = Boolean(process.env.ALL) || false;
// const PATH = process.env.DATA_PATH || './node_9_11_2/data.zip';
// const PATH = process.env.DATA_PATH || 'C:\\data.zip';
const PATH = process.env.DATA_PATH || './data.zip';
const RE_FILENAME = new RegExp('account(.)+json');

const C_USER = process.env.MYSQL_USER || 'pafik13';
const C_PASS = process.env.MYSQL_PASS || '';
const C_DB = process.env.MYSQL_DB || 'acc';

const mysql = new database.mysql({
     mysql: {
        master: {
            host: '127.0.0.1',
            user: C_USER,
            password: C_PASS,
            database: C_DB,
            charset: 'utf8mb4'
        },
        replicas: [
          {
            host: '127.0.0.1',
            user: C_USER,
            password: C_PASS,
            database: C_DB,
            charset: 'utf8mb4'
          },
          {
            host: '127.0.0.1',
            user: C_USER,
            password: C_PASS,
            database: C_DB,
            charset: 'utf8mb4'
          }
        ],
      mysqlReplication: true
    },
});
(async () => {

    const log = debug.extend('main');
    log('Try to connect');
    await mysql.connect(); // MYSQL
    log('Connected');
    try {
        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS);
        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS_LIKE);
        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS_INTEREST);
    } catch (error) {
        log(error);
    }
    const zip = new AdmZip(PATH);
    const entries = zip.getEntries();
    log(`entries.length = ${entries.length}`);
    console.time('inserts');
    const inserts = [];
    for(let e = 0, len = entries.length; e < len; e++) {
      let i = entries[e];
      if (RE_FILENAME.test(i.entryName)) {
        log(i.entryName);
        // console.log(i.getData().toString('utf8'));
        // console.log(JSON.parse(i.getData().toString('utf8')));
        const data = JSON.parse(i.getData().toString('utf8'));
        log(Array.isArray(data.accounts));
            
        const lenAccs = ALL ? data.accounts.length : 10000;
        log(lenAccs);
        const accounts = [];
        const likes = [];
        const interests = [];
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          let params = [];
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
          accounts.push(params);
          // inserts.push(mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS, params));
          
          if (acc.interests) {
            // for (let j = 0, len = acc.interests.length; j < len; j++) {
              // const interest = acc.interests[j];
              acc.interests.forEach((interest) => interests.push([interest, acc.id]));
              // interests = interests.concat(params);
              // inserts.push(mysql.queryToReplica(helper.SQL_INSERT_ACCOUNTS_INTEREST, [params]));
            // }
          }
          
          if (acc.likes) {
            // for (let j = 0, len = acc.likes.length; j < len; j++) {
              // const like = acc.likes[j];
              // params = acc.likes.map((like) => [like.id, like.ts, acc.id]);
              // likes = likes.concat(params);
              acc.likes.map((like) => likes.push([like.id, like.ts, acc.id]));
              // inserts.push(mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS_LIKE, [params]));
            // }
          }
        }
      
        inserts.push(mysql.queryToReplica(helper.SQL_INSERT_ACCOUNTS_INTEREST, [interests]));
        inserts.push(mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS_LIKE, [likes]));
        inserts.push(mysql.queryToReplica(helper.SQL_INSERT_ACCOUNTS, [accounts]));

      }
    }
    Promise.all(inserts).then(async () => {
      console.timeEnd('inserts');
      
      console.time('references');
      try {
          await mysql.queryToMaster(helper.SQL_ADD_REF_KEY_INTEREST);
          await mysql.queryToMaster(helper.SQL_ADD_REF_KEY_LIKE);
      } catch (error) {
          log(error);
      }
      console.timeEnd('references');
      
      console.timeEnd('bootstrap');
      log(`Bootstrap is ended...`);
      process.exit();
    });

    // process.exit();
})();

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms);
    });
  }