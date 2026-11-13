import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../dist/app.js';
import { parseEnvironment } from '../../dist/config/env.js';
import { userRepository, userToken, userTokenHash } from '../../dist/users/repository.js';
import { openUserDatabase } from '../helpers/user-database.mjs';
import { userDatabaseSafe } from '../../dist/users/database-security.js';
import { randomToken,tokenHash } from '../../dist/admin/repository.js';
import { hashPassword } from '../../dist/admin/password.js';

test('Stage 11 authentication/security on explicitly verified database; synthetic records roll back', async t => {
  const { pool, config } = await openUserDatabase();
  let db, server;
  const deliveries = [], origin = 'https://parents.example.com';
  const password = 'User8pw!', email = `test-${randomUUID()}@example.com`;
  let cookie, csrf, oldCookie, userId;
  try {
    db = await pool.connect(); await db.query('BEGIN');
    await t.test('production privilege gate rejects local owner credentials without changing roles', async () => {
      let checked=false;
      assert.equal(await userDatabaseSafe({query:async(...args)=>{const value=await db.query(...args);checked=true;return value;}}),false);
      assert.equal(checked,true,'Production privilege query must execute successfully');
    });
    const cfg = parseEnvironment({ CORS_ALLOWED_ORIGINS: origin, DATABASE_URL: config.DATABASE_URL,
      USER_AUTH_ENABLED: 'true', USER_ORIGIN: origin, ADMIN_ENABLED: 'true', ADMIN_ORIGIN: origin });
    const start = async (delivery = async (recipient, url) => { deliveries.push({ recipient, url }); }, overrides = {}) => {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      server = createApp({ ...cfg, ...overrides }, db, async () => true, delivery).listen(0,'127.0.0.1'); await once(server,'listening');
    };
    const call = (path, method = 'GET', body, headers = {}) => fetch(`http://127.0.0.1:${server.address().port}/api` + path, {
      method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const session = async () => { const response = await call('/auth/session'); const body = (await response.json()).data;
      const next = response.headers.get('set-cookie'); if (next) cookie = next.split(';')[0]; csrf = body.csrfToken; return body; };
    const waitDelivery = async count => { for (let i=0;i<100 && deliveries.length<count;i++) await new Promise(resolve => setTimeout(resolve,10)); assert.equal(deliveries.length,count); };
    await start();
    await t.test('unauthenticated profile, strict query/body and CSRF/origin enforcement', async () => {
      assert.equal((await call('/auth/profile')).status,401); await session();
      assert.equal((await call('/auth/register','POST',{ email,password,role:'admin' })).status,400);
      assert.equal((await call('/auth/register','POST',{ email,password },{ 'X-CSRF-Token':'bad' })).status,403);
      assert.equal((await call('/auth/register','POST',{ email,password },{ Origin:'https://evil.example' })).status,403);
      assert.equal((await call('/auth/session?userId=x')).status,400);
      const short=await call('/auth/register','POST',{email,password:'x'.repeat(7)});
      assert.equal(short.status,400);assert.equal((await short.json()).error.code,'PASSWORD_POLICY');
    });
    await t.test('registration hashes Argon2id; duplicates never overwrite existing data', async () => {
      const input = { email,password,language:'ru' };
      assert.equal((await call('/auth/register','POST',input)).status,202);
      const row = (await db.query('SELECT id,password_hash,language FROM balaqoldau.user_accounts WHERE email=$1',[email])).rows[0];
      userId = row.id; assert.match(row.password_hash,/^\$argon2id\$/); assert.equal(row.language,'ru');
      const repeated = await call('/auth/register','POST',{ ...input,password:'Different synthetic password!',language:'kk' });
      assert.equal(repeated.status,202);
      assert.equal((await db.query('SELECT password_hash FROM balaqoldau.user_accounts WHERE id=$1',[userId])).rows[0].password_hash,row.password_hash);
    });
    await t.test('login rotates anonymous session and CSRF; authenticated profile is server-owned', async () => {
      oldCookie = cookie;
      assert.equal((await call('/auth/login','POST',{ email,password:'incorrect' })).status,401);
      const response = await call('/auth/login','POST',{ email,password }); assert.equal(response.status,200);
      const body = (await response.json()).data, set = response.headers.get('set-cookie');
      assert.match(set,/HttpOnly/); assert.match(set,/SameSite=Strict/); assert.match(set,/Path=\/api\/auth/);
      cookie = set.split(';')[0]; assert.notEqual(cookie,oldCookie); assert.notEqual(body.csrfToken,csrf); csrf = body.csrfToken;
      assert.equal((await (await call('/auth/profile')).json()).data.id,userId);
      assert.equal((await call('/auth/profile','GET',undefined,{ Cookie:oldCookie })).status,401);
      assert.equal((await call('/auth/profile?userId='+randomUUID())).status,400);
    });
    await t.test('regular session cannot authenticate or authorize admin; admin cookie cannot authenticate user', async () => {
      assert.equal((await call('/admin/access')).status,401);
      assert.equal((await call('/auth/profile','GET',undefined,{ Cookie:cookie.replace('balaqoldau_user=','balaqoldau_admin=') })).status,401);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.admin_users WHERE email=$1',[email])).rows[0].n,0);
      const adminId=randomUUID(),adminToken=randomToken();
      const hash=await hashPassword('Synthetic admin fixture password!');
      await db.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[adminId,randomUUID()+'@example.com',hash,'editor']);
      await db.query("INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour')",[tokenHash(adminToken),randomToken(),adminId]);
      const adminCookie='balaqoldau_admin='+adminToken;
      assert.equal((await call('/admin/access','GET',undefined,{Cookie:adminCookie})).status,200);
      assert.equal((await call('/auth/profile','GET',undefined,{Cookie:adminCookie})).status,401);
    });
    await t.test('logout revokes stored session and clears cookie', async () => {
      const prior = cookie, response = await call('/auth/logout','POST',{}); assert.equal(response.status,204);
      assert.match(response.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
      assert.equal((await call('/auth/profile','GET',undefined,{ Cookie:prior })).status,401);
      cookie=undefined; await session();
    });
    await t.test('reset requests return generic acceptance, hashed tokens and configured-origin fragment links', async () => {
      assert.equal((await call('/auth/password-reset/request','POST',{ email })).status,202); await waitDelivery(1);
      assert.equal(deliveries[0].recipient,email); const link = new URL(deliveries[0].url);
      assert.equal(link.origin,origin); assert.equal(link.search,''); assert.equal(link.pathname,'/reset-password');
      const token = new URLSearchParams(link.hash.slice(1)).get('token');
      const stored = (await db.query('SELECT token_hash FROM balaqoldau.user_reset_tokens WHERE user_id=$1',[userId])).rows[0];
      assert.equal(stored.token_hash,userTokenHash(token)); assert.notEqual(stored.token_hash,token);
      const missing = await call('/auth/password-reset/request','POST',{ email:randomUUID()+'@example.com' });
      assert.equal(missing.status,202); assert.deepEqual(await missing.json(),{ data:{ accepted:true } });
    });
    await t.test('single-use reset changes password and revokes all authenticated sessions', async () => {
      const repo=userRepository(db), active=userToken(); await repo.anonymous(active,userToken());
      const candidate=await repo.loginCandidate(email), logged=userToken(); assert.equal(await repo.authenticate(active,logged,userToken(),userId,candidate.hash,3600),true);
      const token = new URLSearchParams(new URL(deliveries[0].url).hash.slice(1)).get('token');
      const short=await call('/auth/password-reset/confirm','POST',{token,password:'x'.repeat(7)});
      assert.equal(short.status,400);assert.equal((await short.json()).error.code,'PASSWORD_POLICY');
      assert.equal((await call('/auth/password-reset/confirm','POST',{ token,password:'Reset8x!' })).status,204);
      assert.equal(await repo.session(logged),undefined);
      cookie=undefined; await session();
      assert.equal((await call('/auth/password-reset/confirm','POST',{ token,password })).status,400);
      await start();
      assert.equal((await call('/auth/login','POST',{ email,password })).status,401);
      const good=await call('/auth/login','POST',{ email,password:'Reset8x!' }); assert.equal(good.status,200);
      cookie=good.headers.get('set-cookie').split(';')[0]; csrf=(await good.json()).data.csrfToken;
    });
    await t.test('server expiry and disabled users immediately lose access; duplicate cookies are rejected', async () => {
      assert.equal((await call('/auth/profile','GET',undefined,{ Cookie:cookie+'; '+cookie })).status,401);
      await db.query("UPDATE balaqoldau.user_sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[userId]);
      assert.equal((await call('/auth/profile')).status,401);
      const repo=userRepository(db), anon=userToken(), authed=userToken(); await repo.anonymous(anon,userToken());
      const candidate=await repo.loginCandidate(email); await repo.authenticate(anon,authed,userToken(),userId,candidate.hash,3600);
      await db.query('UPDATE balaqoldau.user_accounts SET disabled=true WHERE id=$1',[userId]); assert.equal(await repo.session(authed),undefined);
      await db.query('UPDATE balaqoldau.user_accounts SET disabled=false WHERE id=$1',[userId]); assert.equal(await repo.session(authed),undefined);
      cookie=undefined; await session();
    });
    await t.test('expired reset tokens, invalid tokens and SQL injection cannot change credentials', async () => {
      const token=userToken(), repo=userRepository(db); await repo.issueReset(email,token,1800);
      await db.query("UPDATE balaqoldau.user_reset_tokens SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1",[userTokenHash(token)]);
      assert.equal(await repo.reset(token, 'unused'),false);
      assert.equal((await call('/auth/password-reset/confirm','POST',{ token:"' OR 1=1--",password })).status,400);
      assert.equal((await call('/auth/login','POST',{ email:"' OR 1=1--",password })).status,400);
    });
    await t.test('unconfigured mail is honest and exposes no tokens', async () => {
      server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
      server=createApp(cfg,db).listen(0,'127.0.0.1'); await once(server,'listening');
      assert.equal((await session()).resetAvailable,false);
      const response=await call('/auth/password-reset/request','POST',{ email }); assert.equal(response.status,503);
      assert.doesNotMatch(await response.text(),/token_hash|postgres|stack/);
    });
    await t.test('mail failures remain generic and do not claim delivery or log personal data', async () => {
      const previous=console.error,logs=[];
      console.error=(...values)=>logs.push(values.join(' '));
      try{
        await start(async()=>{throw new Error('private-mail-token-and-address');});
        const response=await call('/auth/password-reset/request','POST',{email});assert.equal(response.status,202);
        assert.deepEqual(await response.json(),{data:{accepted:true}});
        for(let i=0;i<100&&!logs.length;i++)await new Promise(resolve=>setTimeout(resolve,10));
        assert.deepEqual(logs,['Password reset delivery failed']);
      }finally{console.error=previous;}
    });
    await t.test('persistent account throttles bound distributed login and reset attempts', async () => {
      await db.query('UPDATE balaqoldau.user_accounts SET login_attempts=0,login_window_ends=clock_timestamp(),reset_attempts=0,reset_window_ends=clock_timestamp() WHERE id=$1',[userId]);
      const repo=userRepository(db);
      for(let i=0;i<10;i++)assert.ok(await repo.loginCandidate(email));
      assert.equal(await repo.loginCandidate(email),undefined);
      for(let i=0;i<3;i++)assert.ok(await repo.issueReset(email,userToken(),1800));
      assert.equal(await repo.issueReset(email,userToken(),1800),undefined);
    });
    await t.test('IP brute-force gate is independent from admin and blocks before additional KDF work', async () => {
      await start(); cookie=undefined; await session();
      for(let i=0;i<5;i++) assert.equal((await call('/auth/login','POST',{ email:randomUUID()+'@example.com',password })).status,401);
      assert.equal((await call('/auth/login','POST',{ email,password })).status,429);
    });
    await t.test('production cookie flags and transport fail closed', async () => {
      await start(undefined,{ NODE_ENV:'production',TRUST_PROXY_LOOPBACK:true }); cookie=undefined;
      assert.equal((await call('/auth/session')).status,403);
      const response=await call('/auth/session','GET',undefined,{ 'X-Forwarded-Proto':'https' }); assert.equal(response.status,200);
      assert.match(response.headers.get('set-cookie'),/__Host-balaqoldau_user=.*; Path=\/;.*HttpOnly; Secure; SameSite=Strict/);
    });
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(db){await db.query('ROLLBACK');db.release();} await pool.end();
  }
});
