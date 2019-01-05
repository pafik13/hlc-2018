/**
 * Created by vladimir on 12/15/17.
 */
const mysql = require('mysql2');
class MySQL {
    constructor(config) {
        if (config.mysql === undefined)
            throw new Error('Mysql configuration is missing in config');
        this.config = config.mysql;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.pool = mysql.createPoolCluster();
                this.pool.add('MASTER', this.config.master);
                this.pool.getConnection('MASTER', (err, conn) => {
                    if (err) return reject(err);
                    else
                        console.log(`Master ${this.config.master.host} success connected`);
                    conn.release();
                });
                if (this.config.mysqlReplication) {
                    for (let i = 0; i < this.config.replicas.length; i++) {
                        this.pool.add('SLAVE' + i, this.config.replicas[i]);
                        this.pool.getConnection('SLAVE' + i, (err, conn) => {
                            if (err) return reject(err);
                            else
                                console.log(`Slave ${this.config.replicas[i]['host']} success connected`);
                            conn.release();
                        });
                    }
                }
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    queryToReplica(query, params) {
        if (!this.config.mysqlReplication) {
            return this.queryToMaster(query, params);
        } else {
            return new Promise((resolve, reject) => {
                this.pool.getConnection('SLAVE*', 'ORDER', (err, conn) => {
                    if (err) return reject(err);
                    conn.query(query, params, (err, res) => {
                        if (err) reject(err);
                        else resolve(res);
                    });
                    conn.release();
                });
            });
        }
    }

    queryToMaster(query, params) {
        return new Promise((resolve, reject) => {
            this.pool.getConnection('MASTER', (err, conn) => {
                if (err) return reject(err);
                conn.query(query, params, (err, res) => {
                    if (err) reject(err);
                    else resolve(res);
                });
                conn.release();
            });
        });
    }
}
exports.mysql = MySQL;