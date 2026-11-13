import test from 'node:test';
import assert from 'node:assert/strict';
import { registerInput, loginInput, resetInput, passwordInput } from '../dist/users/schemas.js';
import { parseEnvironment } from '../dist/config/env.js';
import { createApp } from '../dist/app.js';
import { once } from 'node:events';
import { userDatabaseSafe } from '../dist/users/database-security.js';
import { resetDelivery } from '../dist/users/mail.js';
import { hashPassword, hashUserPassword, verifyPassword } from '../dist/admin/password.js';
import { validNewPassword } from '../../balaqoldau/src/account/api.ts';

test('user password boundaries count Unicode code points and UTF-8 bytes consistently across forms', () => {
  const cases=[['x'.repeat(7),false],['x'.repeat(8),true],['x'.repeat(14),true],['x'.repeat(15),true],
    ['x'.repeat(256),true],['x'.repeat(257),false],['я'.repeat(128),true],['я'.repeat(129),false],
    ['😀'.repeat(7),false],['😀'.repeat(8),true],['😀'.repeat(64),true],['😀'.repeat(65),false]];
  for(const [password,expected] of cases){
    assert.equal(validNewPassword(password),expected);
    assert.equal(passwordInput.safeParse(password).success,expected);
    assert.equal(registerInput.safeParse({email:'test@example.com',password}).success,expected);
    assert.equal(resetInput.safeParse({token:'a'.repeat(64),password}).success,expected);
    assert.equal(loginInput.safeParse({email:'test@example.com',password}).success,expected);
  }
});

test('Argon2id accepts eight-character users but admin minimum remains fifteen', async () => {
  const password='User8pw!';
  const hash=await hashUserPassword(password);
  assert.match(hash,/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword(hash,password),true);
  await assert.rejects(hashUserPassword('x'.repeat(7)));
  await assert.rejects(hashUserPassword('я'.repeat(129)));
  for(const length of [8,14])await assert.rejects(hashPassword('x'.repeat(length)));
  assert.equal(await verifyPassword(await hashPassword('x'.repeat(15)),'x'.repeat(15)),true);
});

test('user schemas allow bounded passwords and reject escalation, unsafe tokens and invalid emails', () => {
  const valid = { email: 'Parent@example.com', password: 'Synthetic parent password!', language: 'kk' };
  assert.equal(registerInput.parse(valid).email, 'parent@example.com');
  for (const extra of [{ role: 'admin' }, { password: 'short' }, { email: "x' OR 1=1--" }, { language: 'en' }, { password: 'x'.repeat(257) }]) {
    assert.equal(registerInput.safeParse({ ...valid, ...extra }).success, false);
  }
  assert.equal(loginInput.safeParse({ email: valid.email, password: 'old-password' }).success, true);
  assert.equal(resetInput.safeParse({ token: 'a'.repeat(64), password: valid.password }).success, true);
  assert.equal(resetInput.safeParse({ token: '../secret', password: valid.password }).success, false);
});

test('production user privilege checks fail closed on missing database, unsafe role or catalog errors', async () => {
  assert.equal(await userDatabaseSafe(),false);
  assert.equal(await userDatabaseSafe({ query:async()=>({rows:[{safe:false}]}) }),false);
  assert.equal(await userDatabaseSafe({ query:async()=>{throw new Error('private-connection-details');} }),false);
});

test('optional local MTA never exposes executable or recipient details on startup failure', async () => {
  const config=parseEnvironment({CORS_ALLOWED_ORIGINS:'https://example.com'});
  assert.equal(resetDelivery(config),undefined);
  const delivery=resetDelivery({...config,USER_MAIL_COMMAND:process.platform==='win32'?'C:/missing-balaqoldau/sendmail.exe':'/missing-balaqoldau/sendmail',USER_MAIL_FROM:'support@example.com'});
  await assert.rejects(delivery('synthetic@example.com','https://example.com/reset-password#token='+'a'.repeat(64)),error=>error.message==='Password reset delivery unavailable');
});

test('user authentication configuration fails closed and stays independent of admin enablement', () => {
  const base = { CORS_ALLOWED_ORIGINS: 'http://localhost:5173' };
  assert.equal(parseEnvironment(base).USER_AUTH_ENABLED, false);
  for (const extra of [{ USER_AUTH_ENABLED: 'true' }, { USER_SESSION_SECONDS: '0' }, { USER_RESET_SECONDS: '86400' },
    { USER_MAIL_COMMAND: 'relative-sendmail' }, { USER_MAIL_FROM: 'bad' }]) assert.throws(() => parseEnvironment({ ...base, ...extra }));
  assert.equal(parseEnvironment({ ...base, USER_AUTH_ENABLED: 'true', USER_ORIGIN: 'http://localhost:5173', DATABASE_URL: 'postgresql://test@localhost/balaqoldau_dev' }).ADMIN_ENABLED, false);
});

test('user routes fail safely when disabled or database is unavailable', async () => {
  const config = parseEnvironment({ CORS_ALLOWED_ORIGINS: 'https://example.com' });
  for (const enabled of [false, true]) {
    const server = createApp({ ...config, USER_AUTH_ENABLED: enabled, USER_ORIGIN: 'https://example.com' }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/session`);
      assert.equal(response.status, enabled ? 503 : 404);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const text = await response.text();
      assert.doesNotMatch(text, /postgres|password|stack|DATABASE_URL/i);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
