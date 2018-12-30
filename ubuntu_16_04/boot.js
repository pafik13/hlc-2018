console.time('bootstrap');

const debug = require('debug')('accounts:boot');
const AdmZip = require('adm-zip');

const database = require('./mysql');
const helper = require('./helper');

const ALL = process.env.ALL || false;
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
        }
    },
});
(async () => {

    const log = debug.extend('main');
    log('Try to connect');
    await mysql.connect(); // MYSQL
    log('Connected');
    try {
        await mysql.queryToMaster('CREATE DATABASE IF NOT EXISTS acc;');
        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS);
        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS_LIKE);
        await mysql.queryToMaster(helper.SQL_CREATE_ACCOUNTS_INTEREST);
    } catch (error) {
        log(error);
    }
    const zip = new AdmZip(PATH);
    const entries = zip.getEntries();
    log(`entries.length = ${entries.length}`);
    let itemsProcessed = 0;
    entries.forEach(async (i) => {
      ++itemsProcessed;
      if (RE_FILENAME.test(i.entryName)) {
        log(i.entryName);
        // console.log(i.getData().toString('utf8'));
        // console.log(JSON.parse(i.getData().toString('utf8')));
        const data = JSON.parse(i.getData().toString('utf8'));
        log(Array.isArray(data.accounts));
            
        const lenAccs = ALL ? data.accounts.length : 100;
        log(lenAccs);

        for (let i = 0; i < lenAccs; i++) {
            const acc = data.accounts[i];
            // console.log(acc);
            if (acc.premium) {
                await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS,[
                    acc.id, acc.email, acc.fname, acc.sname, acc.status, 
                    acc.country, acc.city, acc.phone, acc.sex, acc.joined,
                    acc.birth, 1, acc.premium.start, acc.premium.finish
                ]);
            } else {
                await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS,[
                acc.id, acc.email, acc.fname, acc.sname, acc.status, 
                acc.country, acc.city, acc.phone, acc.sex, acc.joined,
                acc.birth, null, null, null
                ]);            
            }
        }

        for (let i = 0; i < lenAccs; i++) {
            const acc = data.accounts[i];
            // console.log(acc);
            if (acc.likes) {
                for (let j = 0, len = acc.likes.length; j < len; j++) {
                    const like = acc.likes[j];
                    await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS_LIKE,[like.id, like.ts, acc.id]);
                }
            }
        }

        // await sleep(1000);

        for (let i = 0; i < lenAccs; i++) {
            const acc = data.accounts[i];
            // console.log(acc);
            if (acc.interests) {
                for (let j = 0, len = acc.interests.length; j < len; j++) {
                    const interest = acc.interests[j];
                    await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS_INTEREST, [interest, acc.id]);
                }
            }
        }
      }

      if (itemsProcessed === entries.length) {
        // await helper.func.analyzeAsync(DB);
        // await helper.func.selectAsync()
        console.log(`Ended bootstrap...`);
        console.timeEnd('bootstrap');
      }
    });
    // process.exit();
})();

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms);
    });
  }