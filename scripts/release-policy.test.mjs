import test from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenPath, textFindings, checkMigrations, approvedAssets, sha256, safePolicyError } from './release-policy.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditDecision } from './audit-dependencies.mjs';

test('approved text assets use LF bytes and explicit LF checkout attributes', () => {
  const root = new URL('../', import.meta.url);
  for (const asset of JSON.parse(readFileSync(new URL('release-assets.json', root), 'utf8'))) {
    const bytes = readFileSync(new URL(asset.source, root));
    assert.equal(bytes.includes(Buffer.from('\r\n')), false, `Noncanonical asset: ${asset.source}`);
    assert.equal(sha256(bytes), asset.sha256, `Asset hash mismatch: ${asset.source}`);
    const attributes = execFileSync('git', ['check-attr', 'eol', '--', asset.source], { cwd: root, encoding: 'utf8' });
    assert.equal(attributes.trim(), `${asset.source}: eol: lf`);
  }
});

test('policy diagnostics explain known failures and redact external error contents', () => {
  assert.equal(safePolicyError(new Error('Existing migration changed or removed')), 'Existing migration changed or removed');
  assert.match(safePolicyError(new Error('Asset policy hash mismatch: images/test.svg')), /hash mismatch: images\/test.svg/);
  const secret = ['sensitive', 'payload'].join('-');
  assert.equal(safePolicyError(new SyntaxError(secret)), 'Invalid JSON (contents redacted)');
  assert.equal(safePolicyError(Object.assign(new Error(secret), { code: 'ENOENT' })), 'Required file or directory missing (ENOENT)');
  assert.equal(safePolicyError(new Error(secret)), 'Unexpected failure (details redacted)');
});

test('CLI baseline failures are actionable, fail closed and never echo supplied input or Git stderr', () => {
  for (const baseline of ['private-invalid-input', 'f'.repeat(40)]) {
    const result = spawnSync(process.execPath, ['scripts/check-release.mjs', '--source'], {
      cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, MIGRATION_BASE: baseline },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[migration baseline\]: (Invalid migration baseline|Migration base commit unavailable \(fetch required history\))/);
    assert.equal(result.stderr.includes(baseline), false);
    assert.equal(result.stderr.includes('fatal:'), false);
    assert.equal(result.stderr.includes(' at '), false);
  }
});

test('CLI identifies asset hash failures and redacts malformed JSON contents', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'balaqoldau-policy-cli-'));
  try {
    mkdirSync(path.join(root, 'scripts'));
    mkdirSync(path.join(root, 'balaqoldau/public'), { recursive: true });
    for (const name of ['check-release.mjs', 'release-policy.mjs']) {
      writeFileSync(path.join(root, 'scripts', name), readFileSync(new URL(name, import.meta.url)));
    }
    writeFileSync(path.join(root, 'balaqoldau/public/test.svg'), '<svg/>');
    const manifest = path.join(root, 'release-assets.json');
    writeFileSync(manifest, JSON.stringify([{ source: 'balaqoldau/public/test.svg', output: 'test.svg', license: 'MIT', sha256: '0'.repeat(64) }]));
    const run = () => spawnSync(process.execPath, ['scripts/check-release.mjs', '--source'], { cwd: root, encoding: 'utf8', timeout: 10000 });
    const mismatch = run();
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /\[asset policy\]: Asset policy hash mismatch: test.svg/);
    const secret = 'synthetic-sensitive-json-value';
    writeFileSync(manifest, '{"token":"' + secret + '"');
    const malformed = run();
    assert.equal(malformed.status, 1);
    assert.match(malformed.stderr, /\[asset policy\]: Invalid JSON \(contents redacted\)/);
    assert.equal(malformed.stderr.includes(secret), false);
    assert.equal(malformed.stderr.includes(root), false);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.equal(path.basename(root).startsWith('balaqoldau-policy-cli-'), true);
    rmSync(root, { recursive: true, force: true });
  }
});

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
