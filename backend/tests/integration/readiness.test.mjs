import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseTestDatabaseEnvironment } from '../../dist/db/config.js';
import { createDatabasePool } from '../../dist/db/pool.js';
import { createReadinessCheck } from '../../dist/db/readiness.js';
import { createApp } from '../../dist/app.js';
import { parseEnvironment } from '../../dist/config/env.js';

test('real dedicated PostgreSQL readiness is 200; an ended pool is safely 503', async () => {
  const database = parseTestDatabaseEnvironment(process.env);
  const pool = createDatabasePool(database);
  let server;
  try {
    const identity = await pool.query('SELECT current_database() AS name');
    assert.equal(identity.rows[0].name, 'balaqoldau_test');
    const config = parseEnvironment({ NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'https://example.kz' });
    server = createApp(config, pool, createReadinessCheck(pool)).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const ready = await fetch(base + '/api/ready');
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: 'ready' });
    await pool.end();
    const unavailable = await fetch(base + '/api/ready');
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: { code: 'NOT_READY', message: 'Service is not ready.' } });
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), { status: 'ok' });
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (!pool.ended) await pool.end();
  }
});

test('an unreachable PostgreSQL connection produces a safe bounded HTTP 503', async () => {
  const config = parseTestDatabaseEnvironment(process.env);
  assert.equal(decodeURIComponent(new URL(config.DATABASE_URL).pathname), '/balaqoldau_test');
  const unreachable = new URL(config.DATABASE_URL);
  unreachable.hostname = '127.0.0.1';
  unreachable.port = '1';
  const pool = createDatabasePool({ ...config, DATABASE_URL: unreachable.href });
  const appConfig = parseEnvironment({ NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'https://example.kz' });
  const server = createApp(appConfig, pool, createReadinessCheck(pool)).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const began = Date.now();
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ready`);
    assert.equal(response.status, 503);
    assert.ok(Date.now() - began < 4000);
    assert.deepEqual(await response.json(), { error: { code: 'NOT_READY', message: 'Service is not ready.' } });
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await pool.end();
  }
});
