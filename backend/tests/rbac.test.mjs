import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionsFor, hasPermission } from '../dist/admin/authorization.js';
import { createApp } from '../dist/app.js';
import { parseEnvironment } from '../dist/config/env.js';
import { once } from 'node:events';

test('least-privilege matrix denies missing/unknown roles and permissions', () => {
  const expected = {
    editor: ['programs:read', 'programs:draft:write'],
    reviewer: ['programs:read', 'programs:review'],
    admin: ['programs:read', 'programs:draft:write', 'programs:review', 'programs:publish', 'taxonomy:manage', 'users:roles:manage', 'audit:read'],
  };
  for (const [role, permissions] of Object.entries(expected)) {
    assert.deepEqual(permissionsFor(role), permissions);
    for (const permission of expected.admin) assert.equal(hasPermission(role, permission), permissions.includes(permission));
  }
  for (const role of [undefined, null, '', 'Admin', 'owner', '__proto__', 'constructor']) {
    assert.deepEqual(permissionsFor(role), []);
    assert.equal(hasPermission(role, 'audit:read'), false);
  }
  assert.equal(hasPermission('admin', 'unknown'), false);
  assert.equal(hasPermission('admin', '__proto__'), false);
  const copy = permissionsFor('editor');
  copy.push('audit:read');
  assert.equal(hasPermission('editor', 'audit:read'), false);
});

test('missing/unknown database roles deny access and audit failure remains fail-closed', async t => {
  for (const role of [null, 'owner', 'editor']) {
    const events = [];
    const database = { query: async (sql, values) => {
      if (sql.startsWith('SELECT s.admin_id')) return { rows: [{ adminId: '11111111-1111-4111-8111-111111111111', role, csrf: 'b'.repeat(64) }] };
      events.push(values);
      return { rows: [] };
    } };
    const config = parseEnvironment({ ADMIN_ENABLED: 'true', ADMIN_ORIGIN: 'https://admin.example.kz',
      CORS_ALLOWED_ORIGINS: 'https://admin.example.kz', DATABASE_URL: 'postgresql://test@localhost/test' });
    const server = createApp(config, database).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    const response = await fetch(base + '/audit-log', { headers: { Cookie: 'balaqoldau_admin=' + 'a'.repeat(64), 'X-Role': 'admin' } });
    assert.equal(response.status, 403);
    assert.equal(events[0][0], 'rbac.denied');
    assert.equal(events[0][2], 'audit:read');
    database.query = async () => { throw new Error('synthetic-sensitive-audit-error'); };
    const unavailable = await fetch(base + '/access');
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.text()).includes('synthetic-sensitive-audit-error'), false);
  }
});
