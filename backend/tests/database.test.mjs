import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabaseEnvironment, parseTestDatabaseEnvironment } from '../dist/db/config.js';
import { createDatabasePool } from '../dist/db/pool.js';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

const url = 'postgresql://demo@localhost:5432/balaqoldau';
test('database configuration is required only when using the database layer', () => {
  assert.throws(() => parseDatabaseEnvironment({}), /Invalid database configuration/);
  assert.equal(parseDatabaseEnvironment({ DATABASE_URL: url }).DATABASE_URL, url);
});
for (const value of ['', 'https://example.com/db', 'postgresql://localhost', url + '?sslmode=disable', url + '#fragment']) {
  test(`rejects invalid database URL without echoing it: ${value ? 'nonempty' : 'empty'}`, () => {
    assert.throws(() => parseDatabaseEnvironment({ DATABASE_URL: value }), error => {
      assert.equal(error.message, 'Invalid database configuration');
      return true;
    });
  });
}
test('production requires certificate verification; URL options cannot override TLS', () => {
  const config = parseDatabaseEnvironment({ DATABASE_URL: url, NODE_ENV: 'production' });
  assert.equal(config.DB_SSL_MODE, 'verify-full');
  assert.throws(() => parseDatabaseEnvironment({ DATABASE_URL: url, NODE_ENV: 'production', DB_SSL_MODE: 'disable' }));
});
test('pool is bounded, uses timeouts and strict TLS without opening a connection', async () => {
  const pool = createDatabasePool(parseDatabaseEnvironment({ DATABASE_URL: url, NODE_ENV: 'production' }));
  try {
    assert.equal(pool.options.max, 5);
    assert.equal(pool.options.connectionTimeoutMillis, 3000);
    assert.deepEqual(pool.options.ssl, { rejectUnauthorized: true });
  } finally { await pool.end(); }
});
test('integration tests require an explicit dedicated database distinct from application DB', () => {
  assert.throws(() => parseTestDatabaseEnvironment({}));
  assert.throws(() => parseTestDatabaseEnvironment({ TEST_DATABASE_URL: url }));
  assert.throws(() => parseTestDatabaseEnvironment({ TEST_DATABASE_URL: url + '_test', DATABASE_URL: url + '_test' }));
  assert.throws(() => parseTestDatabaseEnvironment({ TEST_DATABASE_URL: url + '_test', DATABASE_URL: 'not-a-url' }), /Invalid database configuration/);
  assert.equal(parseTestDatabaseEnvironment({ TEST_DATABASE_URL: url + '_test' }).NODE_ENV, 'test');
});
test('database command fails safely when configuration is absent', () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const result = spawnSync(process.execPath, ['dist/db/cli.js', 'migrate'], { env, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Database command failed/);
  assert.equal(result.stderr.includes(' at '), false);
});
test('unavailable PostgreSQL fails within timeout without leaking connection details', async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const result = spawnSync(process.execPath, ['dist/db/cli.js', 'migrate'], {
    env: { ...process.env, NODE_ENV: 'test', DB_SSL_MODE: 'disable', DATABASE_URL: `postgresql://private-test-user@127.0.0.1:${port}/unavailable_test` },
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Database command failed/);
  assert.equal(result.stderr.includes('private-test-user'), false);
  assert.equal(result.stderr.includes(' at '), false);
});
