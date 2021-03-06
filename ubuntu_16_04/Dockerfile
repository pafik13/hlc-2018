FROM ubuntu:16.04

RUN apt-get update

# Install MySQL
RUN DEBIAN_FRONTEND=noninteractive apt-get -y install mysql-server
RUN usermod -d /var/lib/mysql/ mysql
RUN chown -R mysql:mysql /var/lib/mysql

# Install UnZip
RUN apt-get install unzip

# # Install NodeJS
# ENV NODE_VERSION 9.11.2
RUN apt-get -y install curl
# RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash

# ENV NVM_DIR = /root/.nvm
# ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
# ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH
# RUN echo $PATH
# # RUN echo $NODE_PATH
# # confirm installation
# RUN node -v
# RUN npm -v

# Installation of NVM, NPM and packages
# https://gist.github.com/remarkablemark/aacf14c29b3f01d6900d13137b21db3a
RUN mkdir /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 10.15.0
ENV NVM_INSTALL_PATH $NVM_DIR/versions/node/v$NODE_VERSION
# RUN rm /bin/sh && ln -s /bin/bash /bin/sh
RUN curl --silent -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
RUN . $NVM_DIR/nvm.sh \
#    && nvm install $NODE_VERSION \
   && nvm alias default $NODE_VERSION \
   && nvm use default
ENV NODE_PATH $NVM_INSTALL_PATH/lib/node_modules
ENV PATH $NVM_INSTALL_PATH/bin:$PATH
RUN npm -v  # <= works
RUN node -v  # <= works

RUN npm install pm2 -g

# Install MonetDB
RUN apt-get install lsb-release -y
RUN apt-get install apt-transport-https
RUN echo "deb https://dev.monetdb.org/downloads/deb/ $(lsb_release -cs) monetdb" > /etc/apt/sources.list.d/monetdb.list
RUN echo "deb-src https://dev.monetdb.org/downloads/deb/ $(lsb_release -cs) monetdb" >> /etc/apt/sources.list.d/monetdb.list
RUN cat /etc/apt/sources.list.d/monetdb.list
RUN curl -L https://www.monetdb.org/downloads/MonetDB-GPG-KEY | apt-key add -
RUN apt update
RUN apt -y install monetdb5-sql monetdb-client

# Convert
RUN apt -y install dos2unix

# Environment
ENV DATA_PATH='/tmp/data/data.zip'
ENV PORT=80
ENV NODE_ENV=production
ENV ALL=true
ENV MYSQL_USER=root
ENV DEBUG=accounts:boot*
ENV IS_LOAD_TO_MONETDB=true


# Create app directory
WORKDIR /usr/src/app/monet
COPY monet/* ./
RUN dos2unix ./*
RUN dos2unix ./.monetdb
RUN pwd
RUN systemctl enable monetdbd
RUN ./init_monet.sh
# RUN monetdbd create ./db && monetdbd start ./db && monetdb create voc && monetdb release voc && mclient -d voc
# RUN ls -l
#  && monetdb create voc && monetdb release voc
# RUN mclient -d voc < TABLES.sql
# RUN mclient -d voc < SIMILARITY_IN_CITY.prc
# RUN mclient -d voc < SIMILARITY_IN_CTRY.prc


WORKDIR /usr/src/app/
COPY package*.json ./
RUN npm install
COPY *.js ./
COPY *.json ./

# RUN cat /proc/sys/fs/file-max
# RUN cat /proc/sys/fs/file-nr 
# RUN echo never >/sys/kernel/mm/transparent_hugepage/enabled
# RUN cat /sys/kernel/mm/transparent_hugepage/enabled
RUN cat /etc/mysql/mysql.conf.d/mysqld.conf

# Start MySQL
ENV INIT_DB="CREATE DATABASE IF NOT EXISTS acc CHARACTER SET utf8 COLLATE utf8_bin;SET GLOBAL max_heap_table_size = 1024 * 1024 * 768;SET GLOBAL tmp_table_size = 1024 * 1024 * 768;SET GLOBAL TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;"
ENTRYPOINT date +%H:%M:%S:%N && monetdbd start ./monet/db && date +%H:%M:%S:%N && find /var/lib/mysql -type f -exec touch {} \; && date +%H:%M:%S:%N && service mysql start && date +%H:%M:%S:%N && mysql -uroot -e "${INIT_DB}" && node --expose-gc boot.js && pm2 start pm2.json --env production && pm2 logs

ENV VERSION=1.0.7

EXPOSE 80
# CMD [ "npm", "start" ]