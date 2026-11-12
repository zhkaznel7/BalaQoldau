import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseTestDatabaseEnvironment } from '../../dist/db/config.js';
import { createDatabasePool } from '../../dist/db/pool.js';
import { parseRetentionEnvironment } from '../../dist/retention/config.js';
import { cleanupContactBatch } from '../../dist/retention/cleanup.js';

test('retention on isolated test fixtures; every deletion is rolled back', async t => {
  const database = parseTestDatabaseEnvironment(process.env);
  const options = parseRetentionEnvironment({ RETENTION_DATABASE_URL: database.DATABASE_URL,
    RETENTION_EXPECTED_DATABASE: 'balaqoldau_test', RETENTION_BATCH_SIZE: '1' });
  const pool = createDatabasePool(database);
  const client = await pool.connect();
  try {
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'balaqoldau_test');
    assert.equal((await client.query('SELECT count(*)::int AS count FROM balaqoldau.contact_messages')).rows[0].count, 0,
      'Refuse to touch an existing test contact dataset');
    await client.query('BEGIN');
    const ids = {};
    for (const [key, days, micros] of [['newer', 29, 0], ['justNewer', 30, 1], ['boundary', 30, 0], ['justOlder', 30, -1], ['oldest', 60, 0]]) {
      ids[key] = randomUUID();
      await client.query(`INSERT INTO balaqoldau.contact_messages(id,sender_name,email,message,created_at)
        VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP-($5::integer*INTERVAL '24 hours')+($6::integer*INTERVAL '1 microsecond'))`,
      [ids[key], 'TEST retention fixture', 'test@example.com', 'TEST temporary fixture; rollback only', days, micros]);
    }
    const count = async () => (await client.query('SELECT count(*)::int AS count FROM balaqoldau.contact_messages')).rows[0].count;
    await t.test('dry-run preserves all fixtures and uses precise exclusive cutoff', async () => {
      const report = await cleanupContactBatch(client, options, 'dry-run');
      assert.equal(report.eligible, 2);
      assert.equal(report.wouldDelete, 1);
      assert.equal(report.deleted, 0);
      assert.equal(await count(), 5);
    });
    await t.test('a configured longer retention period changes eligibility', async () => {
      assert.equal((await cleanupContactBatch(client, { ...options, days: 35 }, 'dry-run')).eligible, 1);
      assert.equal(await count(), 5);
    });
    await t.test('execute enforces batch size, removes oldest first and is repeatable', async () => {
      assert.equal((await cleanupContactBatch(client, options, 'execute')).deleted, 1);
      assert.equal(await count(), 4);
      assert.equal((await client.query('SELECT count(*)::int AS count FROM balaqoldau.contact_messages WHERE id=$1', [ids.oldest])).rows[0].count, 0);
      assert.equal((await cleanupContactBatch(client, options, 'execute')).deleted, 1);
      assert.equal((await cleanupContactBatch(client, options, 'execute')).deleted, 0);
      assert.equal(await count(), 3);
    });
    await t.test('exact 30-day boundary and newer records remain', async () => {
      const result = await client.query('SELECT count(*)::int AS count FROM balaqoldau.contact_messages WHERE id=ANY($1::uuid[])', [[ids.newer, ids.justNewer, ids.boundary]]);
      assert.equal(result.rows[0].count, 3);
    });
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});

test('CLI dry-run against verified test database reports counts without personal data', () => {
  const database = parseTestDatabaseEnvironment(process.env);
  assert.equal(decodeURIComponent(new URL(database.DATABASE_URL).pathname), '/balaqoldau_test');
  const child = spawnSync(process.execPath, ['dist/retention/cli.js', '--dry-run'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, NODE_ENV: 'test', RETENTION_DATABASE_URL: database.DATABASE_URL,
      RETENTION_EXPECTED_DATABASE: 'balaqoldau_test', RETENTION_DAYS: '30', RETENTION_BATCH_SIZE: '100' },
  });
  assert.equal(child.status, 0, 'dry-run must succeed without printing connection details');
  const summary = JSON.parse(child.stdout);
  assert.equal(summary.mode, 'dry-run');
  assert.equal(summary.deleted, 0);
  assert.deepEqual(Object.keys(summary).sort(), ['batchSize', 'deleted', 'eligible', 'mode', 'retentionDays', 'wouldDelete']);
});
