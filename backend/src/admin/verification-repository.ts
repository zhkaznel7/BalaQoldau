import type {Database} from '../api/repository.ts';
import type {z} from 'zod';
import type {programListInput} from './program-schemas.ts';
export const expiredSql=`COALESCE(p.deadline<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Almaty')::date OR p.expires_on<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Almaty')::date,false)`;
export const recheckSql=`(p.source_needs_recheck OR (p.status IN('verified','published') AND
  (p.verified_at IS NULL OR p.verified_at<clock_timestamp()-make_interval(days=>$1::int))))`;
export function adminFilters(filters:z.infer<typeof programListInput>,days:number){
 const q=filters.q?'%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%':null;
 return {sql:` WHERE ($2::text IS NULL OR p.status=$2) AND ($3::text IS NULL OR p.title ILIKE $3 OR p.description ILIKE $3 OR p.slug ILIKE $3)
  AND ($4::text IS NULL OR c.slug=$4) AND ($5::text IS NULL OR EXISTS(SELECT 1 FROM balaqoldau.program_regions pr JOIN balaqoldau.regions r ON r.id=pr.region_id WHERE pr.program_id=p.id AND r.slug=$5))
  AND ($6::date IS NULL OR p.verified_at>=($6::date::timestamp AT TIME ZONE 'Asia/Almaty'))
  AND ($7::date IS NULL OR p.verified_at<(($7::date+1)::timestamp AT TIME ZONE 'Asia/Almaty'))
  AND ($8::text IS NULL OR ($8='expired' AND ${expiredSql}) OR ($8='active' AND NOT ${expiredSql}))
  AND ($9::boolean IS NULL OR ${recheckSql})`,params:[days,filters.status??null,q,filters.category??null,filters.region??null,filters.verifiedFrom??null,filters.verifiedTo??null,filters.expiration??null,filters.needsReview?true:null]};
}
export async function verificationDashboard(db:Database,days:number){
 const counts=(await db.query(`SELECT count(*)::int AS total,
   count(*) FILTER(WHERE status='draft')::int AS draft,count(*) FILTER(WHERE status='review')::int AS review,
   count(*) FILTER(WHERE status='verified')::int AS verified,count(*) FILTER(WHERE status='published')::int AS published,
   count(*) FILTER(WHERE status='rejected')::int AS rejected,count(*) FILTER(WHERE status='archived')::int AS archived,
   count(*) FILTER(WHERE ${recheckSql})::int AS "needsReverification",count(*) FILTER(WHERE ${expiredSql})::int AS expired
   FROM balaqoldau.programs p`,[days])).rows[0];
 const recent=(await db.query(`SELECT id,title,status,version,updated_at AS "updatedAt" FROM balaqoldau.programs ORDER BY updated_at DESC,id LIMIT 10`)).rows;
 return {counts,recent,reviewPeriodDays:days};
}
export async function verificationHistory(db:Database,id:string,page:number,limit:number){
 const result=(await db.query<{total:number;data:unknown[]}>(`WITH entries AS(SELECT id,actor_id AS "actorId",program_version AS "programVersion",decision,
   source_reviewed AS "sourceReviewed",information_reviewed AS "informationReviewed",eligibility_reviewed AS "eligibilityReviewed",
   notes,source_url AS "sourceUrl",source_name AS "sourceName",created_at AS "createdAt" FROM balaqoldau.program_verifications WHERE program_id=$1)
   SELECT (SELECT count(*)::int FROM entries) AS total,COALESCE((SELECT json_agg(items) FROM(SELECT * FROM entries ORDER BY "createdAt" DESC,id LIMIT $2 OFFSET $3)items),'[]') AS data`,[id,limit,(page-1)*limit])).rows[0]!;
 return {data:result.data,pagination:{page,limit,total:result.total,totalPages:Math.ceil(result.total/limit)}};
}
