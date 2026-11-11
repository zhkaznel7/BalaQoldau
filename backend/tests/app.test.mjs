import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createApp } from '../dist/app.js';
import { parseEnvironment } from '../dist/config/env.js';
import { errorHandler } from '../dist/middleware/errors.js';

const config = parseEnvironment({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://example.kz' });

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

test('health returns JSON and security headers without implementation details', async t => {
  const base = await serve(t, createApp(config));
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('content-security-policy'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('health rejects unexpected query parameters', async t => {
  const base = await serve(t, createApp(config));
  const response = await fetch(`${base}/api/health?unexpected=private-value`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: 'VALIDATION_ERROR', message: 'Invalid request input.' } });
});

test('exact allowed origin is reflected, without credentials', async t => {
  const base = await serve(t, createApp(config));
  const response = await fetch(`${base}/api/health`, { headers: { Origin: 'https://example.kz' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://example.kz');
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.match(response.headers.get('vary'), /Origin/);
});

for (const origin of ['https://evil.kz', 'https://example.kz.evil.kz', 'null']) {
  test(`rejects disallowed CORS origin ${origin}`, async t => {
    const base = await serve(t, createApp(config));
    const response = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await response.json()).error.code, 'CORS_FORBIDDEN');
  });
}

test('allowed preflight succeeds; forbidden preflight is rejected', async t => {
  const base = await serve(t, createApp(config));
  for (const [origin, status] of [['https://example.kz', 204], ['https://evil.kz', 403]]) {
    const response = await fetch(`${base}/api/health`, {
      method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(response.status, status);
    if (status === 204) assert.equal(response.headers.get('access-control-allow-methods'), 'GET,HEAD,POST,OPTIONS');
  }
});

test('unknown route returns a safe JSON 404', async t => {
  const base = await serve(t, createApp(config));
  const response = await fetch(`${base}/api/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

test('malformed and oversized JSON are safe client errors', async t => {
  const base = await serve(t, createApp(config));
  for (const [body, status, code] of [['{"secret":', 400, 'INVALID_JSON'], [JSON.stringify({ value: 'x'.repeat(17000) }), 413, 'PAYLOAD_TOO_LARGE']]) {
    const response = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  }
});

test('unexpected errors stay generic even when carrying forged status/message', async t => {
  const app = express();
  app.get('/fault', async () => { throw Object.assign(new Error('secret-token database failure'), { status: 400 }); });
  app.use(errorHandler);
  const base = await serve(t, app);
  const response = await fetch(`${base}/fault`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
});

test('rate limit returns JSON 429 and Retry-After, including preflight traffic', async t => {
  const base = await serve(t, createApp({ ...config, RATE_LIMIT_MAX: 2 }));
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/api/health`, { method: 'OPTIONS', headers: { Origin: 'https://example.kz', 'Access-Control-Request-Method': 'GET' } })).status, 204);
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('retry-after'));
  assert.equal((await response.json()).error.code, 'RATE_LIMITED');
});

test('HEAD health has no body and preserves security headers', async t => {
  const base = await serve(t, createApp(config));
  const response = await fetch(`${base}/api/health`, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.ok(response.headers.get('strict-transport-security'));
});

test('forged proxy headers cannot bypass the per-connection IP limit', async t => {
  // The limiter diagnoses untrusted forwarding headers; they must never become client identities.
  t.mock.method(console, 'error', () => {});
  const app = createApp({ ...config, RATE_LIMIT_MAX: 1 });
  assert.equal(app.get('trust proxy'), false);
  const base = await serve(t, app);
  assert.equal((await fetch(`${base}/api/health`, { headers: { 'X-Forwarded-For': '198.51.100.1' } })).status, 200);
  const response = await fetch(`${base}/api/health`, { headers: { 'X-Forwarded-For': '198.51.100.2' } });
  assert.equal(response.status, 429);
});

test('compressed JSON is rejected without leaking input', async t => {
  const base = await serve(t, createApp(config));
  const response = await fetch(`${base}/api/health`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body: 'private-input',
  });
  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: { code: 'UNSUPPORTED_ENCODING', message: 'Unsupported request encoding.' } });
});

test('opt-in loopback proxy separates clients and ignores forged leftmost IPs', async t => {
  const app = createApp({ ...config, TRUST_PROXY_LOOPBACK: true, RATE_LIMIT_MAX: 1 });
  const trust = app.get('trust proxy fn');
  assert.equal(trust('127.0.0.1'), true);
  assert.equal(trust('::1'), true);
  assert.equal(trust('::ffff:127.0.0.1'), true);
  assert.equal(trust('198.51.100.1'), false);
  const base = await serve(t, app);
  const request = ip => fetch(`${base}/api/health`, { headers: { 'X-Forwarded-For': ip } });
  assert.equal((await request('198.51.100.1')).status, 200);
  assert.equal((await request('198.51.100.2')).status, 200);
  // Even if a trusted proxy appends instead of overwriting, stop at the nearest untrusted hop.
  assert.equal((await request('203.0.113.1, 198.51.100.1')).status, 429);
});
