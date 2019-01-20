'use strict';
const debug = require('debug')('accounts:monet');

const genericPool = require("generic-pool");
const MDB = require('monetdb')();
const config = require('./config');

/**
 * Step 1 - Create pool using a factory object
 */
const factory = {
  create: function() {
    const conn = new MDB(config.monetConn);
    conn.id = Math.random() * 100 | 1;
    conn.connect();
    return conn;
  },
  destroy: function(conn) {
    conn.close();
  }
};
 
const poolOpts = {
  max: 4, // maximum size of the pool
  min: 2, // minimum size of the pool
};
 
const myPool = genericPool.createPool(factory, poolOpts);
 
/**
 * Step 2 - Use pool in your code to acquire/release resources
 */
 const log = debug.extend('queryAsync');
 async function queryAsync(sql)
 {
    // acquire connection - Promise is resolved
    // once a resource becomes available
    return new Promise((resolve, reject) => {
        const resourcePromise = myPool.acquire();
         
        resourcePromise
          .then(conn => {
            // const lbl = `query_${conn.id}_${new Date() / 1}`;
            // console.time(lbl);
            conn.query(sql)
              .then(rows => {
                  // console.timeEnd(lbl);
                  myPool.release(conn);
                  return resolve(rows);
              });
          })
          .catch(err => {
            log(err);
            return reject(err);
          });
    });
 }

const master = new MDB(config.monetConn);
master.connect();
// master.query('START TRANSACTION;');

async function queryAsyncMaster(sql)
 {
    return new Promise((resolve, reject) => {
      master.query(sql)
        .then(rows => {
            // console.timeEnd(lbl);
            return resolve(rows);
        })
        .catch(err => {
          log(err);
          return reject(err);
        });
    });
 }

 const C_SQL_INSERT_LIKE = `
    INSERT INTO likes (likee, liker, ts, ctry, city, sex)
    VALUES (?, ?, ?, ?, ?, ?)
 `;
 async function insertLikesAsync(likes)
 {
    return new Promise((resolve, reject) => {
      master.prepare(C_SQL_INSERT_LIKE)
        .then(prepResult => {
          for (let l = 0, len = likes.len; l < len; l++){
            prepResult.exec(likes[l]);
          }
          prepResult.release();
          resolve();
        })
        .catch(err => {
          log(err);
          return reject(err);
        });
    });
 }

exports = module.exports = {
  queryAsync,
  queryAsyncMaster,
  insertLikesAsync
};