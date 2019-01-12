CREATE OR REPLACE FUNCTION SIMILARITY_IN_CTRY(iMe int, iCtry smallint)
RETURNS TABLE (s float, c int, id int)
BEGIN
  RETURN WITH similar AS (
        select o.liker, sum(log(abs(me.ts - o.ts + 1))) as strength, count(*) as cnt
          from likes o
          join (select * from likes where liker = iMe) me
            on me.likee = o.likee
         where o.liker <> me.liker
           and o.ctry = iCtry
         group
            by o.liker
    )
    select s.strength, s.cnt, l.likee
      from likes   l
      join similar s
        on s.liker = l.liker
     where l.likee NOT IN (select likee from likes where liker = iMe)
     order by s.strength, l.likee desc;
END;