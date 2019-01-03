# /bin/bash
find /var/lib/mysql -type f -exec touch {} \; && service mysql start

# RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
# RUN export NVM_DIR="$HOME/.nvm" &&  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
# RUN [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# RUN nvm install 9.11.2

mysql -uroot -e \"CREATE DATABASE IF NOT EXISTS acc;\" && 

docker build -t re1ax/ubuntu-16-04 .
docker run -it --rm -v /c/data.zip:/tmp/data/data.zip:ro re1ax/ubuntu-16-04
docker run -it --rm -v /c/data.zip:/tmp/data/data.zip:ro -p 80:80 re1ax/ubuntu-16-04

docker rm $(docker ps -a -q)
docker rmi $(docker images -f "dangling=true" -q)