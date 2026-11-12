import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../dist/lifecycle.js';
import { parseEnvironment } from '../dist/config/env.js';

const config = { ...parseEnvironment({ CORS_ALLOWED_ORIGINS: 'https://example.kz' }), PORT: 0 };
function fakePool(fail = false) {
  const state = { ends: 0, connects: 0 };
  const pool = {
    connect: async () => { state.connects++; if (fail) throw new Error('private-password'); return { query: async () => {}, release: () => {} }; },
    query: async () => ({ rows: [] }),
    end: async () => { state.ends++; },
  };
  return { pool, state };
}
test('production probes before listening, and shuts down HTTP/pool exactly once', async t => {
  const { pool, state } = fakePool();
  const runtime = await startServer({ ...config, NODE_ENV: 'production' }, pool);
  t.after(() => runtime.shutdown());
  assert.equal(state.connects, 1);
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal(state.connects, 1, 'liveness must not query PostgreSQL');
  assert.equal((await fetch(base + '/api/ready')).status, 200);
  assert.equal(state.connects, 2);
  const closing = runtime.shutdown();
  assert.equal(runtime.shutdown(), closing);
  await closing;
  assert.equal(state.ends, 1);
  assert.equal(runtime.server.listening, false);
});
test('production database failure closes the pool and does not start HTTP', async () => {
  const { pool, state } = fakePool(true);
  await assert.rejects(startServer({ ...config, NODE_ENV: 'production' }, pool), { message: 'Backend startup failed' });
  assert.equal(state.ends, 1);
  await assert.rejects(startServer({ ...config, NODE_ENV: 'production' }), { message: 'Backend startup failed' });
});
test('shutdown drains active HTTP requests before ending the pool', async t => {
  const { pool, state } = fakePool();
  let began, finish;
  const started = new Promise(resolve => { began = resolve; });
  pool.query = () => { began(); return new Promise(resolve => { finish = resolve; }); };
  const runtime = await startServer(config, pool);
  t.after(() => runtime.shutdown());
  const response = fetch(`http://127.0.0.1:${runtime.server.address().port}/api/programs`);
  await started;
  const closing = runtime.shutdown();
  assert.equal(state.ends, 0);
  finish({ rows: [{ total: 0, data: [] }] });
  assert.equal((await response).status, 200);
  await closing;
  assert.equal(state.ends, 1);
  assert.equal(state.connects, 0, 'public requests must not run a readiness probe');
});
test('pool shutdown failures are generic', async () => {
  const { pool } = fakePool();
  pool.end = async () => { throw new Error('private password'); };
  const runtime = await startServer(config, pool);
  await assert.rejects(runtime.shutdown(), { message: 'Backend shutdown failed' });
});

test('an in-flight readiness probe becomes 503 when shutdown starts', async t => {
  const { pool } = fakePool();
  let began, finish;
  const started = new Promise(resolve => { began = resolve; });
  pool.connect = async () => ({ query: () => { began(); return new Promise(resolve => { finish = resolve; }); }, release: () => {} });
  const runtime = await startServer(config, pool);
  t.after(() => runtime.shutdown());
  const response = fetch(`http://127.0.0.1:${runtime.server.address().port}/api/ready`);
  await started;
  const closing = runtime.shutdown();
  finish();
  assert.equal((await response).status, 503);
  await closing;
});

test('shutdown deadline bounds a stuck pool drain', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { pool } = fakePool();
  pool.end = () => new Promise(() => {});
  const runtime = await startServer(config, pool);
  const closing = runtime.shutdown();
  const rejected = assert.rejects(closing, { message: 'Backend shutdown timed out' });
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(10001);
  await rejected;
  assert.equal(runtime.server.listening, false);
});
