import type { Pool } from 'pg';
import { transaction } from './pool.ts';

export async function seedDemo(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [73402831]);
    // Separate DEMO taxonomy; never overwrite real catalogue records.
    for (const sql of [
      'INSERT INTO balaqoldau.categories(slug,name) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING',
      'INSERT INTO balaqoldau.regions(slug,name) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING',
      'INSERT INTO balaqoldau.family_categories(slug,name) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING',
    ]) await client.query(sql, ['demo-example', 'DEMO — ойдан шығарылған үлгі']);
    for (const slug of ['demo-learning', 'demo-creative']) {
      await client.query(`INSERT INTO balaqoldau.programs
        (slug,category_id,title,description,is_demo,status,source_url,source_name,apply_url,age_min,age_max)
        SELECT $1,id,$2,$3,true,'draft',$4,$5,$6,0,17
        FROM balaqoldau.categories WHERE slug=$7 ON CONFLICT (slug) DO NOTHING`, [
        slug, `DEMO — ${slug}`, 'Ойдан шығарылған көрсетілім үлгісі. Нақты мемлекеттік бағдарлама емес. Өтінім қабылданбайды.',
        'https://example.com/demo/source', 'DEMO — example.com, ресми дереккөз емес', 'https://example.com/demo/apply', 'demo-example',
      ]);
      await client.query(`INSERT INTO balaqoldau.program_regions(program_id,region_id)
        SELECT p.id,r.id FROM balaqoldau.programs p CROSS JOIN balaqoldau.regions r
        WHERE p.slug=$1 AND p.is_demo AND r.slug=$2 ON CONFLICT DO NOTHING`, [slug, 'demo-example']);
      await client.query(`INSERT INTO balaqoldau.program_family_categories(program_id,family_category_id)
        SELECT p.id,f.id FROM balaqoldau.programs p CROSS JOIN balaqoldau.family_categories f
        WHERE p.slug=$1 AND p.is_demo AND f.slug=$2 ON CONFLICT DO NOTHING`, [slug, 'demo-example']);
    }
  });
}
