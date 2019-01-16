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
  max: 8, // maximum size of the pool
  min: 4, // minimum size of the pool
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

exports = module.exports = {
  queryAsync
}