import test from 'node:test';
import assert from 'node:assert/strict';
import { adminDatabaseSafe } from '../dist/admin/database-security.js';

test('production database safety fails closed on unsafe, missing and failed checks', async () => {
  assert.equal(await adminDatabaseSafe(undefined), false);
  for (const rows of [[], [{ safe: false }], [{ safe: 'true' }]]) {
    assert.equal(await adminDatabaseSafe({ query: async () => ({ rows }) }), false);
  }
  assert.equal(await adminDatabaseSafe({ query: async () => { throw new Error('private details'); } }), false);
  assert.equal(await adminDatabaseSafe({ query: async () => ({ rows: [{ safe: true }] }) }), true);
});
