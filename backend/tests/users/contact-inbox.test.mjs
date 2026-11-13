import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {openUserDatabase} from '../helpers/user-database.mjs';
import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';
import {hashPassword} from '../../dist/admin/password.js';
import {randomToken,tokenHash} from '../../dist/admin/repository.js';
test('contact submission -> PostgreSQL -> private Admin inbox; fixtures roll back',async t=>{
 const {pool,config}=await openUserDatabase(),db=await pool.connect();let server;
 try{
  await db.query('BEGIN');const origin='https://admin.example.com',hash=await hashPassword('TEST contact fixture password!'),users={};
  for(const role of ['admin','editor','reviewer']){const u={id:randomUUID(),token:randomToken(),csrf:randomToken()};users[role]=u;
   await db.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[u.id,u.id+'@example.com',hash,role]);
   await db.query("INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[tokenHash(u.token),u.csrf,u.id]);}
  server=createApp(parseEnvironment({...config,NODE_ENV:'test',CORS_ALLOWED_ORIGINS:origin,ADMIN_ENABLED:'true',ADMIN_ORIGIN:origin,RATE_LIMIT_MAX:'1000'}),db).listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=(path,role=null,method='GET',body,csrf=true)=>fetch(base+path,{method,headers:{Origin:origin,...(role?{Cookie:'balaqoldau_admin='+users[role].token,...(csrf?{'X-CSRF-Token':users[role].csrf}:{})}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const input={senderName:'TEST fixture',email:'test-'+randomUUID()+'@example.com',message:'TEST <script>untrusted content</script> fixture only',submissionId:randomUUID()};let id,message;
  await t.test('durable insert, same-key replay and conflict do not create duplicates or overwrite content',async()=>{
   let response=await call('/contact-messages',null,'POST',input);assert.equal(response.status,201);id=(await response.json()).data.id;
   const record=(await db.query('SELECT status,version,message FROM balaqoldau.contact_messages WHERE id=$1',[id])).rows[0];assert.deepEqual(record,{status:'unread',version:1,message:input.message});
   response=await call('/contact-messages',null,'POST',input);assert.equal(response.status,201);assert.equal((await response.json()).data.id,id);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.contact_messages WHERE submission_id=$1',[input.submissionId])).rows[0].n,1);
   response=await call('/contact-messages',null,'POST',{...input,message:'TEST different content'});assert.equal(response.status,409);assert.ok(!(await response.text()).includes(input.email));
  });
  await t.test('database failure never reports success or exposes details; public spam quota is retained',async()=>{
   const query=db.query.bind(db);db.query=async(...args)=>{if(String(args[0]).startsWith('INSERT INTO balaqoldau.contact_messages'))throw new Error('PRIVATE DATABASE DETAILS');return query(...args);};
   try{const response=await call('/contact-messages',null,'POST',{...input,submissionId:randomUUID()});assert.equal(response.status,500);assert.ok(!(await response.text()).includes('PRIVATE DATABASE'));}finally{db.query=query;}
   assert.equal((await call('/contact-messages',null,'POST',{...input,submissionId:randomUUID()})).status,201);
   const limited=await call('/contact-messages',null,'POST',input);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  });
  await t.test('inbox is Admin-only, paginated/filterable and never available publicly',async()=>{
   for(const role of [null,'editor','reviewer'])for(const path of ['/admin/contact-messages','/admin/contact-messages/'+id]){const r=await call(path,role);assert.equal(r.status,role?403:401);assert.ok(!(await r.text()).includes(input.email));}
   assert.equal((await call('/contact-messages')).status,405);
   const result=await call('/admin/contact-messages?status=unread&limit=50','admin');assert.equal(result.status,200);const p=await result.json();assert.ok(p.data.some(m=>m.id===id&&m.preview===input.message));assert.ok(p.unreadCount>=1);
   assert.equal((await call('/admin/contact-messages?limit=1&page=1','admin')).status,200);
   for(const suffix of ['?limit=51','?status=invalid','?q=private','/not-a-uuid'])assert.equal((await call('/admin/contact-messages'+suffix,'admin')).status,400);
   const detail=await call('/admin/contact-messages/'+id,'admin');message=(await detail.json()).data;assert.equal(message.message,input.message);assert.equal(message.submission_digest,undefined);
  });
  await t.test('NEW -> READ -> RESOLVED, reopening, CSRF and version races are enforced',async()=>{
   assert.equal((await call('/admin/contact-messages/'+id,'admin','POST',{version:message.version,status:'read'},false)).status,403);
   assert.equal((await call('/admin/contact-messages/'+id,'admin','POST',{version:message.version,status:'resolved'})).status,409);
   for(const status of ['read','resolved','read']){const response=await call('/admin/contact-messages/'+id,'admin','POST',{version:message.version,status});assert.equal(response.status,200);message=(await response.json()).data;assert.equal(message.status,status);}
   const results=await Promise.all([call('/admin/contact-messages/'+id,'admin','POST',{version:message.version,status:'resolved'}),call('/admin/contact-messages/'+id,'admin','POST',{version:message.version,status:'resolved'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
   const resolved=await call('/admin/contact-messages?status=resolved','admin');assert.ok((await resolved.json()).data.some(m=>m.id===id));
  });
  await t.test('status and audit are atomic; logs contain UUID metadata, not message/email/name',async()=>{
   const before=(await db.query('SELECT status,version FROM balaqoldau.contact_messages WHERE id=$1',[id])).rows[0],query=db.query.bind(db);
   db.query=async(...args)=>{if(String(args[0]).includes('INSERT INTO balaqoldau.admin_audit_log')&&args[1]?.[0]==='contact.reopened')throw new Error('TEST audit outage');return query(...args);};
   try{assert.equal((await call('/admin/contact-messages/'+id,'admin','POST',{version:before.version,status:'read'})).status,503);}finally{db.query=query;}
   assert.deepEqual((await db.query('SELECT status,version FROM balaqoldau.contact_messages WHERE id=$1',[id])).rows[0],before);
   const audit=(await db.query("SELECT event,actor_id,target_id,permission FROM balaqoldau.admin_audit_log WHERE actor_id=$1 AND permission='contacts:manage'",[users.admin.id])).rows;
   assert.ok(audit.some(e=>e.event==='contact.resolved'));assert.ok(!JSON.stringify(audit).includes(input.email));assert.ok(!JSON.stringify(audit).includes(input.message));
  });
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await db.query('ROLLBACK');db.release();await pool.end();}
});
