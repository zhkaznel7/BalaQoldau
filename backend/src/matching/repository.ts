import type {Database,Program} from '../api/repository.ts';
import {programSelect} from '../api/repository.ts';
import type {ProgramFilters} from '../api/schemas.ts';
import {evaluateMatch,matchingToday} from './engine.ts';

// Ranking happens BEFORE pagination in PostgreSQL; never fetch an unbounded catalog.
export async function findMatches(db:Database,filters:ProgramFilters&{need?:string|undefined},id?:string){
  const today=matchingToday(),q=filters.q?'%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%':null;
  const result=await db.query<{total:number;data:Program[]}>(`WITH candidates AS (${programSelect}
    WHERE ($1::text IS NULL OR c.slug=$1) AND ($2::text IS NULL OR p.title ILIKE $2 OR p.description ILIKE $2)
      AND ($3::uuid IS NULL OR p.id=$3)), scored AS (
    SELECT candidates.*,CASE
      WHEN NOT "eligibilityComplete" OR "verifiedAt" IS NULL OR "sourceUrl" IS NULL OR "sourceName" IS NULL OR cardinality(regions)=0 THEN 1
      WHEN ($4::int IS NOT NULL AND $4 NOT BETWEEN "ageMin" AND "ageMax")
        OR ($5::text IS NOT NULL AND NOT $5=ANY(regions))
        OR ($6::text IS NOT NULL AND cardinality("familyCategories")>0 AND NOT $6=ANY("familyCategories"))
        OR deadline<$7::text THEN 2
      WHEN $4::int IS NULL OR $5::text IS NULL OR (cardinality("familyCategories")>0 AND $6::text IS NULL) THEN 1 ELSE 0 END AS "matchRank",
      CASE WHEN $6::text=ANY("familyCategories") THEN 0 ELSE 1 END AS "needRank",
      CASE WHEN $5::text=ANY(regions) THEN 0 ELSE 1 END AS "regionRank",
      CASE WHEN $4::int BETWEEN "ageMin" AND "ageMax" THEN 0 ELSE 1 END AS "ageRank",
      CASE WHEN deadline<$7::text THEN 1 ELSE 0 END AS "availabilityRank" FROM candidates)
    SELECT (SELECT count(*)::int FROM scored) AS total,
      COALESCE((SELECT jsonb_agg(to_jsonb(page_rows)-ARRAY['matchRank','needRank','regionRank','ageRank','availabilityRank'])
        FROM (SELECT * FROM scored ORDER BY "matchRank","needRank","regionRank","ageRank","availabilityRank",id LIMIT $8 OFFSET $9) page_rows),'[]'::jsonb) AS data`,
  [filters.category??null,q,id??null,filters.age??null,filters.region??null,filters.need??null,today,filters.limit,(filters.page-1)*filters.limit]);
  const row=result.rows[0];if(!row)throw new Error('Missing database result');
  return {data:row.data.map(p=>({...p,matching:evaluateMatch(p,filters,today)})),pagination:{page:filters.page,limit:filters.limit,total:row.total,totalPages:Math.ceil(row.total/filters.limit)}};
}
