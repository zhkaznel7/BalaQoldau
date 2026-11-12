import test from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenPath, textFindings, checkMigrations, approvedAssets, sha256 } from './release-policy.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditDecision } from './audit-dependencies.mjs';

test('real environment/credential files are blocked, examples are source-only', () => {
  for (const file of ['.env', 'backend/.env.local', 'a/pgpass.conf', 'a/private.key', 'a/backup.dump', 'backend/dist/server.js', 'coverage/report.html']) assert.equal(forbiddenPath(file), true);
  assert.equal(forbiddenPath('backend/dist/server.js', true), false);
  assert.equal(forbiddenPath('backend/.env.example'), false);
  assert.equal(forbiddenPath('backend/.env.example', true), true);
});
test('secret findings never need to include secret values', () => {
  const token = 'ghp_' + 'a'.repeat(36);
  assert.deepEqual(textFindings('src/file.ts', token), ['token pattern']);
  assert.deepEqual(textFindings('src/file.ts', ['-----BEGIN ', 'PRIVATE KEY-----'].join('')), ['private key']);
  assert.deepEqual(textFindings('src/file.ts', ['postgresql://user:', 'real-password', '@db.example.com/database'].join('')), ['credential URL']);
});
test('migration policy accepts append-only versions and rejects rewrites/deletions/destruction', () => {
  const previous = new Map([['001_initial.sql', 'SELECT 1;']]);
  assert.doesNotThrow(() => checkMigrations(previous, new Map([...previous, ['002_next.sql', 'SELECT 2;']])));
  assert.throws(() => checkMigrations(previous, new Map([['001_initial.sql', 'SELECT 2;']])));
  assert.throws(() => checkMigrations(previous, new Map([['002_next.sql', 'SELECT 2;']])));
  assert.throws(() => checkMigrations(new Map(), new Map([['001_initial.sql', 'DROP TABLE sample;']])));
});
test('audit gate blocks high/critical production vulnerabilities and fails closed on missing reports', () => {
  const report = (high, critical, moderate = 0) => ({ metadata: { vulnerabilities: { high, critical, moderate, low: 0, info: 0 } } });
  assert.equal(auditDecision(report(1, 0), true).blocked, true);
  assert.equal(auditDecision(report(0, 1), true).blocked, true);
  assert.equal(auditDecision(report(0, 0, 10), true).blocked, false);
  assert.throws(() => auditDecision({}, true));
  assert.throws(() => auditDecision({ error: {}, metadata: report(0, 0).metadata }, true));
});

test('asset policy requires an allowed license, exact bytes and confined source path', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'balaqoldau-policy-'));
  try {
    mkdirSync(path.join(root, 'balaqoldau/public'), { recursive: true });
    const bytes = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    writeFileSync(path.join(root, 'balaqoldau/public/test.svg'), bytes);
    const entry = { source: 'balaqoldau/public/test.svg', output: 'test.svg', license: 'MIT', sha256: sha256(bytes) };
    const manifest = value => writeFileSync(path.join(root, 'release-assets.json'), JSON.stringify([value]));
    manifest(entry);
    assert.equal(approvedAssets(root).length, 1);
    const unknown = path.join(root, 'balaqoldau/public/unlicensed.jpg');
    writeFileSync(unknown, 'unreviewed image');
    assert.throws(() => approvedAssets(root));
    unlinkSync(unknown);
    mkdirSync(path.join(root, 'balaqoldau/src/assets'), { recursive: true });
    const font = path.join(root, 'balaqoldau/src/assets/unlicensed.woff2');
    writeFileSync(font, 'unreviewed font');
    assert.throws(() => approvedAssets(root));
    unlinkSync(font);
    manifest({ ...entry, license: 'unknown' });
    assert.throws(() => approvedAssets(root));
    manifest({ ...entry, source: 'balaqoldau/public/../../release-assets.json' });
    assert.throws(() => approvedAssets(root));
    manifest(entry);
    writeFileSync(path.join(root, 'balaqoldau/public/test.svg'), bytes + 'changed');
    assert.throws(() => approvedAssets(root));
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.equal(path.basename(root).startsWith('balaqoldau-policy-'), true);
    rmSync(root, { recursive: true, force: true }); // Only this test's newly created OS temporary directory.
  }
});

test('private build canary leakage is detected without exposing its value', () => {
  const previous = process.env.RELEASE_SCAN_CANARY;
  try {
    process.env.RELEASE_SCAN_CANARY = 'synthetic-private-build-marker';
    assert.deepEqual(textFindings('dist/app.js', 'const value="synthetic-private-build-marker"', true), ['private build environment leaked']);
    assert.deepEqual(textFindings('dist/app.js', 'const value="public"', true), []);
  } finally {
    if (previous === undefined) delete process.env.RELEASE_SCAN_CANARY;
    else process.env.RELEASE_SCAN_CANARY = previous;
  }
});
