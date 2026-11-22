import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../dist/app.js';
import { parseEnvironment } from '../../dist/config/env.js';
import { parseTestDatabaseEnvironment } from '../../dist/db/config.js';
import { createDatabasePool } from '../../dist/db/pool.js';
import { runMigrations } from '../../dist/db/migrate.js';
import { hashPassword } from '../../dist/admin/password.js';

test('isolated admin authentication: CSRF, rotation, expiry, revocation and safe failures', async t => {
  const db = parseTestDatabaseEnvironment(process.env);
  assert.equal(new URL(db.DATABASE_URL).pathname, '/balaqoldau_test');
  const pool = createDatabasePool(db);
  let client, server;
  try {
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'balaqoldau_test');
    await runMigrations(pool);
    client = await pool.connect();
    await client.query('BEGIN');
    const id = randomUUID(), email = `test-${id}@example.com`, password = 'Synthetic integration password!';
    await client.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash) VALUES($1,$2,$3)', [id, email, await hashPassword(password)]);
    assert.equal((await client.query('SELECT role FROM balaqoldau.admin_users WHERE id=$1', [id])).rows[0].role, 'editor');
    const origin = 'https://admin.example.kz';
    const config = parseEnvironment({ NODE_ENV: 'production', DATABASE_URL: db.DATABASE_URL,
      CORS_ALLOWED_ORIGINS: origin, ADMIN_ENABLED: 'true', ADMIN_ORIGIN: origin, TRUST_PROXY_LOOPBACK: 'true' });
    server = createApp(config, client).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    let cookie, csrf;
    const call = (path, body, overrides = {}) => fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, 'X-Forwarded-Proto': 'https', ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...overrides },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    await t.test('bootstrap is no-store, secure and bound to CSRF', async () => {
      const response = await call('/session');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const set = response.headers.get('Set-Cookie');
      for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(set.includes(attr));
      assert.ok(set.startsWith('__Host-balaqoldau_admin='));
      cookie = set.split(';')[0]; csrf = (await response.json()).data.csrfToken;
      assert.equal((await call('/login', { email, password }, { 'X-CSRF-Token': 'invalid' })).status, 403);
      assert.equal((await call('/login', { email, password }, { Origin: 'https://evil.example.com' })).status, 403);
      assert.equal((await call('/login', { email, password, role: 'admin' })).status, 400);
    });
    await t.test('wrong, unknown and SQL-injection credentials never authenticate', async () => {
      const wrong = await call('/login', { email, password: 'wrong' });
      const unknown = await call('/login', { email: 'unknown@example.com', password: 'wrong' });
      assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
      assert.deepEqual(await wrong.json(), await unknown.json());
      assert.equal((await call('/login', { email: "x' OR 1=1--", password })).status, 400);
    });
    let authenticatedCookie;
    await t.test('login rotates session ID and CSRF and old cookies stop working', async () => {
      const previous = cookie;
      const response = await call('/login', { email: email.toUpperCase(), password });
      assert.equal(response.status, 200);
      authenticatedCookie = response.headers.get('Set-Cookie').split(';')[0];
      assert.notEqual(authenticatedCookie, previous);
      const data = (await response.json()).data;
      assert.notEqual(data.csrfToken, csrf); csrf = data.csrfToken; cookie = authenticatedCookie;
      assert.equal(data.admin.id, id);
      assert.equal((await (await call('/session')).json()).data.authenticated, true);
      const stale = await call('/session', undefined, { Cookie: previous });
      assert.equal((await stale.json()).data.authenticated, false);
      assert.equal(await client.query('SELECT 1 FROM balaqoldau.admin_users WHERE id=$1', [id]).then(r => r.rowCount), 1);
    });
    await t.test('login limiter is enforced before additional password attempts', async () => {
      assert.equal((await call('/login', { email, password })).status, 429);
    });
    await t.test('logout revokes database session and clears cookie', async () => {
      const response = await call('/logout', {});
      assert.equal(response.status, 204);
      assert.match(response.headers.get('Set-Cookie'), /Expires=Thu, 01 Jan 1970/);
      assert.equal((await (await call('/session')).json()).data.authenticated, false);
      const events = (await client.query(`SELECT event FROM balaqoldau.admin_audit_log
        WHERE actor_id=$1 ORDER BY created_at,id`, [id])).rows.map(row => row.event);
      assert.ok(events.includes('auth.login_succeeded'));
      assert.ok(events.includes('auth.logout'));
    });
    await t.test('expired and disabled sessions cannot verify', async () => {
      for (const disabled of [false, true]) {
        const token = 'a'.repeat(64);
        const { tokenHash } = await import('../../dist/admin/repository.js');
        await client.query('UPDATE balaqoldau.admin_users SET disabled=$1 WHERE id=$2', [disabled, id]);
        await client.query(`INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,created_at,expires_at)
          VALUES($1,$2,$3,now()-interval '2 hours',now()+($4::integer*interval '1 second'))`, [tokenHash(token), 'b'.repeat(64), id, disabled ? 3600 : -1]);
        const response = await call('/session', undefined, { Cookie: '__Host-balaqoldau_admin=' + token });
        assert.equal((await response.json()).data.authenticated, false);
        await client.query('DELETE FROM balaqoldau.admin_sessions WHERE token_hash=$1', [tokenHash(token)]);
      }
    });
    await t.test('admin schema enforces unique identity and hash constraints', async () => {
      for (const [address, hash] of [[email, await hashPassword(password)], ['invalid-' + id + '@example.com', 'plaintext']]) {
        await client.query('SAVEPOINT invalid_admin');
        await assert.rejects(client.query('INSERT INTO balaqoldau.admin_users(email,password_hash) VALUES($1,$2)', [address, hash]));
        await client.query('ROLLBACK TO SAVEPOINT invalid_admin');
      }
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (client) { await client.query('ROLLBACK'); client.release(); }
    await pool.end();
  }
});
