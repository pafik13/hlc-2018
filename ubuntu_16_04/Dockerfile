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
ENV NODE_VERSION 9.11.2
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

# Environment
ENV DATA_PATH='/tmp/data/data.zip'
ENV PORT=80
ENV NODE_ENV=production
ENV ALL=true
ENV MYSQL_USER=root
ENV DEBUG=accounts:boot*

# Create app directory
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY *.js ./
COPY *.json ./


# Start MySQL
ENV INIT_DB="CREATE DATABASE IF NOT EXISTS acc CHARACTER SET utf8 COLLATE utf8_bin;SET GLOBAL max_heap_table_size = 1024 * 1024 * 256;SET GLOBAL tmp_table_size = 1024 * 1024 * 256;"
ENTRYPOINT date +%H:%M:%S:%N && find /var/lib/mysql -type f -exec touch {} \; && date +%H:%M:%S:%N && service mysql start && date +%H:%M:%S:%N && mysql -uroot -e "${INIT_DB}" && node --expose-gc boot.js && pm2 start pm2.json --env production && pm2 logs

EXPOSE 80
# CMD [ "npm", "start" ]