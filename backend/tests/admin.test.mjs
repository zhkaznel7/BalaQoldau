import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../dist/admin/password.js';
import { parseEnvironment } from '../dist/config/env.js';
import { createApp } from '../dist/app.js';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';

async function serve(t, overrides = {}, database) {
  const config = parseEnvironment({ CORS_ALLOWED_ORIGINS: 'https://admin.example.kz', ADMIN_ENABLED: 'true',
    DATABASE_URL: 'postgresql://test@localhost/test', ADMIN_ORIGIN: 'https://admin.example.kz', ...overrides });
  const server = createApp(config, database).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}/api/admin`;
}
test('read verification does not consume the admin mutation budget; reads and login remain bounded',async t=>{
  const csrf='b'.repeat(64),token='a'.repeat(64),id='11111111-1111-4111-8111-111111111111';
  let authenticated=true;
  const db={query:async sql=>({rows:sql.startsWith('SELECT s.admin_id')?[{adminId:authenticated?id:null,csrf,role:authenticated?'editor':null}]:[]})};
  const base=await serve(t,{RATE_LIMIT_MAX:'1000'},db),headers={Cookie:'balaqoldau_admin='+token,Origin:'https://admin.example.kz','X-CSRF-Token':csrf,'Content-Type':'application/json'};
  for(let i=0;i<65;i++)assert.equal((await fetch(base+(i%2?'/access':'/session'),{headers})).status,200);
  authenticated=false;
  for(let i=0;i<5;i++)assert.equal((await fetch(base+'/login',{method:'POST',headers,body:JSON.stringify({email:'test@example.com',password:'Synthetic wrong password!'})})).status,401);
  const limited=await fetch(base+'/login',{method:'POST',headers,body:JSON.stringify({email:'test@example.com',password:'Synthetic wrong password!'})});
  assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  authenticated=true;
  assert.equal((await fetch(base+'/session',{headers})).status,200,'Login failures cannot exhaust read verification budget');
  let blocked;
  for(let i=0;i<60;i++){const response=await fetch(base+'/session',{headers});if(response.status===429){blocked=response;break;}}
  assert.ok(blocked,'Read endpoints retain their own bounded IP limiter');
});

test('admin endpoints are disabled by default, require HTTPS in production and reject foreign origins', async t => {
  const disabled = await serve(t, { ADMIN_ENABLED: 'false' });
  assert.equal((await fetch(disabled + '/session')).status, 404);
  const prod = await serve(t, { NODE_ENV: 'production' });
  assert.equal((await fetch(prod + '/session')).status, 403);
  const base = await serve(t);
  assert.equal((await fetch(base + '/session', { headers: { Origin: 'https://evil.example.com' } })).status, 403);
  assert.equal((await fetch(base + '/login', { method: 'POST' })).status, 403);
});

test('database failures and malformed cookies produce safe responses without sensitive details', async t => {
  const base = await serve(t, {}, { query: async () => { throw new Error('synthetic-private-database-details'); } });
  const failed = await fetch(base + '/session');
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('synthetic-private-database-details'), false);
  for (const cookie of ['balaqoldau_admin=invalid', 'balaqoldau_admin=' + 'a'.repeat(64) + '; balaqoldau_admin=' + 'b'.repeat(64)]) {
    assert.equal((await fetch(base + '/session', { headers: { Cookie: cookie } })).status, 401);
  }
});

test('CSRF cannot be bypassed by missing tokens, non-JSON bodies or unknown query fields', async t => {
  const base = await serve(t, {}, { query: async () => ({ rows: [{ adminId: null, csrf: 'b'.repeat(64) }] }) });
  const headers = { Origin: 'https://admin.example.kz', Cookie: 'balaqoldau_admin=' + 'a'.repeat(64) };
  assert.equal((await fetch(base + '/login', { method: 'POST', headers })).status, 403);
  assert.equal((await fetch(base + '/login', { method: 'POST', headers: { ...headers, 'X-CSRF-Token': 'b'.repeat(64) }, body: 'not-json' })).status, 415);
  assert.equal((await fetch(base + '/session?admin=true')).status, 400);
});

test('Argon2id uses unique salts, verifies passwords and rejects malformed hashes', async () => {
  const password = 'Synthetic test password only!';
  const first = await hashPassword(password);
  assert.match(first, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(first, password), true);
  assert.equal(await verifyPassword(first, password + 'wrong'), false);
  assert.equal(await verifyPassword('invalid', password), false);
  await assert.rejects(hashPassword('too short'));
  await assert.rejects(hashPassword('x'.repeat(257)));
});

test('offline provisioning rejects unsafe invocation/targets without echoing credentials', () => {
  const secret = 'Synthetic secret must not appear';
  for (const extra of [{}, { ADMIN_PROVISION_DATABASE: 'balaqoldau_db', DATABASE_URL: 'postgresql://test@localhost/balaqoldau_db' },
    { ADMIN_PROVISION_DATABASE: 'balaqoldau_test', DATABASE_URL: 'postgresql://test@localhost/other_test' }]) {
    const result = spawnSync(process.execPath, ['dist/admin/provision.js', '--create'], { encoding: 'utf8', timeout: 10000,
      input: JSON.stringify({ email: 'test@example.com', password: secret }), env: { ...process.env,
        ADMIN_PROVISION_DATABASE: undefined, DATABASE_URL: undefined, ...extra } });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes(secret), false);
    assert.equal(result.stdout, '');
  }
});

test('Argon2 concurrency is bounded and recovers after overload', async () => {
  const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => hashPassword('Synthetic concurrency password!')));
  assert.equal(attempts.filter(value => value.status === 'fulfilled').length, 2);
  assert.equal(attempts.filter(value => value.status === 'rejected').length, 1);
  assert.equal(await verifyPassword(await hashPassword('Synthetic recovery password!'), 'Synthetic recovery password!'), true);
});

test('admin auth defaults off and fails closed with incomplete or unsafe configuration', () => {
  const base = { CORS_ALLOWED_ORIGINS: 'http://localhost:5173' };
  assert.equal(parseEnvironment(base).ADMIN_ENABLED, false);
  for (const input of [{ ADMIN_ENABLED: 'yes' }, { ADMIN_ENABLED: 'true' },
    { ADMIN_ENABLED: 'true', DATABASE_URL: 'postgresql://test@localhost/test', ADMIN_ORIGIN: 'https://example.kz/path' },
    { ADMIN_ENABLED: 'true', DATABASE_URL: 'postgresql://test@localhost/test', ADMIN_ORIGIN: 'http://example.kz', NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://example.kz' },
    { ADMIN_SESSION_SECONDS: '0' }, { ADMIN_SESSION_SECONDS: '99999999' }]) {
    assert.throws(() => parseEnvironment({ ...base, ...input }));
  }
});
