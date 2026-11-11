import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { parseEnvironment } from '../dist/config/env.js';
import { programQuery, paginationQuery, contactBody, programParams } from '../dist/api/schemas.js';

const config = parseEnvironment({ NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'https://example.kz' });
test('pagination and search schemas produce bounded typed defaults', () => {
  assert.deepEqual(paginationQuery.parse({}), { page: 1, limit: 20 });
  assert.deepEqual(programQuery.parse({ age: '0', q: '  TEST  ', category: 'test-category' }),
    { page: 1, limit: 20, age: 0, q: 'TEST', category: 'test-category' });
});
for (const input of [{ page: '0' }, { page: '10001' }, { limit: '51' }, { age: '18' }, { age: '-1' }, { age: '1.5' }, { age: '' }, { page: ['1', '2'] }, { category: "x' OR 1=1--" }, { region: '*' }, { q: 'x'.repeat(201) }, { q: '\u0000' }, { status: 'draft' }]) {
  test(`rejects untrusted program query ${JSON.stringify(input)}`, () => assert.equal(programQuery.safeParse(input).success, false));
}
test('contact accepts only bounded explicit fields and valid email', () => {
  assert.deepEqual(contactBody.parse({ senderName: ' TEST ', email: 'test@example.com', message: ' Hello ' }),
    { senderName: 'TEST', email: 'test@example.com', message: 'Hello' });
  for (const input of [{}, { senderName: ' ', email: 'bad', message: '' }, { senderName: 'TEST', email: 'test@example.com', message: 'x'.repeat(2001) }, { senderName: 'TEST', email: 'test@example.com', message: 'Hello', iin: 'not-allowed' }]) {
    assert.equal(contactBody.safeParse(input).success, false);
  }
  assert.equal(programParams.safeParse({ id: "' OR true--" }).success, false);
});

test('public routes validate inputs and fail safely without a configured database', async t => {
  const server = createApp(config).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/api/programs?limit=51', '/api/programs/not-a-uuid', '/api/categories?unknown=1', '/api/regions?page=0']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: { code: 'VALIDATION_ERROR', message: 'Invalid request input.' } });
  }
  assert.equal((await fetch(base + '/api/programs')).status, 503);
  const response = await fetch(base + '/api/contact-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 400);
});

test('database failures never expose SQL, personal data or connection details', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
  const database = { async query() { throw new Error('private@example.com SELECT secret FROM private_table'); } };
  const server = createApp(config, database).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/programs`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  assert.deepEqual(logs, ['Unhandled request error']);
});
