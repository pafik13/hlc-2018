# ./usr/bin/env bash
monetdbd create ./db
monetdbd start ./db
monetdb create voc
monetdb release voc
mclient -d voc < TABLES.sql
mclient -d voc < SIMILARITY_IN_CITY.prc
mclient -d voc < SIMILARITY_IN_CTRY.prc