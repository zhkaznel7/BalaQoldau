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
import { adminRepository, randomToken, tokenHash } from '../../dist/admin/repository.js';
import { adminDatabaseSafe, adminPrivilegeQuery } from '../../dist/admin/database-security.js';

test('isolated security regression: shared throttling, credential rotation and action-time authorization', async t => {
  const config = parseTestDatabaseEnvironment(process.env);
  assert.equal(new URL(config.DATABASE_URL).pathname, '/balaqoldau_test');
  const pool = createDatabasePool(config);
  let client, server;
  try {
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'balaqoldau_test');
    await runMigrations(pool);
    client = await pool.connect();
    await client.query('BEGIN');
    const hash = await hashPassword('Synthetic hardening password!');
    const ids = { admin: randomUUID(), target: randomUUID(), limited: randomUUID() };
    for (const [name, id] of Object.entries(ids)) {
      await client.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',
        [id, id + '@example.com', hash, name === 'admin' ? 'admin' : 'editor']);
    }
    const repository = adminRepository(client);
    const origin = 'https://admin.example.kz';
    server = createApp(parseEnvironment({ NODE_ENV: 'test', ADMIN_ENABLED: 'true', ADMIN_ORIGIN: origin,
      CORS_ALLOWED_ORIGINS: origin, DATABASE_URL: config.DATABASE_URL }), client).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    const login = async (email, password) => {
      const initial = await fetch(base + '/session');
      const cookie = initial.headers.get('Set-Cookie').split(';')[0];
      const csrf = (await initial.json()).data.csrfToken;
      return fetch(base + '/login', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }) });
    };
    await t.test('different repository instances share the account budget, including successful-password attempts', async () => {
      const otherInstance = adminRepository(client);
      for (let attempt = 0; attempt < 10; attempt++) {
        assert.ok(await (attempt % 2 ? repository : otherInstance).user(ids.limited + '@example.com'));
      }
      assert.equal(await otherInstance.user(ids.limited + '@example.com'), undefined);
      const correctButLimited = await login(ids.limited + '@example.com', 'Synthetic hardening password!');
      const unknown = await login(randomUUID() + '@example.com', 'Synthetic hardening password!');
      assert.equal(correctButLimited.status, 401);
      assert.equal(unknown.status, 401);
      assert.deepEqual(await correctButLimited.json(), await unknown.json());
      await client.query("UPDATE balaqoldau.admin_users SET login_window_ends=clock_timestamp()-interval '1 second' WHERE id=$1", [ids.limited]);
      assert.ok(await repository.user(ids.limited + '@example.com'));
      assert.equal((await client.query('SELECT login_attempts FROM balaqoldau.admin_users WHERE id=$1', [ids.limited])).rows[0].login_attempts, 1);
    });
    await t.test('pre-authentication tokens are single-use and fixation cannot preserve the old session', async () => {
      const old = randomToken(), fresh = randomToken(), oldCsrf = randomToken(), csrf = randomToken();
      await repository.create(old, oldCsrf);
      assert.equal(await repository.authenticate(old, fresh, csrf, ids.admin, 3600, hash), true);
      assert.equal(await repository.authenticate(old, randomToken(), randomToken(), ids.admin, 3600, hash), false);
      assert.equal(await repository.session(old), undefined);
      assert.equal((await repository.session(fresh)).csrf, csrf);
      const response = await fetch(base + '/logout', { method: 'POST', headers: { Origin: origin,
        Cookie: 'balaqoldau_admin=' + fresh, 'X-CSRF-Token': oldCsrf, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 403);
      assert.ok(await repository.session(fresh));
    });
    const issue = async expectedHash => {
      const old = randomToken(), fresh = randomToken();
      await repository.create(old, randomToken());
      assert.equal(await repository.authenticate(old, fresh, randomToken(), ids.admin, 3600, expectedHash), true);
      return fresh;
    };
    let rotatedHash;
    await t.test('password rotation invalidates all old sessions and rejects a stale verified hash', async () => {
      const first = await issue(hash), second = await issue(hash), pending = randomToken();
      await repository.create(pending, randomToken());
      rotatedHash = await hashPassword('Synthetic rotated password!');
      await client.query('UPDATE balaqoldau.admin_users SET password_hash=$1 WHERE id=$2', [rotatedHash, ids.admin]);
      assert.equal(await repository.session(first), undefined);
      assert.equal(await repository.session(second), undefined);
      assert.equal(await repository.authenticate(pending, randomToken(), randomToken(), ids.admin, 3600, hash), false);
      assert.ok(await repository.session(await issue(rotatedHash)));
    });
    await t.test('revoked, expired, disabled and demoted actors cannot mutate roles or read audit', async () => {
      const revoked = await issue(rotatedHash);
      await repository.remove(revoked);
      assert.equal(await repository.changeRole(ids.admin, ids.target, 'admin', revoked), false);
      assert.deepEqual(await repository.auditLog(revoked, 20, 0), { authorized: false, data: [] });
      const expired = await issue(rotatedHash);
      await client.query("UPDATE balaqoldau.admin_sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1", [tokenHash(expired)]);
      assert.equal(await repository.session(expired), undefined);
      assert.equal(await repository.changeRole(ids.admin, ids.target, 'admin', expired), false);
      assert.equal((await repository.auditLog(expired, 20, 0)).authorized, false);
      const live = await issue(rotatedHash);
      for (const [role, disabled] of [['admin', true], ['editor', false]]) {
        await client.query('UPDATE balaqoldau.admin_users SET role=$1,disabled=$2 WHERE id=$3', [role, disabled, ids.admin]);
        assert.equal(await repository.changeRole(ids.admin, ids.target, 'admin', live), false);
        assert.equal((await repository.auditLog(live, 20, 0)).authorized, false);
      }
      assert.equal((await client.query('SELECT role FROM balaqoldau.admin_users WHERE id=$1', [ids.target])).rows[0].role, 'editor');
    });
    await t.test('disabling and later re-enabling an account never resurrects its old session', async () => {
      const token = await issue(rotatedHash);
      await client.query('UPDATE balaqoldau.admin_users SET disabled=true WHERE id=$1', [ids.admin]);
      assert.equal(Boolean(await repository.session(token)), false);
      await client.query('UPDATE balaqoldau.admin_users SET disabled=false WHERE id=$1', [ids.admin]);
      assert.equal(Boolean(await repository.session(token)), false);
    });
    await t.test('catalog privilege SQL runs successfully and rejects the owner migration/test connection', async () => {
      const result = await client.query(adminPrivilegeQuery);
      assert.equal(result.rows[0].safe, false);
      assert.equal(await adminDatabaseSafe(client), false);
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (client) { await client.query('ROLLBACK'); client.release(); }
    await pool.end();
  }
});
