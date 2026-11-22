import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminApi,AdminError,parseRetryAfter} from '../src/admin/api.ts';
const id='11111111-1111-4111-8111-111111111111',csrf='b'.repeat(64);
const session={authenticated:true,admin:{id},csrfToken:csrf};
test('concurrent session/access subscribers share requests; aborting one does not abort others',async()=>{
  let release,calls=0;const controller=new AbortController();
  const api=createAdminApi('/api/admin',async url=>{calls++;if(url.endsWith('/session')){await new Promise(resolve=>release=resolve);return Response.json({data:session});}return Response.json({data:{id,role:'editor',permissions:['programs:read']}});});
  const first=api.session(controller.signal),second=api.session();controller.abort();
  await assert.rejects(first,error=>error.name==='AbortError');release();assert.equal((await second).authenticated,true);
  assert.equal(calls,1);
  const access=await Promise.all([api.access(),api.access(),api.access()]);assert.equal(calls,2);assert.equal(access.length,3);
});
test('429 respects Retry-After without clearing CSRF, logging out or automatically retrying',async()=>{
  let calls=0,expired=0;const api=createAdminApi('/api/admin',async url=>{calls++;return url.endsWith('/session')?Response.json({data:session}):Response.json({}, {status:429,headers:{'Retry-After':'30'}});},()=>expired++);
  await api.session();let failure;
  try{await api.access();}catch(error){failure=error;}
  assert.ok(failure instanceof AdminError);assert.equal(failure.status,429);assert.ok(failure.retryAt>Date.now()+28000);
  await assert.rejects(api.session(),error=>error.status===429);assert.equal(calls,2);assert.equal(expired,0);
});
test('Retry-After supports seconds and HTTP dates and rejects malformed values',()=>{
  const now=Date.parse('2026-11-13T00:00:00Z');
  assert.equal(parseRetryAfter('10',now),now+10000);
  assert.equal(parseRetryAfter('Fri, 13 Nov 2026 00:00:30 GMT',now),now+30000);
  for(const value of [null,'invalid','-1','0.5','9'.repeat(40)])assert.equal(parseRetryAfter(value,now),undefined);
});
test('rate-limit recovery and transient server/network errors do not expire valid sessions',async()=>{
  for(const status of [403,429,500,503,0]){
    let expired=0,fail=false,calls=0;
    const api=createAdminApi('/api/admin',async()=>{calls++;if(fail){if(!status)throw new Error('private network error');return Response.json({}, {status,headers:{'Retry-After':'0'}});}return Response.json({data:session});},()=>expired++);
    await api.session();fail=true;await assert.rejects(api.session(),error=>error.status===status);assert.equal(expired,0);
    fail=false;assert.equal((await api.session()).authenticated,true);assert.equal(calls,3);
  }
  let expired=0;const api=createAdminApi('/api/admin',async()=>Response.json({}, {status:401}),()=>expired++);
  await assert.rejects(api.session(),error=>error.status===401);assert.equal(expired,1);
});
test('a stale 401 from before login cannot expire the new authenticated session',async()=>{
  let finish,expired=0,authenticated=false;
  const api=createAdminApi('/api/admin',async url=>{
    if(url.endsWith('/access'))return await new Promise(resolve=>finish=resolve);
    if(url.endsWith('/login'))authenticated=true;
    return Response.json({data:authenticated?session:{...session,authenticated:false,admin:null}});
  },()=>expired++);
  const old=api.access();await api.login('test@example.com','Synthetic password only!');
  finish(Response.json({}, {status:401}));await assert.rejects(old,error=>error.status===401);
  assert.equal(expired,0);assert.equal((await api.session()).authenticated,true);
});
test('login joins an in-flight anonymous check and uses its CSRF without duplicate sessions',async()=>{
  let finish,calls=0,loginCsrf;
  const api=createAdminApi('/api/admin',async(url,init)=>{
    if(url.endsWith('/session')){calls++;return await new Promise(resolve=>finish=resolve);}
    loginCsrf=init.headers['X-CSRF-Token'];return Response.json({data:session});
  });
  const checking=api.session(),login=api.login('test@example.com','Synthetic password only!');
  finish(Response.json({data:{...session,authenticated:false,admin:null}}));
  await checking;assert.equal((await login).authenticated,true);assert.equal(calls,1);assert.equal(loginCsrf,csrf);
});
test('a stalled shared verification is bounded and cannot expire a valid session',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let expired=0;
  const api=createAdminApi('/api/admin',async(_url,init)=>await new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})),()=>expired++);
  const checking=api.session();t.mock.timers.tick(10000);
  await assert.rejects(checking,error=>error instanceof AdminError&&error.status===0);assert.equal(expired,0);
});
