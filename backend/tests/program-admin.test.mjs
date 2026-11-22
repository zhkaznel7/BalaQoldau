import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgramInput, updateProgramInput, transitionInput } from '../dist/admin/program-schemas.js';
import { programTransaction } from '../dist/admin/program-transaction.js';
import { Pool } from 'pg';

const draft = { slug: 'test-program', category: 'test-category', title: 'TEST draft', description: 'TEST only' };
test('program schemas reject privilege fields, unsafe URLs, invalid dates and inconsistent ages', () => {
  assert.equal(createProgramInput.parse(draft).isDemo, false);
  for (const extra of [{ status: 'published' }, { verifiedAt: '2026-01-01' }, { createdBy: 'x' },
    { sourceUrl: 'javascript:alert(1)' }, { applyUrl: 'https://user:pass@example.com' },
    { deadline: '2026-02-30' }, { ageMin: 10, ageMax: 2 }, { regions: ['x', 'x'] }]) {
    assert.equal(createProgramInput.safeParse({ ...draft, ...extra }).success, false);
  }
  assert.equal(updateProgramInput.safeParse({ version: 1 }).success, false);
  assert.equal(updateProgramInput.safeParse({ version: 1, isDemo: false }).success, false);
  assert.equal(transitionInput.safeParse({ version: 1, status: 'published' }).success, false);
});

test('production pool path commits atomically, rolls back failures and rejects autocommit-only adapters', async () => {
  for (const fail of [false, true]) {
    const pool = new Pool();
    const sql = [];
    let releases = 0;
    pool.connect = async () => ({ query: async query => { sql.push(query); return { rows: [] }; }, release: () => { releases++; } });
    try {
      const work = () => programTransaction(pool, async db => { await db.query('SELECT 1'); if (fail) throw new Error('synthetic rollback'); return 7; });
      if (fail) await assert.rejects(work(), /synthetic rollback/);
      else assert.equal(await work(), 7);
      assert.equal(sql[0], 'BEGIN');
      assert.equal(sql.at(-1), fail ? 'ROLLBACK' : 'COMMIT');
      assert.equal(releases, 1);
    } finally { await pool.end(); }
  }
  let ran = false;
  await assert.rejects(programTransaction({ query: async () => {} }, async () => { ran = true; }));
  assert.equal(ran, false);
});
