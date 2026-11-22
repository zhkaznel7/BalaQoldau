import test from 'node:test';
import assert from 'node:assert/strict';
import {assertJudgeTarget, seedJudgePrograms} from '../dist/db/judge-seed.js';

test('judge seed accepts only the non-production dedicated database and approved hosts', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', 'judge-db']) {
    assert.doesNotThrow(() => assertJudgeTarget({NODE_ENV:'development', DATABASE_URL:`postgresql://judge@${host}/balaqoldau_judge`}));
  }
  for (const [NODE_ENV, host, name] of [
    ['production', 'localhost', 'balaqoldau_judge'],
    ['development', 'remote.example.org', 'balaqoldau_judge'],
    ['development', 'localhost', 'balaqoldau_dev'],
  ]) {
    assert.throws(() => assertJudgeTarget({NODE_ENV, DATABASE_URL:`postgresql://judge@${host}/${name}`}), /dedicated judge database/);
  }
});

test('judge seed refuses an unmarked or differently named database before reading or writing catalog rows', async () => {
  for (const identity of [
    {name:'balaqoldau_judge', marker:null},
    {name:'balaqoldau_dev', marker:'BalaQoldau disposable judge database'},
  ]) {
    const commands = [];
    const pool = {connect: async () => ({
      query: async sql => {
        commands.push(sql);
        return {rows: sql.includes('current_database()') ? [identity] : []};
      },
      release() {},
    })};
    await assert.rejects(seedJudgePrograms(pool), /dedicated judge database/);
    assert.equal(commands.at(-1), 'ROLLBACK');
    assert.ok(commands.every(sql => !sql.includes('balaqoldau.programs')));
  }
});
