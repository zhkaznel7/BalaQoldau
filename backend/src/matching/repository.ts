import type {Database,Program} from '../api/repository.ts';
import {programSelect,publicProgramSource} from '../api/repository.ts';
import type {ProgramFilters} from '../api/schemas.ts';
import {evaluateMatch,matchingToday} from './engine.ts';
import {intentRegions} from '../ai/intent.ts';
import {withProgramTranslation} from '../api/program-translations.ts';

export async function recommendationSuggestions(db: Database, reviewDays: number) {
  return (await db.query<{category:string; age:number; region:string}>(`
    SELECT DISTINCT ON (c.slug) c.slug AS category, p.age_min AS age, r.slug AS region
    FROM ${publicProgramSource}
    JOIN balaqoldau.program_regions pr ON pr.program_id=p.id
    JOIN balaqoldau.regions r ON r.id=pr.region_id
    WHERE r.slug=ANY($1::text[]) AND r.name !~* '^DEMO'
      AND p.source_url IS NOT NULL AND p.source_name IS NOT NULL
      AND p.verified_at > statement_timestamp() - $2::int * interval '24 hours'
    ORDER BY c.slug, p.eligibility_complete DESC, p.verified_at DESC, p.id, r.slug`,
  [intentRegions, reviewDays])).rows;
}

// Ranking happens BEFORE pagination in PostgreSQL; never fetch an unbounded catalog.
export async function findMatches(db:Database,filters:ProgramFilters&{need?:string|undefined;recommendationReviewDays?:number},id?:string,categories?:string[],preferredNeeds?:string[]){
  const today=matchingToday(),q=filters.q?'%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%':null;
  const result=await db.query<{total:number;data:Program[]}>(`WITH candidates AS (${programSelect}
    WHERE ($1::text IS NULL OR c.slug=$1) AND ($2::text IS NULL OR p.title ILIKE $2 OR p.description ILIKE $2)
      AND ($3::uuid IS NULL OR p.id=$3) AND ($10::text[] IS NULL OR c.slug=ANY($10::text[]))
      AND ($12::int IS NULL OR (p.verified_at IS NOT NULL AND p.source_url IS NOT NULL AND p.source_name IS NOT NULL
        AND p.verified_at > statement_timestamp() - $12::int * interval '24 hours'))), scored AS (
    SELECT candidates.*,CASE
      WHEN NOT "eligibilityComplete" OR "verifiedAt" IS NULL OR "sourceUrl" IS NULL OR "sourceName" IS NULL OR cardinality(regions)=0 THEN 1
      WHEN ($4::int IS NOT NULL AND $4 NOT BETWEEN "ageMin" AND "ageMax")
        OR ($5::text IS NOT NULL AND NOT $5=ANY(regions))
        OR ($6::text IS NOT NULL AND cardinality("familyCategories")>0 AND NOT $6=ANY("familyCategories"))
        OR deadline<$7::text THEN 2
      WHEN $4::int IS NULL OR $5::text IS NULL OR (cardinality("familyCategories")>0 AND $6::text IS NULL) THEN 1 ELSE 0 END AS "matchRank",
      CASE WHEN $6::text=ANY("familyCategories") OR "familyCategories"::text[] && COALESCE($11::text[],ARRAY[]::text[]) THEN 0 ELSE 1 END AS "needRank",
      CASE WHEN $5::text=ANY(regions) THEN 0 ELSE 1 END AS "regionRank",
      CASE WHEN $4::int BETWEEN "ageMin" AND "ageMax" THEN 0 ELSE 1 END AS "ageRank",
      CASE WHEN deadline<$7::text THEN 1 ELSE 0 END AS "availabilityRank" FROM candidates
      WHERE $12::int IS NULL OR (
        ($4::int IS NULL OR $4 BETWEEN "ageMin" AND "ageMax")
        AND ($5::text IS NULL OR $5=ANY(regions))
        AND (category<>'clubs' OR $6::text IS NULL OR $6=ANY("familyCategories"))
      )),
    result_candidates AS (SELECT * FROM scored WHERE $12::int IS NULL OR "matchRank"<2)
    SELECT (SELECT count(*)::int FROM result_candidates) AS total,
      COALESCE((SELECT jsonb_agg(to_jsonb(page_rows)-ARRAY['matchRank','needRank','regionRank','ageRank','availabilityRank'])
        FROM (SELECT * FROM result_candidates ORDER BY "matchRank","needRank","regionRank","ageRank","availabilityRank",id LIMIT $8 OFFSET $9) page_rows),'[]'::jsonb) AS data`,
  [filters.category??null,q,id??null,filters.age??null,filters.region??null,filters.need??null,today,filters.limit,(filters.page-1)*filters.limit,categories?.length?categories:null,preferredNeeds??null,filters.recommendationReviewDays??null]);
  const row=result.rows[0];if(!row)throw new Error('Missing database result');
  return {data:row.data.map(p=>{
    const matching=evaluateMatch(p,filters,today);
    const benefitNeedsOfficialCheck=filters.recommendationReviewDays!==undefined&&p.category==='benefits'&&matching.status==='MATCH';
    return {...withProgramTranslation(p),matching:benefitNeedsOfficialCheck ?
      {status:'POSSIBLE' as const,checks:[...matching.checks,{code:'RULES_UNVERIFIED' as const,result:'missing' as const}]} : matching};
  }),pagination:{page:filters.page,limit:filters.limit,total:row.total,totalPages:Math.ceil(row.total/filters.limit)}};
}
