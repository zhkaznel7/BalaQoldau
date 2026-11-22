import type {Pool} from 'pg';
import type {DatabaseConfig} from './config.ts';
import {transaction} from './pool.ts';

const databaseName = 'balaqoldau_judge';
const marker = 'BalaQoldau disposable judge database';
const checkedOn = '2026-11-23T12:00:00+05:00';
const samples = [
  {
    slug: 'judge-birth-allowance',
    title: 'Бала тууына байланысты біржолғы мемлекеттік жәрдемақы',
    description: 'Бала туған кезде біржолғы мемлекеттік жәрдемақы қарастырылған. Өтініш беру тәртібі мен қолданыстағы талаптарды eGov порталынан тексеріңіз.',
    ageMax: 0,
  },
  {
    slug: 'judge-childcare-allowance',
    title: 'Бала күтіміне байланысты ай сайынғы мемлекеттік жәрдемақы',
    description: 'Міндетті әлеуметтік сақтандыру жүйесіне қатыспайтын бала күтушілерге бала бір жарым жасқа толғанға дейін ай сайынғы мемлекеттік жәрдемақы қарастырылған. Нақты талаптарды eGov порталынан тексеріңіз.',
    ageMax: 1,
  },
] as const;
const sourceUrl = 'https://egov.kz/cms/kk/articles/child/ui_decret';

function invalidTarget(): never {
  throw new Error('A marked, dedicated judge database is required');
}

export function assertJudgeTarget(config: Pick<DatabaseConfig, 'DATABASE_URL'|'NODE_ENV'>): void {
  const url = new URL(config.DATABASE_URL);
  if (config.NODE_ENV === 'production' || decodeURIComponent(url.pathname) !== '/' + databaseName ||
    !['localhost', '127.0.0.1', '[::1]', 'judge-db'].includes(url.hostname)) invalidTarget();
}

export async function seedJudgePrograms(pool: Pool): Promise<number> {
  return transaction(pool, async db => {
    const identity = (await db.query<{name:string; marker:string|null}>(`SELECT current_database() AS name,
      shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname=current_database()`)).rows[0];
    if (identity?.name !== databaseName || identity.marker !== marker) invalidTarget();
    await db.query('SELECT pg_advisory_xact_lock($1)', [73402831]);
    const existing = (await db.query<{slug:string}>('SELECT slug FROM balaqoldau.programs')).rows;
    if (existing.length === samples.length && samples.every(sample => existing.some(row => row.slug === sample.slug))) return 0;
    if (existing.length) throw new Error('Judge catalog must be empty before the initial seed');
    for (const sample of samples) {
      const result = await db.query<{id:string}>(`INSERT INTO balaqoldau.programs
        (slug, category_id, title, description, status, source_url, source_name, verified_at, age_min, age_max, eligibility_complete)
        SELECT $1, id, $2, $3, 'published', $4, 'eGov.kz', $5, 0, $6, false
        FROM balaqoldau.categories WHERE slug='benefits' RETURNING id`,
      [sample.slug, sample.title, sample.description, sourceUrl, checkedOn, sample.ageMax]);
      const program = result.rows[0];
      if (!program) throw new Error('Run judge database migrations first');
      const linked = await db.query(`INSERT INTO balaqoldau.program_regions(program_id, region_id)
        SELECT $1, id FROM balaqoldau.regions WHERE slug !~* '^demo(-|$)' AND name !~* '^DEMO'`, [program.id]);
      if (linked.rowCount !== 20) throw new Error('Expected the 20 Kazakhstan reference regions');
    }
    return samples.length;
  });
}
