const database = require('./mysql');
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
mysql.connect(); // MYSQL
mysql.queryToMaster('CREATE DATABASE IF NOT EXISTS acc;');
// this.mysql = mysql;