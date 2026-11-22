import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {once} from 'node:events';
import {openUserDatabase} from '../helpers/user-database.mjs';import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';import {userToken,userTokenHash} from '../../dist/users/repository.js';
import {hashPassword} from '../../dist/admin/password.js';
test('both inboxes: private replies, delivery truthfulness, replay protection and audit atomicity',async t=>{
 const {pool,config}=await openUserDatabase(),db=await pool.connect();let server;let deliveries=0,mailFails=false;
 try{await db.query('BEGIN');const origin='https://reply.example.com',hash=await hashPassword('TEST reply password!'),actors={};
  for(const role of ['admin','editor','reviewer','parent','other']){
   const u={id:randomUUID(),token:userToken(),csrf:userToken()};actors[role]=u;
   if(['parent','other'].includes(role)){
    await db.query('INSERT INTO balaqoldau.user_accounts(id,email,password_hash) VALUES($1,$2,$3)',[u.id,u.id+'@example.com',hash]);
    await db.query("INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,expires_at,credential_version) VALUES($1,$2,$3,now()+interval '1 hour',1)",[userTokenHash(u.token),u.csrf,u.id]);
   }else{
    await db.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[u.id,u.id+'@example.com',hash,role]);
    await db.query("INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[userTokenHash(u.token),u.csrf,u.id]);
   }
  }
  const settings=parseEnvironment({...config,NODE_ENV:'test',USER_AUTH_ENABLED:'true',USER_ORIGIN:origin,ADMIN_ENABLED:'true',ADMIN_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin,RATE_LIMIT_MAX:'1000'});
  server=createApp(settings,db,undefined,undefined,async()=>{deliveries++;if(mailFails)throw new Error('PRIVATE mail detail');}).listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=(path,role='admin',method='GET',body,csrf=true)=>{const u=actors[role],regular=['parent','other'].includes(role);return fetch(base+path,{method,headers:{Origin:origin,...(u?{Cookie:(regular?'balaqoldau_user=':'balaqoldau_admin=')+u.token,...(csrf?{'X-CSRF-Token':u.csrf}:{})}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});};
  const contact={senderName:'TEST',email:'different@example.com',message:'TEST only',submissionId:randomUUID()};
  let id,reportId;
  await t.test('authenticated contact ownership comes from the session, not editable email or user ID',async()=>{
   const response=await call('/auth/contact-messages','parent','POST',contact);assert.equal(response.status,201);id=(await response.json()).data.id;
   assert.equal((await db.query('SELECT user_id FROM balaqoldau.contact_messages WHERE id=$1',[id])).rows[0].user_id,actors.parent.id);
   assert.equal((await call('/auth/contact-messages','other','POST',contact)).status,409);
   assert.equal((await call('/auth/contact-messages','parent','POST',{...contact,userId:actors.other.id})).status,400);
   assert.equal((await call('/auth/contact-messages','parent','POST',contact,false)).status,403);
   const program=randomUUID();
   await db.query(`INSERT INTO balaqoldau.programs(id,slug,category_id,title,description,status,source_url,source_name,verified_at)
    SELECT $1,$2,id,'TEST reply fixture','TEST fixture, rolled back','published','https://example.com/test','TEST',now() FROM balaqoldau.categories WHERE slug='clubs'`,[program,'test-reply-'+program]);
   const report=await call('/auth/programs/'+program+'/reports','parent','POST',{reason:'incorrect',explanation:'TEST'});assert.equal(report.status,202);
   reportId=(await db.query('SELECT id FROM balaqoldau.program_reports WHERE program_id=$1 AND user_id=$2',[program,actors.parent.id])).rows[0].id;
  });
  await t.test('RBAC, authentication, CSRF and strict validation cover both reply endpoints',async()=>{
   for(const [kind,target]of [['contact-messages',id],['reports',reportId]]){
    const path='/admin/'+kind+'/'+target+'/replies',input={submissionId:randomUUID(),text:'TEST reply'};
    assert.equal((await call(path,'none')).status,401);assert.equal((await call(path,'editor','POST',input)).status,403);
    if(kind==='contact-messages')assert.equal((await call(path,'reviewer','POST',input)).status,403);
    assert.equal((await call(path,'admin','POST',input,false)).status,403);
    assert.equal((await call(path,'admin','POST',{...input,text:' '})).status,400);
    assert.equal((await call(path,'admin','POST',{...input,recipient:actors.other.id})).status,400);
   }
  });
  await t.test('account delivery preserves statuses, stores author/time and never sends email; replay is idempotent',async()=>{
   mailFails=true; // A broken email service cannot block in-app delivery.
   for(const [kind,target,role]of [['contact-messages',id,'admin'],['reports',reportId,'reviewer']]){
    const path='/admin/'+kind+'/'+target+'/replies',input={submissionId:randomUUID(),text:"TEST <script>not HTML</script> ' OR 1=1 --"};
    let r=await call(path,role,'POST',input);assert.equal(r.status,201);const reply=(await r.json()).data;
    assert.equal(reply.adminId,actors[role].id);assert.equal(reply.deliveryStatus,'account');assert.ok(reply.createdAt&&reply.deliveredAt);
    r=await call(path,role,'POST',input);assert.equal((await r.json()).data.id,reply.id);
    assert.equal((await call(path,role,'POST',{...input,text:'different'})).status,409);
    const history=(await(await call(path)).json()).data;assert.equal(history.length,1);assert.equal(history[0].text,input.text);
   }
   assert.equal(deliveries,0);
   mailFails=false;
   assert.equal((await db.query('SELECT status FROM balaqoldau.contact_messages WHERE id=$1',[id])).rows[0].status,'unread');
   assert.equal((await db.query('SELECT status FROM balaqoldau.program_reports WHERE id=$1',[reportId])).rows[0].status,'open');
   assert.equal((await call('/auth/messages','none')).status,401);
   const messages=await(await call('/auth/messages?limit=20&page=1','parent')).json();assert.equal(messages.data.length,2);assert.equal(messages.pagination.total,2);
   assert.deepEqual((await(await call('/auth/messages','other')).json()).data,[]);
   assert.equal((await call('/auth/messages?userId='+actors.parent.id,'other')).status,400);
   assert.equal((await call('/auth/messages?limit=51','parent')).status,400);
  });
  await t.test('anonymous email acceptance differs from failure and unaddressable reports; no duplicate dispatch',async()=>{
   const anonymous=(await db.query("INSERT INTO balaqoldau.contact_messages(sender_name,email,message) VALUES('TEST','fixture@example.com','TEST') RETURNING id")).rows[0].id;
   const path='/admin/contact-messages/'+anonymous+'/replies',input={submissionId:randomUUID(),text:'TEST email'};
   let response=await call(path,'admin','POST',input);assert.equal(response.status,201);assert.equal((await response.json()).data.deliveryStatus,'email_accepted');
   await call(path,'admin','POST',input);assert.equal(deliveries,1);
   mailFails=true;response=await call(path,'admin','POST',{...input,submissionId:randomUUID()});assert.equal(response.status,201);const failure=await response.json();assert.equal(failure.data.deliveryStatus,'saved_not_delivered');assert.ok(!JSON.stringify(failure).includes('PRIVATE'));
   const anonymousReport=(await db.query("INSERT INTO balaqoldau.program_reports(program_id,reason) SELECT program_id,'other' FROM balaqoldau.program_reports WHERE id=$1 RETURNING id",[reportId])).rows[0].id;
   response=await call('/admin/reports/'+anonymousReport+'/replies','admin','POST',{...input,submissionId:randomUUID()});assert.equal((await response.json()).data.deliveryStatus,'saved_not_delivered');assert.equal(deliveries,2);
   // Existing anonymous rows must not become visible through email matching.
   assert.equal((await(await call('/auth/messages','parent')).json()).data.length,2);
  });
  await t.test('audit failure rolls back reply; audit stores metadata only',async()=>{
   const query=db.query.bind(db),input={submissionId:randomUUID(),text:'TEST private reply'};
   db.query=async(...args)=>{if(String(args[0]).includes('INSERT INTO balaqoldau.admin_audit_log')&&args[1]?.[0]==='contact.replied')throw new Error('TEST audit outage');return query(...args);};
   try{assert.equal((await call('/admin/contact-messages/'+id+'/replies','admin','POST',input)).status,503);}finally{db.query=query;}
   assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.inbox_replies WHERE submission_id=$1',[input.submissionId])).rows[0].n,0);
   const audit=(await db.query("SELECT event,actor_id,target_id FROM balaqoldau.admin_audit_log WHERE actor_id=$1 AND event='contact.replied'",[actors.admin.id])).rows;assert.ok(audit.length);assert.ok(!JSON.stringify(audit).includes(input.text));
  });
  await t.test('without a configured mail service anonymous replies are saved, not delivered',async()=>{
   const app=createApp(settings,db).listen(0,'127.0.0.1');await once(app,'listening');
   try{
    const target=(await db.query("INSERT INTO balaqoldau.contact_messages(sender_name,email,message) VALUES('TEST','none@example.com','TEST') RETURNING id")).rows[0].id;
    const response=await fetch('http://127.0.0.1:'+app.address().port+'/api/admin/contact-messages/'+target+'/replies',{method:'POST',headers:{Origin:origin,Cookie:'balaqoldau_admin='+actors.admin.token,'X-CSRF-Token':actors.admin.csrf,'Content-Type':'application/json'},body:JSON.stringify({submissionId:randomUUID(),text:'TEST no service'})});
    assert.equal(response.status,201);assert.equal((await response.json()).data.deliveryStatus,'saved_not_delivered');
   }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
  });
  await t.test('account ownership, not email outcome, controls inbox; matching anonymous email never grants ownership',async()=>{
   const original=(await db.query('SELECT status FROM balaqoldau.contact_messages WHERE id=$1',[id])).rows[0].status;
   await db.query("INSERT INTO balaqoldau.inbox_replies(contact_id,admin_id,submission_id,body,delivery_status) VALUES($1,$2,$3,'TEST legacy mail failure','saved_not_delivered')",[id,actors.admin.id,randomUUID()]);
   const anon=(await db.query("INSERT INTO balaqoldau.contact_messages(sender_name,email,message) VALUES('TEST',$1,'TEST same email, no ownership') RETURNING id",[actors.parent.id+'@example.com'])).rows[0].id;
   const response=await call('/admin/contact-messages/'+anon+'/replies','admin','POST',{submissionId:randomUUID(),text:'TEST anonymous, never associate'});assert.equal(response.status,201);
   const own=(await(await call('/auth/messages','parent')).json()).data;assert.equal(own.length,3);assert.ok(own.some(r=>r.text==='TEST legacy mail failure'));assert.ok(!own.some(r=>r.text==='TEST anonymous, never associate'));
   assert.deepEqual((await(await call('/auth/messages','other')).json()).data,[]);
   assert.equal((await db.query('SELECT status FROM balaqoldau.contact_messages WHERE id=$1',[id])).rows[0].status,original);
  });
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await db.query('ROLLBACK');db.release();await pool.end();}
});
