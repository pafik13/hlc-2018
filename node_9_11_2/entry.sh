#/bin/bash
# /usr/bin/mysqld_safe --skip-grant-tables &
mysqld
sleep 5
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS acc;"
# sleep 5
# npm start