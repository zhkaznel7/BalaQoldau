import type { Pool } from 'pg';
import type { ContactInput, Pagination, ProgramFilters } from './schemas.ts';

export type Database = Pick<Pool, 'query'>;
interface Program {
  id: string; slug: string; category: string; title: string; description: string;
  sourceUrl: string; sourceName: string; verifiedAt: string; ageMin: number; ageMax: number;
  deadline: string | null; applyUrl: string | null; isDemo: false;
  regions: string[]; familyCategories: string[];
}
interface Taxonomy { id: string; slug: string; name: string }
export const programSelect = `SELECT p.id,p.slug,c.slug AS category,p.title,p.description,
  p.source_url AS "sourceUrl",p.source_name AS "sourceName",p.verified_at AS "verifiedAt",
  p.age_min AS "ageMin",p.age_max AS "ageMax",p.deadline::text AS deadline,
  p.apply_url AS "applyUrl",false AS "isDemo",
  ARRAY(SELECT r.slug FROM balaqoldau.program_regions pr JOIN balaqoldau.regions r ON r.id=pr.region_id
    WHERE pr.program_id=p.id ORDER BY r.slug) AS regions,
  ARRAY(SELECT f.slug FROM balaqoldau.program_family_categories pf JOIN balaqoldau.family_categories f ON f.id=pf.family_category_id
    WHERE pf.program_id=p.id ORDER BY f.slug) AS "familyCategories"
  FROM balaqoldau.published_programs p JOIN balaqoldau.categories c ON c.id=p.category_id`;

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
    programs(filters: ProgramFilters) {
      const pattern = filters.q ? `%${filters.q.replace(/[\\%_]/g, '\\$&')}%` : null;
      return paged<Program>(db, `${programSelect}
        WHERE ($1::text IS NULL OR c.slug=$1)
          AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM balaqoldau.program_regions pr
            JOIN balaqoldau.regions r ON r.id=pr.region_id WHERE pr.program_id=p.id AND r.slug=$2))
          AND ($3::int IS NULL OR $3 BETWEEN p.age_min AND p.age_max)
          AND ($4::text IS NULL OR p.title ILIKE $4 OR p.description ILIKE $4)`,
      [filters.category ?? null, filters.region ?? null, filters.age ?? null, pattern],
      { page: filters.page, limit: filters.limit });
    },
    async program(id: string) {
      const result = await db.query<Program>(`${programSelect} WHERE p.id=$1`, [id]);
      return result.rows[0];
    },
    categories(pagination: Pagination) {
      return paged<Taxonomy>(db, `SELECT c.id::text AS id,c.slug,c.name FROM balaqoldau.categories c
        WHERE EXISTS (SELECT 1 FROM balaqoldau.published_programs p WHERE p.category_id=c.id)`, [], pagination);
    },
    regions(pagination: Pagination) {
      return paged<Taxonomy>(db, `SELECT r.id::text AS id,r.slug,r.name FROM balaqoldau.regions r
        WHERE EXISTS (SELECT 1 FROM balaqoldau.program_regions pr JOIN balaqoldau.published_programs p
          ON p.id=pr.program_id WHERE pr.region_id=r.id)`, [], pagination);
    },
    async contact(input: ContactInput) {
      const result = await db.query<{ id: string }>(`INSERT INTO balaqoldau.contact_messages(sender_name,email,message)
        VALUES ($1,$2,$3) RETURNING id`, [input.senderName, input.email, input.message]);
      const row = result.rows[0];
      if (!row) throw new Error('Missing database result');
      return row;
    },
  };
}
