# Наследуемся от CentOS 7
FROM centos:7

# Выбираем рабочую папку
WORKDIR /root

RUN yum install -y wget
RUN yum install -y sudo
RUN yum install -y which
RUN yum install -y openssl

RUN useradd -ms /bin/bash -p $(openssl passwd -1 q12345) -G wheel pavel
