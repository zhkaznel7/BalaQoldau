import assert from 'node:assert/strict';
import { parseDatabaseEnvironment, parseTestDatabaseEnvironment } from '../../dist/db/config.js';
import { createDatabasePool } from '../../dist/db/pool.js';
import { runMigrations } from '../../dist/db/migrate.js';

// Local Stage 11 authorization is dev only. GitHub CI uses its existing isolated service.
// No inferred database names, fallback targets, or production connections.
export async function openUserDatabase() {
  const ci = process.env.GITHUB_ACTIONS === 'true' && process.env.CI === 'true';
  const expected = ci ? 'balaqoldau_test' : 'balaqoldau_dev';
  const config = ci ? parseTestDatabaseEnvironment(process.env) : parseDatabaseEnvironment({ ...process.env, NODE_ENV: 'development' });
  const url = new URL(config.DATABASE_URL);
  assert.equal(decodeURIComponent(url.pathname), '/' + expected, 'Unexpected Stage 11 database target');
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Local database required');
  const pool = createDatabasePool(config);
  try {
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, expected);
    const applied = await runMigrations(pool);
    assert.equal(await runMigrations(pool), 0, 'Migrations must be idempotent');
    console.log(`Verified ${expected}; ${applied} migration(s) applied; second run 0`);
    return { pool, config };
  } catch (error) { await pool.end(); throw error; }
}
