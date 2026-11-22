import test from 'node:test';import assert from 'node:assert/strict';import {once}from'node:events';import{randomUUID}from'node:crypto';
import{openUserDatabase}from'../helpers/user-database.mjs';import{createApp}from'../../dist/app.js';import{parseEnvironment}from'../../dist/config/env.js';
import{hashPassword}from'../../dist/admin/password.js';import{randomToken,tokenHash}from'../../dist/admin/repository.js';import{userTokenHash}from'../../dist/users/repository.js';

test('verification, expiration, reports and immutable decisions: rollback-only dev fixtures',async t=>{
 const {pool,config}=await openUserDatabase(),db=await pool.connect();let server;
 try{
  await db.query('BEGIN');const slug='test-verify-'+randomUUID(),origin='https://staff.example.com';
  const category=(await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2) RETURNING id',[slug,'TEST category'])).rows[0].id;
  const region=(await db.query('INSERT INTO balaqoldau.regions(slug,name) VALUES($1,$2) RETURNING id',[slug,'TEST region'])).rows[0].id;
  const hash=await hashPassword('TEST verification fixture password!'),users={};
  for(const name of ['editor','other','reviewer','admin']){const u={id:randomUUID(),token:randomToken(),csrf:randomToken()};users[name]=u;
   await db.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[u.id,u.id+'@example.com',hash,name==='other'?'editor':name]);
   await db.query("INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[tokenHash(u.token),u.csrf,u.id]);}
  const parent={id:randomUUID(),token:randomToken(),csrf:randomToken()};
  await db.query('INSERT INTO balaqoldau.user_accounts(id,email,password_hash) VALUES($1,$2,$3)',[parent.id,parent.id+'@example.com',hash]);
  await db.query("INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,expires_at,credential_version) VALUES($1,$2,$3,now()+interval '1 hour',1)",[userTokenHash(parent.token),parent.csrf,parent.id]);
  const child=(await db.query('INSERT INTO balaqoldau.child_profiles(user_id,slot,age,region_id) VALUES($1,1,6,$2) RETURNING id',[parent.id,region])).rows[0].id;
  await db.query('INSERT INTO balaqoldau.child_preferences(child_id,category_id) VALUES($1,$2)',[child,category]);
  server=createApp(parseEnvironment({...config,NODE_ENV:'test',ADMIN_ENABLED:'true',ADMIN_ORIGIN:origin,USER_AUTH_ENABLED:'true',USER_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin,PROGRAM_REVIEW_DAYS:'7',RATE_LIMIT_MAX:'1000'}),db).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=(path,role='admin',method='GET',body,csrf=true)=>fetch(base+'/admin'+path,{method,headers:{Origin:origin,...(role?{Cookie:'balaqoldau_admin='+users[role].token,...(csrf?{'X-CSRF-Token':users[role].csrf}:{})}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const regular=path=>fetch(base+'/auth'+path,{headers:{Origin:origin,Cookie:'balaqoldau_user='+parent.token}});
  const input={slug,category:slug,title:'TEST verification fixture',description:'TEST only, never an official opportunity',sourceUrl:'https://example.com/test',sourceName:'TEST provider',ageMin:0,ageMax:17,regions:[slug],expiresOn:'2099-01-01'};
  const checks={sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true,notes:'TEST reviewed against synthetic source'};let p;
  const act=async(action,role,extra={})=>{const response=await call('/programs/'+p.id+'/'+action,role,'POST',{version:p.version,...(['publish','archive'].includes(action)?{confirm:true}:{}),...extra});assert.equal(response.status,200);p=(await response.json()).data;return p;};
  await t.test('strict source input, state selection, auth and CSRF cannot bypass review',async()=>{
   assert.equal((await call('/programs',null,'POST',input)).status,401);
   assert.equal((await call('/programs','editor','POST',input,false)).status,403);
   for(const extra of [{sourceUrl:'http://example.com'},{status:'published'},{expiresOn:'2026-02-30'},{verifiedAt:'2026-01-01'}])assert.equal((await call('/programs','editor','POST',{...input,...extra})).status,400);
   for(const [key,extra]of [['source',{sourceUrl:null,sourceName:null}],['region',{regions:[]}],['expired',{expiresOn:'2000-01-01'}]]){
     const response=await call('/programs','editor','POST',{...input,slug:slug+'-'+key,...extra});assert.equal(response.status,201);let fixture=(await response.json()).data;
     const submitted=await call('/programs/'+fixture.id+'/submit','editor','POST',{version:fixture.version});
     if(key==='source')assert.equal(submitted.status,409);else{assert.equal(submitted.status,200);fixture=(await submitted.json()).data;assert.equal((await call('/programs/'+fixture.id+'/approve','reviewer','POST',{version:fixture.version,...checks})).status,409);}
   }
   const response=await call('/programs','editor','POST',input);assert.equal(response.status,201);p=(await response.json()).data;
   assert.equal((await call('/programs/'+p.id+'/publish','admin','POST',{version:p.version})).status,400);
   assert.equal((await call('/programs/'+p.id+'/archive','admin','POST',{version:p.version})).status,400);
   assert.equal((await call('/programs/'+p.id+'/publish','admin','POST',{version:p.version,confirm:true})).status,409);
   const conflicting=await Promise.all([call('/programs/'+p.id,'editor','PATCH',{version:p.version,ageMin:1}),call('/programs/'+p.id,'editor','PATCH',{version:p.version,ageMin:2})]);assert.deepEqual(conflicting.map(r=>r.status).sort(),[200,409]);p=(await (await call('/programs/'+p.id)).json()).data;
   await act('submit','editor');
   assert.equal((await call('/programs/'+p.id+'/approve','editor','POST',{version:p.version,...checks})).status,403);
   for(const extra of [{},{...checks,sourceReviewed:false},{...checks,informationReviewed:false},{...checks,eligibilityReviewed:false}])assert.equal((await call('/programs/'+p.id+'/approve','reviewer','POST',{version:p.version,...extra})).status,400);
  });
  await t.test('rejection persists, owner reopens, independent reviewer verifies and Admin publishes',async()=>{
   await act('reject','reviewer',{notes:'TEST missing source detail'});assert.equal(p.status,'rejected');
   assert.equal((await call('/programs/'+p.id,'editor','PATCH',{version:p.version,title:'TEST attempt'})).status,409);
   await act('reopen','editor');await act('submit','editor');await act('approve','reviewer',checks);assert.equal(p.status,'verified');
   await db.query("UPDATE balaqoldau.programs SET verified_at=clock_timestamp()-interval '8 days' WHERE id=$1",[p.id]);
   assert.equal((await call('/programs/'+p.id+'/publish','admin','POST',{version:p.version,confirm:true})).status,409);
   await db.query('UPDATE balaqoldau.programs SET verified_at=clock_timestamp() WHERE id=$1',[p.id]);
   assert.equal((await call('/programs/'+p.id+'/publish','reviewer','POST',{version:p.version,confirm:true})).status,403);await act('publish','admin');assert.equal(p.status,'published');
   const history=await (await call('/programs/'+p.id+'/history')).json();assert.deepEqual(history.data.map(e=>e.decision),['approve','reject']);assert.equal(history.data[0].sourceReviewed,true);assert.equal(history.data[0].actorId,users.reviewer.id);
   await db.query('SAVEPOINT immutable');await assert.rejects(db.query("UPDATE balaqoldau.program_verifications SET notes='TEST tamper' WHERE program_id=$1",[p.id]));await db.query('ROLLBACK TO SAVEPOINT immutable');await db.query('RELEASE SAVEPOINT immutable');
   await db.query('INSERT INTO balaqoldau.user_saved_programs(user_id,program_id) VALUES($1,$2)',[parent.id,p.id]);
   assert.equal((await (await regular('/children/'+child+'/recommendations')).json()).pagination.total,1);
  });
  await t.test('anonymous reports are bounded, do not unpublish, and require authorized moderation',async()=>{
   const submit=body=>fetch(base+'/programs/'+p.id+'/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   assert.equal((await submit({reason:'outdated',explanation:'TEST check source'})).status,202);
   assert.equal((await submit({reason:'unknown',userId:parent.id})).status,400);
   assert.equal((await submit({reason:'source_broken'})).status,202);assert.equal((await submit({reason:'incorrect'})).status,202);assert.equal((await submit({reason:'other'})).status,202);assert.equal((await submit({reason:'other'})).status,429);
   assert.equal((await fetch(base+'/programs/'+p.id)).status,200);assert.equal((await (await call('/programs/'+p.id)).json()).data.version,p.version);
   assert.equal((await call('/reports','editor')).status,403);assert.equal((await call('/reports',null)).status,401);
   const report=(await (await call('/reports?status=open&programId='+p.id,'reviewer')).json()).data[0];
   await db.query('SAVEPOINT report_audit_guard');
   await db.query("CREATE FUNCTION pg_temp.reject_report_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'TEST report audit failure'; END;$$");
   await db.query("CREATE TRIGGER test_report_audit BEFORE INSERT ON balaqoldau.admin_audit_log FOR EACH ROW WHEN (NEW.event LIKE 'report.%') EXECUTE FUNCTION pg_temp.reject_report_audit()");
   const failed=await call('/reports/'+report.id,'reviewer','POST',{version:report.version,status:'reviewed'});assert.equal(failed.status,503);assert.equal((await failed.text()).includes('TEST report audit failure'),false);
   assert.deepEqual((await db.query('SELECT status,version FROM balaqoldau.program_reports WHERE id=$1',[report.id])).rows[0],{status:'open',version:report.version});
   await db.query('ROLLBACK TO SAVEPOINT report_audit_guard');await db.query('RELEASE SAVEPOINT report_audit_guard');
   assert.equal((await call('/reports/'+report.id,'reviewer','POST',{version:report.version,status:'resolved'})).status,409);
   assert.equal((await call('/reports/'+report.id,'reviewer','POST',{version:report.version,status:'reviewed'},false)).status,403);
   assert.equal((await call('/reports/'+report.id,'reviewer','POST',{version:report.version,status:'reviewed'})).status,200);
   assert.equal((await call('/reports/'+report.id,'reviewer','POST',{version:report.version,status:'dismissed'})).status,409);
   assert.equal((await call('/reports/'+report.id,'reviewer','POST',{version:report.version+1,status:'resolved'})).status,200);
  });
  await t.test('deadline and expiry use one public visibility boundary for search, detail, saved and children',async()=>{
   const hidden=async()=>{assert.equal((await fetch(base+'/programs/'+p.id)).status,404);assert.equal((await fetch(base+'/program-matches/'+p.id)).status,404);assert.equal((await (await fetch(base+'/programs?category='+slug)).json()).pagination.total,0);assert.equal((await (await regular('/saved-programs')).json()).data.length,0);assert.equal((await (await regular('/children/'+child+'/recommendations')).json()).pagination.total,0);};
   await db.query("UPDATE balaqoldau.programs SET deadline='2000-01-01' WHERE id=$1",[p.id]);await hidden();
   await db.query("UPDATE balaqoldau.programs SET deadline=NULL,expires_on='2000-01-01' WHERE id=$1",[p.id]);await hidden();
   await db.query("UPDATE balaqoldau.programs SET expires_on='2099-01-01',verified_at=now()-interval '30 days' WHERE id=$1",[p.id]);
   const dashboard=(await (await call('/programs/dashboard')).json()).data;assert.equal(dashboard.reviewPeriodDays,7);assert.ok(dashboard.counts.needsReverification>=1);
   const filtered=await call('/programs?category='+slug+'&region='+slug+'&needsReview=true&expiration=active');assert.equal(filtered.status,200);assert.equal((await filtered.json()).pagination.total,1);
   assert.equal((await call('/programs?verifiedFrom=2026-12-01&verifiedTo=2026-01-01')).status,400);
   assert.equal((await call('/programs/'+p.id+'/request-recheck','reviewer','POST',{version:p.version,notes:'TEST check'})).status,403);
   await act('request-recheck','admin',{notes:'TEST source needs rechecking'});await hidden();assert.equal(p.status,'published');
   await act('archive','admin');assert.equal(p.status,'archived');await hidden();
   assert.equal((await call('/programs/'+p.id+'/reopen','editor','POST',{version:p.version})).status,403);await act('reopen','admin');assert.equal(p.status,'draft');
  });
  await t.test('audit contains actor/target/status decisions, never notes or child facts',async()=>{
   const rows=(await db.query('SELECT event,actor_id,target_id,previous_status,new_status FROM balaqoldau.admin_audit_log WHERE target_id=$1',[p.id])).rows;
   for(const event of ['program.eligibility_changed','program.rejected','program.approved','program.published','program.archived','program.recheck_requested'])assert.ok(rows.some(r=>r.event===event));
   assert.ok((await db.query("SELECT 1 FROM balaqoldau.admin_audit_log WHERE event='report.resolved' AND actor_id=$1",[users.reviewer.id])).rows.length);
   assert.equal(JSON.stringify(rows).includes('TEST reviewed'),false);assert.equal(JSON.stringify(rows).includes(parent.id),false);
  });
 }finally{if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await db.query('ROLLBACK');db.release();await pool.end();}
});
