import type { Database } from '../api/repository.ts';
import { programSelect } from '../api/repository.ts';
import { userTokenHash } from './repository.ts';
import type { ProfileInput } from './dashboard-schemas.ts';
import type { Pagination } from '../api/schemas.ts';

// Every statement derives ownership from a fresh active session, never a client-supplied user ID.
const active = `SELECT u.id,u.email,u.language,u.full_name,u.location,u.family_context FROM balaqoldau.user_sessions s
  JOIN balaqoldau.user_accounts u ON u.id=s.user_id WHERE s.token_hash=$1
  AND s.expires_at>clock_timestamp() AND NOT u.disabled AND s.credential_version=u.credential_version`;
const count = `(SELECT count(*)::int FROM balaqoldau.user_saved_programs saved
  JOIN balaqoldau.published_programs p ON p.id=saved.program_id WHERE saved.user_id=u.id)`;
const fields = `u.id,u.email,u.language,u.full_name AS "fullName",u.location,u.family_context AS "familyContext",${count} AS "savedCount"`;
export interface DashboardProfile {id:string;email:string;language:'kk'|'ru';fullName:string|null;location:string|null;savedCount:number;familyContext:ProfileInput['familyContext']}
export function dashboardRepository(db:Database) {
  return {
    async profile(token:string) {
      return (await db.query<DashboardProfile>(`WITH active AS (${active}) SELECT ${fields} FROM active u`,[userTokenHash(token)])).rows[0];
    },
    async update(token:string,input:ProfileInput) {
      return (await db.query<DashboardProfile>(`WITH active AS MATERIALIZED (${active} FOR UPDATE OF u),
        changed AS (UPDATE balaqoldau.user_accounts u SET full_name=$2,location=$3,family_context=CASE WHEN $5 THEN $4::jsonb ELSE u.family_context END FROM active a WHERE u.id=a.id RETURNING u.*)
        SELECT ${fields} FROM changed u`,[userTokenHash(token),input.fullName,input.location,input.familyContext==null?null:JSON.stringify(input.familyContext),input.familyContext!==undefined])).rows[0];
    },
    async saved(token:string,pagination:Pagination) {
      return (await db.query<{authorized:boolean;data:unknown[];total:number}>(`WITH active AS MATERIALIZED (${active}),
        filtered AS (${programSelect} JOIN balaqoldau.user_saved_programs saved ON saved.program_id=p.id
          WHERE saved.user_id IN(SELECT id FROM active))
        SELECT EXISTS(SELECT 1 FROM active) AS authorized,(SELECT count(*)::int FROM filtered) AS total,
        COALESCE((SELECT json_agg(page) FROM (SELECT * FROM filtered ORDER BY id LIMIT $2 OFFSET $3) page),'[]') AS data`,
      [userTokenHash(token),pagination.limit,(pagination.page-1)*pagination.limit])).rows[0];
    },
    async status(token:string,ids:string[]) {
      return (await db.query<{authorized:boolean;ids:string[]}>(`WITH active AS (${active})
        SELECT EXISTS(SELECT 1 FROM active) AS authorized,COALESCE((SELECT array_agg(saved.program_id ORDER BY saved.program_id)
          FROM balaqoldau.user_saved_programs saved JOIN balaqoldau.published_programs p ON p.id=saved.program_id
          WHERE saved.user_id IN(SELECT id FROM active) AND saved.program_id=ANY($2::uuid[])),ARRAY[]::uuid[]) AS ids`,
      [userTokenHash(token),ids])).rows[0];
    },
    async save(token:string,id:string) {
      return (await db.query<{authorized:boolean;available:boolean}>(`WITH active AS MATERIALIZED (${active} FOR SHARE OF u),
        eligible AS MATERIALIZED (SELECT id FROM balaqoldau.published_programs WHERE id=$2),
        saved AS (INSERT INTO balaqoldau.user_saved_programs(user_id,program_id)
          SELECT a.id,p.id FROM active a,eligible p ON CONFLICT(user_id,program_id) DO NOTHING RETURNING program_id)
        SELECT EXISTS(SELECT 1 FROM active) AS authorized,EXISTS(SELECT 1 FROM eligible) AS available`,[userTokenHash(token),id])).rows[0];
    },
    async remove(token:string,id:string) {
      return (await db.query<{authorized:boolean}>(`WITH active AS MATERIALIZED (${active} FOR SHARE OF u),
        removed AS (DELETE FROM balaqoldau.user_saved_programs WHERE user_id IN(SELECT id FROM active) AND program_id=$2 RETURNING program_id)
        SELECT EXISTS(SELECT 1 FROM active) AS authorized`,[userTokenHash(token),id])).rows[0];
    },
  };
}
