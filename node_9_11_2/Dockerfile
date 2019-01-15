# Наследуемся от Node.js v9.11.2
FROM node:9.11.2

ENV DATA_PATH='/tmp/data/data.zip'
ENV PORT=80
ENV NODE_ENV=production
ENV ALL=true
ENV MYSQL_USER=root

# Install MySQL
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
# RUN /bin/bash -c "/usr/bin/mysqld_safe --skip-grant-tables &" && \
#   sleep 5 && \
#   mysql -uroot -e "CREATE DATABASE IF NOT EXISTS acc;"

# RUN mysql_secure_installation

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 80

ENTRYPOINT [ "/etc/init.d/mysql", "start"]
# ENTRYPOINT [ "mysqld" ]
# CMD [ "npm", "start" ]