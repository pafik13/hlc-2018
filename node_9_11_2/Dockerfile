# Наследуемся от Node.js v9.11.2
FROM node:9.11.2

ENV DATA_PATH='/tmp/data/data.zip'
ENV PORT=80
ENV NODE_ENV=production
ENV ALL=true

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

EXPOSE 8080
CMD [ "npm", "start" ]