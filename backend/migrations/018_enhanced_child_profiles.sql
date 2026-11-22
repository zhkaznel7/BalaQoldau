-- Optional private attributes only; no existing accounts or program records rewritten.
ALTER TABLE balaqoldau.child_profiles
 ADD COLUMN full_name varchar(100) CHECK(full_name IS NULL OR (length(btrim(full_name)) BETWEEN 1 AND 100 AND full_name !~ '[[:cntrl:][:digit:]]')),
 ADD COLUMN gender text CHECK(gender IN('female','male')),
 ADD COLUMN interests text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK(
   cardinality(interests)<=3 AND array_position(interests,NULL) IS NULL
   AND interests<@ARRAY['education','creativity','sports']::text[]
   AND cardinality(interests)=(CASE WHEN 'education'=ANY(interests) THEN 1 ELSE 0 END
    +CASE WHEN 'creativity'=ANY(interests) THEN 1 ELSE 0 END+CASE WHEN 'sports'=ANY(interests) THEN 1 ELSE 0 END));
