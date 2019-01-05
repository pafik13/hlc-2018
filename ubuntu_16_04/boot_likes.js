const database = require('./mysql');
const helper = require('./helper');
const config = require('./config');

const mysql = new database.mysql({
     mysql: {
        master: config.mysqlConn
    },
});
mysql.connect();

async function countLikes(likes) {
   return likes.length;
}
// receive message from master process
process.on('message', async (message) => {
  const { likes, workerId } = message;
  const numberOfLikes = await countLikes(likes);
   // MYSQL
  try {
    await mysql.queryToMaster(helper.SQL_INSERT_ACCOUNTS_LIKE, [likes]);
  } catch(e) {
    console.error(workerId);
    console.error(e);
  }
  // insertEnd();
  // send response to master process
  process.send({ counter: numberOfLikes });
});