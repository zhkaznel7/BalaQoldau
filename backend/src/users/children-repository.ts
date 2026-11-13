import type {Database} from '../api/repository.ts';
import {userTokenHash} from './repository.ts';
import type {ChildInput} from './children-schemas.ts';

export interface Child extends ChildInput {id:string;version:number}
const active=`SELECT u.id FROM balaqoldau.user_sessions s JOIN balaqoldau.user_accounts u ON u.id=s.user_id
  WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp() AND NOT u.disabled AND s.credential_version=u.credential_version`;
const childFields=`c.id,c.nickname,c.age,r.slug AS region,c.version,
  ARRAY(SELECT k.slug FROM balaqoldau.child_preferences pref JOIN balaqoldau.categories k ON k.id=pref.category_id
    WHERE pref.child_id=c.id ORDER BY k.slug) AS preferences`;
interface State {authorized:boolean;owned:boolean;valid:boolean;data:Child|null}
export function childrenRepository(db:Database){
  return {
    async list(token:string){
      return (await db.query<{authorized:boolean;data:Child[]}>(`WITH active AS (${active})
        SELECT EXISTS(SELECT 1 FROM active) AS authorized,COALESCE((SELECT json_agg(items) FROM
          (SELECT ${childFields} FROM balaqoldau.child_profiles c JOIN balaqoldau.regions r ON r.id=c.region_id
            WHERE c.user_id IN(SELECT id FROM active) ORDER BY c.created_at,c.id LIMIT 20) items),'[]') AS data`,[userTokenHash(token)])).rows[0];
    },
    async one(token:string,id:string){
      return (await db.query<{authorized:boolean;data:Child|null}>(`WITH active AS (${active}) SELECT EXISTS(SELECT 1 FROM active) AS authorized,
        (SELECT row_to_json(item) FROM (SELECT ${childFields} FROM balaqoldau.child_profiles c JOIN balaqoldau.regions r ON r.id=c.region_id
          WHERE c.id=$2 AND c.user_id IN(SELECT id FROM active)) item) AS data`,[userTokenHash(token),id])).rows[0];
    },
    async options(token:string){
      return (await db.query<{authorized:boolean;regions:{slug:string;name:string}[];categories:{slug:string;name:string}[]}>(`WITH active AS (${active})
        SELECT EXISTS(SELECT 1 FROM active) AS authorized,
        COALESCE((SELECT json_agg(items) FROM (SELECT slug,name FROM balaqoldau.regions WHERE EXISTS(SELECT 1 FROM active) AND slug !~* '^demo(-|$)' AND name !~* '^DEMO' ORDER BY name,slug LIMIT 1001)items),'[]') AS regions,
        COALESCE((SELECT json_agg(items) FROM (SELECT slug,name FROM balaqoldau.categories WHERE EXISTS(SELECT 1 FROM active) ORDER BY name,slug LIMIT 1001)items),'[]') AS categories`,[userTokenHash(token)])).rows[0];
    },
    async write(token:string,input:ChildInput,id?:string,version?:number){
      // A unique (user_id,slot), with slot 1..20, makes the quota safe even for concurrent inserts.
      // Existing preferences are retained; only removed selections are deleted.
      return (await db.query<State>(`WITH active AS MATERIALIZED (${active} FOR SHARE OF u),
        owned AS (SELECT c.id FROM balaqoldau.child_profiles c WHERE c.id=$6::uuid AND c.user_id IN(SELECT id FROM active)),
        region AS (SELECT id FROM balaqoldau.regions WHERE slug=$4 AND slug !~* '^demo(-|$)' AND name !~* '^DEMO'),
        categories AS (SELECT id,slug FROM balaqoldau.categories WHERE slug=ANY($5::text[])),
        valid AS (SELECT EXISTS(SELECT 1 FROM region) AND (SELECT count(*) FROM categories)=cardinality($5::text[]) AS ok),
        free AS (SELECT n FROM generate_series(1,20) n WHERE NOT EXISTS(SELECT 1 FROM balaqoldau.child_profiles c
          WHERE c.user_id IN(SELECT id FROM active) AND c.slot=n) ORDER BY n LIMIT 1),
        created AS (INSERT INTO balaqoldau.child_profiles(user_id,slot,nickname,age,region_id)
          SELECT a.id,f.n,$2,$3,r.id FROM active a,free f,region r,valid v WHERE v.ok AND $6::uuid IS NULL
          ON CONFLICT(user_id,slot) DO NOTHING RETURNING id,nickname,age,version),
        edited AS (UPDATE balaqoldau.child_profiles c SET nickname=$2,age=$3,region_id=r.id,version=c.version+1,updated_at=clock_timestamp()
          FROM region r,valid v WHERE v.ok AND c.id=$6::uuid AND c.version=$7::int AND c.user_id IN(SELECT id FROM active)
          RETURNING c.id,c.nickname,c.age,c.version),
        changed AS (SELECT * FROM created UNION ALL SELECT * FROM edited),
        removed AS (DELETE FROM balaqoldau.child_preferences WHERE child_id IN(SELECT id FROM changed)
          AND category_id NOT IN(SELECT id FROM categories) RETURNING child_id),
        added AS (INSERT INTO balaqoldau.child_preferences(child_id,category_id) SELECT c.id,k.id FROM changed c,categories k
          ON CONFLICT(child_id,category_id) DO NOTHING RETURNING child_id)
        SELECT EXISTS(SELECT 1 FROM active) AS authorized,EXISTS(SELECT 1 FROM owned) AS owned,(SELECT ok FROM valid) AS valid,
          (SELECT row_to_json(item) FROM (SELECT changed.*,$4::text AS region,$5::text[] AS preferences FROM changed)item) AS data`,
      [userTokenHash(token),input.nickname,input.age,input.region,[...input.preferences].sort(),id??null,version??null])).rows[0];
    },
    async remove(token:string,id:string,version:number){
      return (await db.query<{authorized:boolean;owned:boolean;removed:boolean}>(`WITH active AS MATERIALIZED (${active} FOR SHARE OF u),
        owned AS (SELECT id FROM balaqoldau.child_profiles WHERE id=$2 AND user_id IN(SELECT id FROM active)),
        removed AS (DELETE FROM balaqoldau.child_profiles WHERE id=$2 AND version=$3 AND user_id IN(SELECT id FROM active) RETURNING id)
        SELECT EXISTS(SELECT 1 FROM active) AS authorized,EXISTS(SELECT 1 FROM owned) AS owned,EXISTS(SELECT 1 FROM removed) AS removed`,[userTokenHash(token),id,version])).rows[0];
    },
  };
}
