import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit, runAudit } from './audit-dependencies.mjs';

const report = (high = 0, critical = 0, moderate = 0) => JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 0, moderate, high, critical } } });
const success = (stdout = report(), status = 0) => ({ status, stdout, stderr: '' });

test('audit exit 1 with a valid report preserves vulnerability findings and production gate', () => {
  assert.equal(evaluateAudit(success(report(0, 0, 10), 1), false).counts.moderate, 10);
  assert.equal(evaluateAudit(success(report(1), 1), true).blocked, true);
  assert.equal(evaluateAudit(success(report(1), 0), true).blocked, true);
  assert.equal(evaluateAudit(success(report(0, 1), 1), true).blocked, true);
  assert.equal(evaluateAudit(success(), true).blocked, false);
});

test('diagnostics classify failures without echoing raw process or registry output', () => {
  const secret = 'synthetic-private-registry-value';
  for (const result of [
    { status: null, stdout: secret, error: { code: 'ETIMEDOUT', message: secret } },
    success(JSON.stringify({ error: { code: 'ECONNRESET', summary: secret } }), 1),
    success(JSON.stringify({ error: { code: 'E401', detail: secret } }), 1),
    success(secret), success('{}'), success(report(), 2),
    { status: null, signal: 'SIGTERM', stdout: secret },
  ]) {
    assert.throws(() => evaluateAudit(result, true), error => {
      assert.equal(error.message.includes(secret), false);
      return true;
    });
  }
});

test('transient timeout retries once with a bounded longer deadline and complete reports', () => {
  const options = [];
  const outcome = runAudit('balaqoldau', true, (_command, args, settings) => {
    options.push({ args, settings });
    return options.length === 1 ? { status: null, error: { code: 'ETIMEDOUT' } } : success();
  });
  assert.equal(outcome.attempts, 2);
  assert.equal(outcome.blocked, false);
  assert.equal(options[0].settings.timeout, 90000);
  assert.ok(options[0].args.join(' ').includes('--omit=dev'));
  assert.ok(options[0].args.join(' ').includes('--audit-level=high'));
});

test('exhausted timeouts fail closed; malformed reports and vulnerabilities are never retried', () => {
  let calls = 0;
  assert.throws(() => runAudit('backend', true, () => { calls++; return { status: null, error: { code: 'ETIMEDOUT' } }; }), /timeout/i);
  assert.equal(calls, 2);
  calls = 0;
  assert.throws(() => runAudit('backend', true, () => { calls++; return success('{}'); }), /report/i);
  assert.equal(calls, 1);
  calls = 0;
  assert.equal(runAudit('backend', true, () => { calls++; return success(report(1), 1); }).blocked, true);
  assert.equal(calls, 1);
});

test('registry network errors retry once, while authentication errors fail immediately', () => {
  let calls = 0;
  const report = runAudit('backend', true, () => {
    calls++;
    return calls === 1 ? success(JSON.stringify({ error: { code: 'E503', detail: 'private response' } }), 1) : success();
  });
  assert.equal(report.attempts, 2);
  calls = 0;
  assert.throws(() => runAudit('backend', true, () => {
    calls++;
    return success(JSON.stringify({ error: { code: 'E401', detail: 'private response' } }), 1);
  }), /AUDIT_REGISTRY_AUTH/);
  assert.equal(calls, 1);
});
