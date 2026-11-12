import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createReadinessCheck } from '../dist/db/readiness.js';
import { createApp } from '../dist/app.js';
import { parseEnvironment } from '../dist/config/env.js';

const config = parseEnvironment({ CORS_ALLOWED_ORIGINS: 'https://example.kz' });
async function serve(t, check) {
  const server = createApp(config, undefined, check).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}
test('ready succeeds after the view probe and releases the client', async t => {
  const releases = [];
  const check = createReadinessCheck({ connect: async () => ({
    query: async sql => { assert.match(sql, /published_programs/); },
    release: destroy => releases.push(destroy),
  }) });
  const base = await serve(t, check);
  const result = await fetch(base + '/api/ready');
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { status: 'ready' });
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(releases, [false]);
});
test('unavailable or missing database returns generic 503 while health stays live', async t => {
  const base = await serve(t, createReadinessCheck({ connect: async () => { throw new Error('private-connection-password'); } }));
  const response = await fetch(base + '/api/ready');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'NOT_READY', message: 'Service is not ready.' } });
  assert.deepEqual(await (await fetch(base + '/api/health')).json(), { status: 'ok' });
  const missing = await serve(t);
  assert.equal((await fetch(missing + '/api/ready')).status, 503);
});
test('readiness rejects unknown query parameters', async t => {
  let calls = 0;
  const base = await serve(t, async () => { calls++; return true; });
  assert.equal((await fetch(base + '/api/ready?extra=1')).status, 400);
  assert.equal(calls, 0);
});
test('probe timeout destroys an active client once; concurrent checks share work', async () => {
  let connections = 0, finish;
  const releases = [];
  const check = createReadinessCheck({ connect: async () => {
    connections++;
    return { query: () => new Promise(resolve => { finish = resolve; }), release: destroy => releases.push(destroy) };
  } }, 30);
  const began = Date.now();
  assert.deepEqual(await Promise.all([check(), check(), check()]), [false, false, false]);
  assert.ok(Date.now() - began < 1000);
  assert.equal(connections, 1);
  assert.deepEqual(releases, [true]);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(releases, [true]);
});
test('late pool checkout is discarded after the readiness deadline', async () => {
  let checkout;
  const releases = [];
  const check = createReadinessCheck({ connect: () => new Promise(resolve => { checkout = resolve; }) }, 20);
  assert.equal(await check(), false);
  checkout({ query: () => { throw new Error('must not run after deadline'); }, release: destroy => releases.push(destroy) });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(releases, [true]);
});
test('query/schema failure returns false, discards client, and can recover', async () => {
  let fail = true;
  const releases = [];
  const check = createReadinessCheck({ connect: async () => ({ query: async () => { if (fail) throw new Error('private SQL'); }, release: destroy => releases.push(destroy) }) });
  assert.equal(await check(), false);
  fail = false;
  assert.equal(await check(), true);
  assert.deepEqual(releases, [true, false]);
});

test('readiness timeout is a bounded HTTP 503 with no database detail', async t => {
  let checkout;
  const check = createReadinessCheck({ connect: () => new Promise(resolve => { checkout = resolve; }) }, 25);
  const base = await serve(t, check);
  const began = Date.now();
  const response = await fetch(base + '/api/ready');
  assert.equal(response.status, 503);
  assert.ok(Date.now() - began < 1000);
  assert.deepEqual(await response.json(), { error: { code: 'NOT_READY', message: 'Service is not ready.' } });
  checkout({ release: () => {} });
});
