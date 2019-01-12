create table likes (likee INT NOT NULL, liker INT NOT NULL, ts INT NOT NULL, ctry SMALLINT, city SMALLINT, sex BOOL NOT NULL);
create table ctry (id SMALLINT NOT NULL, name VARCHAR(30) NOT NULL);
create table city (id SMALLINT NOT NULL, name VARCHAR(30) NOT NULL);