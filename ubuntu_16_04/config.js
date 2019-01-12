const C_MYSQL_USER = process.env.MYSQL_USER || 'pafik13';
const C_MYSQL_PASS = process.env.MYSQL_PASS || '';
const C_MYSQL_DB = process.env.MYSQL_DB || 'acc';


const C_MONET_USER = process.env.MYSQL_USER || 'monetdb';
const C_MONET_PASS = process.env.MYSQL_PASS || 'monetdb';
const C_MONET_DB = process.env.MYSQL_DB || 'voc';

const mysqlConn = {
    host     : '127.0.0.1',
    user     : C_MYSQL_USER,
    password : C_MYSQL_PASS,
    database : C_MYSQL_DB,
    charset  : 'utf8'
};


const monetConn = {
	host     : 'localhost', 
	port     : 50000, 
	dbname   : C_MONET_DB, 
	user     : C_MONET_USER, 
	password : C_MONET_PASS
};

module.exports = exports = {
    mysqlConn,
    monetConn
};