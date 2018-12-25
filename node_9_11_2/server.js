'use strict';

const express = require('express');
const AdmZip = require('adm-zip');
const sqlite3 = require('sqlite3').verbose();
const helper = require('./helper');

// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
// const PATH = process.env.DATA_PATH || './node_9_11_2/data.zip';
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
  app.use('*', dbmiddle)

  app.get('/', (req, res) => {
    res.send('Hello world\n');
  });

  app.get('/premium', (req, res) => {
    const rows = [];
    req.db.each("SELECT * FROM accounts_premium LIMIT 3", (err, row) => {
      if (err) {
        res.json({err});
      } else {
        rows.push(row);
      }
    }, (err, cnt) => {
      if (err) {
        res.json({err});
      } else {
        res.json(rows);
      }
    });
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
  console.log(`Starting bootstrap...`);
  console.log(`PATH=${PATH}`)
  // await sleep(1000);
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
        DB.run("CREATE TABLE lorem (info TEXT)");
        DB.run(helper.SQL_CREATE_ACCOUNTS);
        DB.run(helper.SQL_CREATE_ACCOUNTS_LIKE);
        DB.run(helper.SQL_CREATE_ACCOUNTS_PREMIUM);
        DB.run(helper.SQL_CREATE_ACCOUNTS_INTEREST);
        
        const lenAccs = data.accounts.length;
        const stmtAcc = DB.prepare(helper.SQL_INSERT_ACCOUNTS);
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          // console.log(acc);
          stmtAcc.run([
            acc.id, acc.email, acc.fname, acc.sname, acc.status,
            acc.country, acc.city, acc.phone, acc.sex, acc.joined, acc.birth
          ]);
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

        const stmtAccPrem = DB.prepare(helper.SQL_INSERT_ACCOUNTS_PREMIUM);
        for (let i = 0; i < lenAccs; i++) {
          const acc = data.accounts[i];
          const premium = acc.premium;
          // console.log(acc);
          if (premium) stmtAccPrem.run([premium.start, premium.finish, acc.id]);
        }
        stmtAccPrem.finalize();

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

        // DB.each("SELECT * FROM accounts_premium LIMIT 3", function(err, row) {
        //   if (err) throw err;
        //   console.log(row);
        // });


      });
      
      // DB.close();
    }
  });
  console.log(`Ended bootstrap...`);
}

function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms);
  })
}