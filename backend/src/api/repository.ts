import type { Pool } from 'pg';
import type { ContactInput, Pagination, ProgramFilters } from './schemas.ts';
import {createHash} from 'node:crypto';
import {HttpError} from '../middleware/errors.ts';
import {withProgramTranslation} from './program-translations.ts';
import {publicCategorySql} from './public-categories.ts';

export type Database = Pick<Pool, 'query'>;
export interface Program {
  id: string; slug: string; category: string; title: string; description: string;
  sourceUrl: string; sourceName: string; verifiedAt: string; ageMin: number; ageMax: number;
  deadline: string | null; applyUrl: string | null; isDemo: false;
  regions: string[]; familyCategories: string[]; eligibilityComplete?:boolean;
}
interface Taxonomy { id: string; slug: string; name: string }
// The view excludes is_demo regardless of status. Also exclude legacy test taxonomy and markers.
export const publicProgramSource = `balaqoldau.published_programs p
  JOIN balaqoldau.categories c ON c.id=p.category_id AND c.slug IN (${publicCategorySql})
    AND c.name !~* '^DEMO' AND p.slug !~* '^demo(-|$)' AND p.title !~* '^demo([[:space:][:punct:]]|$)'`;
export const publicProgramIds = `SELECT p.id FROM ${publicProgramSource}`;
export const programSelect = `SELECT p.id,p.slug,c.slug AS category,p.title,p.description,
  p.source_url AS "sourceUrl",p.source_name AS "sourceName",p.verified_at AS "verifiedAt",
  p.age_min AS "ageMin",p.age_max AS "ageMax",p.deadline::text AS deadline,
  p.apply_url AS "applyUrl",false AS "isDemo",p.eligibility_complete AS "eligibilityComplete",
  ARRAY(SELECT r.slug FROM balaqoldau.program_regions pr JOIN balaqoldau.regions r ON r.id=pr.region_id
    WHERE pr.program_id=p.id AND r.slug !~* '^demo(-|$)' AND r.name !~* '^DEMO' ORDER BY r.slug) AS regions,
  ARRAY(SELECT f.slug FROM balaqoldau.program_family_categories pf JOIN balaqoldau.family_categories f ON f.id=pf.family_category_id
    WHERE pf.program_id=p.id AND f.slug !~* '^demo(-|$)' AND f.name !~* '^DEMO' ORDER BY f.slug) AS "familyCategories"
  FROM ${publicProgramSource}`;

async function paged<T>(db: Database, select: string, values: unknown[], pagination: Pagination) {
  // select and placeholder numbers are internal constants; user input is only in values.
  const result = await db.query<{ total: number; data: T[] }>(`WITH filtered AS (${select})
    SELECT (SELECT count(*)::int FROM filtered) AS total,
      COALESCE((SELECT json_agg(page_rows) FROM
        (SELECT * FROM filtered ORDER BY id LIMIT $${values.length + 1} OFFSET $${values.length + 2}) page_rows), '[]'::json) AS data`,
  [...values, pagination.limit, (pagination.page - 1) * pagination.limit]);
  const row = result.rows[0];
  if (!row) throw new Error('Missing database result');
  return { data: row.data, pagination: { ...pagination, total: row.total, totalPages: Math.ceil(row.total / pagination.limit) } };
}

export function createRepository(db: Database) {
  return {
    async programs(filters: ProgramFilters) {
      const pattern = filters.q ? `%${filters.q.replace(/[\\%_]/g, '\\$&')}%` : null;
      const result = await paged<Program>(db, `${programSelect}
        WHERE ($1::text IS NULL OR c.slug=$1)
          AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM balaqoldau.program_regions pr
            JOIN balaqoldau.regions r ON r.id=pr.region_id WHERE pr.program_id=p.id AND r.slug=$2
              AND r.slug !~* '^demo(-|$)' AND r.name !~* '^DEMO'))
          AND ($3::int IS NULL OR $3 BETWEEN p.age_min AND p.age_max)
          AND ($4::text IS NULL OR p.title ILIKE $4 OR p.description ILIKE $4)`,
      [filters.category ?? null, filters.region ?? null, filters.age ?? null, pattern],
      { page: filters.page, limit: filters.limit });
      return {...result, data: result.data.map(withProgramTranslation)};
    },
    async program(id: string) {
      const result = await db.query<Program>(`${programSelect} WHERE p.id=$1`, [id]);
      const row = result.rows[0];
      return row && withProgramTranslation(row);
    },
    categories(pagination: Pagination) {
      return paged<Taxonomy>(db, `SELECT c.id::text AS id,c.slug,c.name FROM balaqoldau.categories c
        WHERE c.slug IN (${publicCategorySql}) AND c.name !~* '^DEMO'`, [], pagination);
    },
    regions(pagination: Pagination) {
      return paged<Taxonomy>(db, `SELECT r.id::text AS id,r.slug,r.name FROM balaqoldau.regions r
        WHERE r.slug !~* '^demo(-|$)' AND r.name !~* '^DEMO' AND (r.slug IN
          ('abay','akmola','aktobe','almaty-region','atyrau','west-kazakhstan','zhambyl','zhetisu','karaganda','kostanay','kyzylorda','mangystau','pavlodar','north-kazakhstan','turkistan','ulytau','east-kazakhstan','astana','almaty-city','shymkent')
          OR EXISTS (SELECT 1 FROM balaqoldau.program_regions pr JOIN (${publicProgramIds}) p
          ON p.id=pr.program_id WHERE pr.region_id=r.id))`, [], pagination);
    },
    familyCategories(pagination:Pagination){
      return paged<Taxonomy>(db,`SELECT f.id::text AS id,f.slug,f.name FROM balaqoldau.family_categories f
        WHERE f.slug !~* '^demo(-|$)' AND f.name !~* '^DEMO' AND (f.slug IN ('education-support','creative-development','sports-activities')
          OR EXISTS(SELECT 1 FROM balaqoldau.program_family_categories pf JOIN (${publicProgramIds}) p
          ON p.id=pf.program_id WHERE pf.family_category_id=f.id))`,[],pagination);
    },
    async contact(input: ContactInput,userId:string|null=null) {
      const digest=input.submissionId?createHash('sha256').update(JSON.stringify([input.senderName,input.email,input.message])).digest('hex'):null;
      const result = await db.query<{ id: string }>(`INSERT INTO balaqoldau.contact_messages(sender_name,email,message,submission_id,submission_digest,user_id)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(submission_id) DO NOTHING RETURNING id`, [input.senderName, input.email, input.message,input.submissionId??null,digest,userId]);
      const row = result.rows[0];
      if(!row&&input.submissionId){
        const existing=(await db.query<{id:string}>('SELECT id FROM balaqoldau.contact_messages WHERE submission_id=$1 AND submission_digest=$2 AND user_id IS NOT DISTINCT FROM $3',[input.submissionId,digest,userId])).rows[0];
        if(existing)return existing;throw new HttpError(409,'CONTACT_CONFLICT','Submission identifier cannot be reused.');
      }
      if (!row) throw new Error('Missing database result');
      return row;
    },
  };
}
