FROM debian:stretch

RUN apt-get update
RUN apt-get install man -y
RUN apt-get install wget -y
RUN apt-get install gnupg -y
RUN apt-get install sudo -y

RUN useradd -ms /bin/bash -p $(openssl passwd -1 q12345) -G sudo pavel
RUN cat /etc/sudoers
RUN echo "pavel ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
RUN echo "memsql ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# RUN adduser --disabled-password --gecos "" pavel
# RUN echo q12345 | passwd pavel --stdin
# RUN adduser pavel sudo

USER pavel
WORKDIR /home/pavel

# RUN sudo echo 'q12345' | sudo -S echo "Logged!" \
RUN wget -O - 'https://release.memsql.com/release-aug2018.gpg'  2>/dev/null | sudo apt-key add - && apt-key list
RUN apt-cache policy apt-transport-https 
RUN sudo apt -y install apt-transport-https 
RUN echo "deb https://release.memsql.com/production/debian memsql main" | sudo tee /etc/apt/sources.list.d/memsql.list
RUN sudo apt update && sudo apt -y install memsql-toolbox memsql-client

# RUN memsql-deploy cluster-in-a-box --license BGQ1YmEzMmFlMzA3MTRiNzRhMDJkNTliZjNkN2I4NDc0AAAAAAAAAAAAAAIAAAAAAAQwNAIYQguoCGVw7Rgsis56ditq+u4oFuduFCZfAhgZJtrS3GX7QaakspWiutGczwg1Z0rhhVIAAA==