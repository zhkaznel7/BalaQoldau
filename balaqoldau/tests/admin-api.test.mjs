import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminApi, AdminError } from '../src/admin/api.ts';
import { permittedActions, canEdit } from '../src/admin/types.ts';
import { validateProgramForm, initialForm } from '../src/admin/form.ts';

const csrf = 'b'.repeat(64), id = '11111111-1111-4111-8111-111111111111';
test('admin transport keeps CSRF in memory, uses same-origin cookies and never retries mutations', async () => {
  const calls = [];
  const api = createAdminApi('/api/admin', async (url, init) => {
    calls.push({ url, init });
    return Response.json({ data: { authenticated: true, admin: { id }, csrfToken: csrf } });
  });
  await api.login('test@example.com', 'Synthetic password only!');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.credentials, 'same-origin');
  assert.equal(calls[1].init.cache, 'no-store');
  assert.equal(calls[1].init.headers['X-CSRF-Token'], csrf);
  assert.equal(calls[1].url.includes('password'), false);
  let attempts = 0;
  const failing = createAdminApi('/api/admin', async () => { attempts++; return Response.json({}, { status: 409 }); });
  await assert.rejects(failing.program('bad'), AdminError);
  assert.equal(attempts, 0, 'invalid UUID rejected before network');
});

test('401 expires private state, while 403/409/network failures never trigger automatic mutation retries', async () => {
  for (const status of [401,403,409,500]) {
    let attempts = 0, expired = 0;
    const api = createAdminApi('/api/admin', async () => { attempts++; return Response.json({ error: { message: 'private backend details' } }, { status }); }, () => expired++);
    await assert.rejects(api.action(id, 'publish', 1), error => error instanceof AdminError && !error.message.includes('private backend details'));
    assert.equal(attempts, 1); assert.equal(expired, status === 401 ? 1 : 0);
  }
  let attempts = 0;
  const api = createAdminApi('/api/admin', async () => { attempts++; throw new Error('private network details'); });
  await assert.rejects(api.action(id, 'submit', 1), error => error instanceof AdminError && error.status === 0);
  assert.equal(attempts, 1);
});

test('client mutex prevents a double submission', async () => {
  let finish, attempts = 0;
  const api = createAdminApi('/api/admin', async () => { attempts++; return await new Promise(resolve => { finish = resolve; }); });
  const first = api.logout();
  await assert.rejects(api.logout(), AdminError);
  assert.equal(attempts, 1);
  finish(new Response(null, { status: 204 })); await first;
});

test('role-aware actions match ownership, review separation and DEMO rules', () => {
  const base = { id, createdBy: id, submittedBy: id, status: 'draft', sourceUrl: 'https://example.com', sourceName: 'TEST', isDemo: false };
  const editor = { id, role: 'editor', permissions: ['programs:read','programs:draft:write'] };
  assert.equal(canEdit(editor, base), true);
  assert.equal(canEdit({ ...editor, id: 'other' }, base), false);
  assert.deepEqual(permittedActions(editor, base), ['submit']);
  assert.deepEqual(permittedActions(editor, { ...base, isDemo: true }), []);
  const reviewer = { id, role: 'reviewer', permissions: ['programs:read','programs:review'] };
  assert.deepEqual(permittedActions(reviewer, { ...base, status: 'review' }), []);
  assert.deepEqual(permittedActions({ ...reviewer, id: 'other' }, { ...base, status: 'review' }), ['approve','reject']);
});

test('program form reports clear field errors and preserves age zero', () => {
  const value = { ...initialForm(), title: 'TEST', slug: 'test-program', category: 'test-category', description: 'TEST', sourceUrl: 'https://example.com', ageMin: '0' };
  assert.deepEqual(validateProgramForm(value), {});
  for (const [key, field] of [['ageMax','-1'], ['deadline','2026-02-30'], ['sourceUrl','javascript:alert(1)']]) {
    assert.equal(typeof validateProgramForm({ ...value, [key]: field })[key], 'string');
  }
});
test('admin configuration rejects cross-origin and ambiguous paths', () => {
  for (const base of ['https://example.com/admin', '//example.com/admin', '/api/../admin', '/api/admin?x=1', '/api\\admin']) {
    assert.throws(() => createAdminApi(base));
  }
});
