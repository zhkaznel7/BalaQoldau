import { parseDatabaseEnvironment } from './config.ts';
import { createDatabasePool } from './pool.ts';
import { runMigrations } from './migrate.ts';
import { seedDemo } from './seed.ts';

const command = process.argv[2];
try {
  if (command !== 'migrate' && command !== 'seed') throw new Error('Invalid command');
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    if (command === 'migrate') console.info(`Migrations applied: ${await runMigrations(pool)}`);
    else { await seedDemo(pool); console.info('DEMO seed complete'); }
  } finally { await pool.end(); }
} catch {
  console.error('Database command failed: check configuration, database availability and migration history');
  process.exitCode = 1;
}
