import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseRetentionEnvironment, parseRetentionMode } from '../dist/retention/config.js';
import { cleanupContactBatch } from '../dist/retention/cleanup.js';

const valid = { RETENTION_DATABASE_URL: 'postgresql://test@127.0.0.1:5432/balaqoldau_test', RETENTION_EXPECTED_DATABASE: 'balaqoldau_test' };
test('retention defaults are bounded; execution mode is always explicit', () => {
  const config = parseRetentionEnvironment(valid);
  assert.equal(config.days, 30);
  assert.equal(config.batchSize, 100);
  assert.equal(parseRetentionMode(['--dry-run']), 'dry-run');
  assert.equal(parseRetentionMode(['--execute']), 'execute');
  for (const args of [[], ['--force'], ['--execute', '--dry-run'], ['--execute', '--execute']]) assert.throws(() => parseRetentionMode(args));
});
test('unsafe retention values or database targets are rejected without echo', () => {
  for (const changes of [
    { RETENTION_DAYS: '0' }, { RETENTION_DAYS: '29' }, { RETENTION_DAYS: '366' }, { RETENTION_DAYS: '30.5' },
    { RETENTION_BATCH_SIZE: '0' }, { RETENTION_BATCH_SIZE: '1001' }, { RETENTION_BATCH_SIZE: '-1' },
    { RETENTION_DATABASE_URL: undefined }, { RETENTION_EXPECTED_DATABASE: undefined },
    { RETENTION_EXPECTED_DATABASE: 'balaqoldau_dev' },
    { RETENTION_DATABASE_URL: 'private-secret' },
    { RETENTION_DATABASE_URL: 'postgresql://test@localhost/balaqoldau_db', RETENTION_EXPECTED_DATABASE: 'balaqoldau_db' },
  ]) assert.throws(() => parseRetentionEnvironment({ ...valid, ...changes }), error => {
    assert.equal(error.message.includes('private-secret'), false);
    return true;
  });
});
test('dry-run binds cutoff and reports bounded counts without issuing DELETE', async () => {
  const calls = [];
  const config = parseRetentionEnvironment({ ...valid, RETENTION_BATCH_SIZE: '2' });
  const db = { query: async (sql, values) => {
    calls.push({ sql, values });
    return sql.includes('current_database') ? { rows: [{ database: 'balaqoldau_test', cutoff: '2026-10-13 00:00:00.123456+00' }] } : { rows: [{ count: '5' }] };
  } };
  assert.deepEqual(await cleanupContactBatch(db, config, 'dry-run'), { mode: 'dry-run', retentionDays: 30, batchSize: 2, eligible: 5, wouldDelete: 2, deleted: 0 });
  assert.equal(calls.some(call => /DELETE/i.test(call.sql)), false);
  assert.deepEqual(calls[0].values, [30]);
  assert.deepEqual(calls[1].values, ['2026-10-13 00:00:00.123456+00']);
});
test('actual database identity mismatch stops before counting or deleting', async () => {
  let calls = 0;
  await assert.rejects(cleanupContactBatch({ query: async () => { calls++; return { rows: [{ database: 'unrelated', cutoff: '2026-10-13 00:00:00+00' }] }; } }, parseRetentionEnvironment(valid), 'execute'));
  assert.equal(calls, 1);
});
test('CLI requires a mode and uses generic failure output', () => {
  const child = spawnSync(process.execPath, ['dist/retention/cli.js'], { encoding: 'utf8', timeout: 5000,
    env: { ...process.env, RETENTION_DATABASE_URL: 'private-secret' } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr.includes('private-secret'), false);
  assert.equal(child.stderr.includes(' at '), false);
});

test('a concurrent execution lock refusal stops before DELETE', async () => {
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    return sql.includes('current_database') ? { rows: [{ database: 'balaqoldau_test', cutoff: '2026-10-13T00:00:00.000000Z' }] } : { rows: [{ acquired: false }] };
  } };
  await assert.rejects(cleanupContactBatch(client, parseRetentionEnvironment(valid), 'execute'));
  assert.equal(calls.some(sql => /DELETE/i.test(sql)), false);
});

test('invalid direct-call options are rejected before accessing the database', async () => {
  let calls = 0;
  const client = { query: async () => { calls++; } };
  await assert.rejects(cleanupContactBatch(client, { expectedDatabase: 'balaqoldau_test', days: 0, batchSize: 100 }, 'execute'));
  await assert.rejects(cleanupContactBatch(client, { expectedDatabase: 'balaqoldau_test', days: 30, batchSize: 1001 }, 'execute'));
  await assert.rejects(cleanupContactBatch(client, parseRetentionEnvironment(valid), 'force'));
  assert.equal(calls, 0);
});

test('unavailable database fails safely in dry-run mode', () => {
  const child = spawnSync(process.execPath, ['dist/retention/cli.js', '--dry-run'], { encoding: 'utf8', timeout: 6000,
    env: { ...process.env, NODE_ENV: 'test', DB_SSL_MODE: 'disable', ...valid,
      RETENTION_DATABASE_URL: 'postgresql://test@127.0.0.1:1/balaqoldau_test' } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr.includes('postgresql:'), false);
  assert.equal(child.stderr.includes(' at '), false);
});
