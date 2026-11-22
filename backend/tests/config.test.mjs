import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvironment } from '../dist/config/env.js';

const valid = { CORS_ALLOWED_ORIGINS: 'https://example.kz,http://localhost:5173' };

test('valid environment produces typed, bounded defaults', () => {
  const config = parseEnvironment(valid);
  assert.equal(config.PORT, 3001);
  assert.equal(config.NODE_ENV, 'development');
  assert.deepEqual(config.CORS_ALLOWED_ORIGINS, ['https://example.kz', 'http://localhost:5173']);
});

for (const [key, values] of Object.entries({
  NODE_ENV: ['staging', ''],
  PORT: ['', '0', '65536', '3.5', 'abc'],
  HOST: ['', 'not an ip'],
  RATE_LIMIT_MAX: ['0', '-1', '1.5'],
  RATE_LIMIT_WINDOW_MS: ['0', '2147483648'],
  CORS_ALLOWED_ORIGINS: [undefined, '', '*', 'null', 'https://example.kz/path', 'https://user:pass@example.kz', 'https://example.kz/', 'https://example.kz,', 'ftp://example.kz'],
})) {
  for (const value of values) {
    test(`rejects invalid ${key}: ${String(value)}`, () => {
      assert.throws(() => parseEnvironment({ ...valid, [key]: value }), /Invalid environment configuration/);
    });
  }
}

test('configuration errors never echo supplied values', () => {
  assert.throws(() => parseEnvironment({ ...valid, PORT: 'private-secret-value' }), error => {
    assert.equal(error.message.includes('private-secret-value'), false);
    assert.match(error.message, /PORT/);
    return true;
  });
});

test('proxy trust is opt-in and rejects permissive or ambiguous values', () => {
  assert.equal(parseEnvironment(valid).TRUST_PROXY_LOOPBACK, false);
  assert.equal(parseEnvironment({ ...valid, TRUST_PROXY_LOOPBACK: 'true' }).TRUST_PROXY_LOOPBACK, true);
  for (const value of ['1', '*', 'loopback', 'yes', '']) {
    assert.throws(() => parseEnvironment({ ...valid, TRUST_PROXY_LOOPBACK: value }), /Invalid environment configuration/);
  }
});

test('production requires DATABASE_URL and rejects invalid values without echoing them', () => {
  for (const DATABASE_URL of [undefined, '', 'private-invalid-url']) {
    assert.throws(() => parseEnvironment({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://example.kz', DATABASE_URL }), error => {
      assert.match(error.message, /DATABASE_URL/);
      assert.equal(error.message.includes('private-invalid-url'), false);
      return true;
    });
  }
});
