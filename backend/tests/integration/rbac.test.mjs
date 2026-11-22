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
import { tokenHash, randomToken, adminRepository } from '../../dist/admin/repository.js';
import { permissionsFor } from '../../dist/admin/authorization.js';

test('RBAC against isolated PostgreSQL: deny default, fresh authority and immutable audit', async t => {
  const config = parseTestDatabaseEnvironment(process.env);
  assert.equal(new URL(config.DATABASE_URL).pathname, '/balaqoldau_test');
  const pool = createDatabasePool(config);
  let client, server;
  try {
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'balaqoldau_test');
    await runMigrations(pool);
    client = await pool.connect();
    await client.query('BEGIN');
    const users = {};
    const hash = await hashPassword('Synthetic RBAC fixture password!');
    for (const role of ['editor', 'reviewer', 'admin']) {
      const id = randomUUID(), token = randomToken(), csrf = randomToken();
      await client.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)', [id, id + '@example.com', hash, role]);
      await client.query(`INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at)
        VALUES($1,$2,$3,now()+interval '1 hour')`, [tokenHash(token), csrf, id]);
      users[role] = { id, token, csrf };
    }
    const origin = 'https://admin.example.kz';
    server = createApp(parseEnvironment({ NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: origin,
      DATABASE_URL: config.DATABASE_URL, ADMIN_ENABLED: 'true', ADMIN_ORIGIN: origin }), client).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api/admin`;
    const call = (path, user, body, headers = {}) => fetch(url + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, ...(user ? { Cookie: 'balaqoldau_admin=' + user.token, 'X-CSRF-Token': user.csrf } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const roleOf = async id => (await client.query('SELECT role FROM balaqoldau.admin_users WHERE id=$1', [id])).rows[0].role;
    await t.test('unauthenticated requests are 401 and authenticated role matrix is enforced', async () => {
      assert.equal((await call('/access')).status, 401);
      assert.equal((await call('/audit-log')).status, 401);
      assert.equal((await call(`/users/${users.editor.id}/role`, undefined, { role: 'admin' })).status, 401);
      for (const [role, user] of Object.entries(users)) {
        const access = await call('/access', user);
        assert.equal(access.status, 200);
        assert.deepEqual((await access.json()).data.permissions, permissionsFor(role));
        assert.equal((await call('/audit-log', user)).status, role === 'admin' ? 200 : 403);
      }
    });
    await t.test('Editor/Reviewer cannot self-elevate or modify other users, even with forged role headers', async () => {
      for (const role of ['editor', 'reviewer']) {
        for (const target of [users[role], users.admin]) {
          assert.equal((await call(`/users/${target.id}/role`, users[role], { role: 'admin' }, { 'X-Role': 'admin' })).status, 403);
        }
        assert.equal(await roleOf(users[role].id), role);
      }
      assert.equal((await call('/audit-log?role=admin', users.editor)).status, 400);
    });
    await t.test('Admin role changes require valid CSRF, UUID, allowed role and strict body', async () => {
      const path = `/users/${users.reviewer.id}/role`;
      assert.equal((await call(path, users.admin, { role: 'editor' }, { 'X-CSRF-Token': 'wrong' })).status, 403);
      assert.equal((await call(path, users.admin, { role: 'owner' })).status, 400);
      assert.equal((await call(path, users.admin, { role: 'editor', disabled: true })).status, 400);
      assert.equal((await call('/users/invalid/role', users.admin, { role: 'editor' })).status, 400);
      assert.equal((await call(`/users/${users.admin.id}/role`, users.admin, { role: 'editor' })).status, 403);
      assert.equal((await call(`/users/${users.admin.id.toUpperCase()}/role`, users.admin, { role: 'editor' })).status, 403);
      assert.equal((await call(`/users/${randomUUID()}/role`, users.admin, { role: 'editor' })).status, 403);
      assert.equal(await roleOf(users.reviewer.id), 'reviewer');
    });
    await t.test('role changes and audit are atomic, existing sessions use current database role', async () => {
      assert.equal((await call(`/users/${users.reviewer.id}/role`, users.admin, { role: 'editor' })).status, 204);
      assert.equal((await (await call('/access', users.reviewer)).json()).data.role, 'editor');
      const rows = (await client.query(`SELECT previous_role,new_role FROM balaqoldau.admin_audit_log
        WHERE event='rbac.role_changed' AND actor_id=$1 AND target_id=$2`, [users.admin.id, users.reviewer.id])).rows;
      assert.deepEqual(rows, [{ previous_role: 'reviewer', new_role: 'editor' }]);
      // Recheck authority inside the mutation query, not merely in cached middleware state.
      assert.equal(await adminRepository(client).changeRole(users.reviewer.id, users.editor.id, 'admin', users.reviewer.token), false);
      assert.equal(await roleOf(users.editor.id), 'editor');
    });
    await t.test('grant and revoke affect existing cookies immediately without cached privilege', async () => {
      const path = `/users/${users.reviewer.id}/role`;
      assert.equal((await call(path, users.admin, { role: 'admin' })).status, 204);
      assert.equal((await call('/audit-log', users.reviewer)).status, 200);
      assert.equal((await call(path, users.admin, { role: 'editor' })).status, 204);
      assert.equal((await call('/audit-log', users.reviewer)).status, 403);
      assert.equal((await call(`/users/${users.editor.id}/role`, users.reviewer, { role: 'admin' })).status, 403);
    });
    await t.test('audit insertion failure rolls back the role change and returns safe 503', async () => {
      await client.query('SAVEPOINT audit_failure');
      await client.query(`CREATE FUNCTION pg_temp.reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic-private-audit-failure'; END; $$`);
      await client.query(`CREATE TRIGGER reject_test_audit BEFORE INSERT ON balaqoldau.admin_audit_log
        FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_test_audit()`);
      const response = await call(`/users/${users.editor.id}/role`, users.admin, { role: 'reviewer' });
      assert.equal(response.status, 503);
      assert.equal((await response.text()).includes('synthetic-private-audit-failure'), false);
      await client.query('ROLLBACK TO SAVEPOINT audit_failure');
      assert.equal(await roleOf(users.editor.id), 'editor');
    });
    await t.test('audit UPDATE/DELETE/TRUNCATE are rejected, pagination is bounded and logs contain no secrets', async () => {
      for (const sql of ['UPDATE balaqoldau.admin_audit_log SET event=event', 'DELETE FROM balaqoldau.admin_audit_log', 'TRUNCATE balaqoldau.admin_audit_log']) {
        await client.query('SAVEPOINT immutable_audit');
        await assert.rejects(client.query(sql), /append-only/);
        await client.query('ROLLBACK TO SAVEPOINT immutable_audit');
      }
      assert.equal((await call('/audit-log?limit=51', users.admin)).status, 400);
      const response = await call('/audit-log?limit=2&page=1', users.admin);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.ok(result.data.length <= 2);
      const serialized = JSON.stringify(result);
      for (const value of [hash, users.admin.token, users.admin.csrf, '@example.com']) assert.equal(serialized.includes(value), false);
      assert.ok((await client.query(`SELECT 1 FROM balaqoldau.admin_audit_log WHERE event='rbac.denied'`)).rowCount > 0);
      await client.query('SAVEPOINT invalid_role');
      await assert.rejects(client.query('UPDATE balaqoldau.admin_users SET role=$1 WHERE id=$2', ['owner', users.editor.id]));
      await client.query('ROLLBACK TO SAVEPOINT invalid_role');
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (client) { await client.query('ROLLBACK'); client.release(); }
    await pool.end();
  }
});
