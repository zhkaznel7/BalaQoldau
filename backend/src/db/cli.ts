import { parseDatabaseEnvironment } from './config.ts';
import { createDatabasePool } from './pool.ts';
import { runMigrations } from './migrate.ts';
import { seedDemo } from './seed.ts';
import { assertJudgeTarget, seedJudgePrograms } from './judge-seed.ts';

const command = process.argv[2];
try {
  if (command !== 'migrate' && command !== 'seed' && command !== 'seed:judge') throw new Error('Invalid command');
  const config = parseDatabaseEnvironment(process.env);
  if (command === 'seed:judge') assertJudgeTarget(config);
  const pool = createDatabasePool(config);
  try {
    if (command === 'migrate') console.info(`Migrations applied: ${await runMigrations(pool)}`);
    else if (command === 'seed:judge') console.info(`Judge programs inserted: ${await seedJudgePrograms(pool)}`);
    else { await seedDemo(pool); console.info('DEMO seed complete'); }
  } finally { await pool.end(); }
} catch {
  console.error(command === 'seed:judge'
    ? 'Judge seed refused: check the dedicated local database, judge marker, migrations and catalog contents'
    : 'Database command failed: check configuration, database availability and migration history');
  process.exitCode = 1;
}
