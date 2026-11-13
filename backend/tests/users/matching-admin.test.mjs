import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {openUserDatabase} from '../helpers/user-database.mjs';
import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';
import {hashPassword} from '../../dist/admin/password.js';
import {randomToken,tokenHash} from '../../dist/admin/repository.js';
test('eligibility completeness obeys existing RBAC, CSRF, revision and review workflow',async()=>{
  const {pool,config}=await openUserDatabase(),db=await pool.connect();let server;
  try{
    await db.query('BEGIN');const suffix='test-match-admin-'+randomUUID(),origin='https://admin.example.com';
    await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2)',[suffix,'TEST category']);
    await db.query('INSERT INTO balaqoldau.regions(slug,name) VALUES($1,$2)',[suffix,'TEST region']);
    const users={},hash=await hashPassword('TEST fixture password only!');
    for(const role of ['editor','reviewer','admin']){
      const id=randomUUID(),token=randomToken(),csrf=randomToken();users[role]={id,token,csrf};
      await db.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[id,id+'@example.com',hash,role]);
      await db.query("INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[tokenHash(token),csrf,id]);
    }
    server=createApp(parseEnvironment({...config,NODE_ENV:'test',ADMIN_ENABLED:'true',ADMIN_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin}),db).listen(0,'127.0.0.1');await once(server,'listening');
    const base='http://127.0.0.1:'+server.address().port;
    const call=(path,role,method,body,csrf=true)=>fetch(base+'/api/admin/programs'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(role?{Cookie:'balaqoldau_admin='+users[role].token,...(csrf?{'X-CSRF-Token':users[role].csrf}:{})}:{})},body:JSON.stringify(body)});
    const input={slug:suffix,category:suffix,title:'TEST rollback fixture',description:'TEST not official',regions:[suffix],sourceUrl:'https://example.com/test',sourceName:'TEST',ageMin:5,ageMax:10};
    assert.equal((await call('',null,'POST',input)).status,401);
    assert.equal((await call('','editor','POST',input,false)).status,403);
    let response=await call('','editor','POST',input);assert.equal(response.status,201);let p=(await response.json()).data;assert.equal(p.eligibilityComplete,false);
    assert.equal((await call('/'+p.id,'reviewer','PATCH',{version:p.version,eligibilityComplete:true})).status,403);
    response=await call('/'+p.id,'editor','PATCH',{version:p.version,eligibilityComplete:true});assert.equal(response.status,200);p=(await response.json()).data;assert.equal(p.eligibilityComplete,true);
    const action=async(name,role)=>{const response=await call('/'+p.id+'/'+name,role,'POST',{version:p.version});assert.equal(response.status,200);p=(await response.json()).data;};
    assert.equal((await call('/'+p.id+'/publish','admin','POST',{version:p.version})).status,409);
    await action('submit','editor');
    assert.equal((await call('/'+p.id,'editor','PATCH',{version:p.version,eligibilityComplete:false})).status,409);
    await action('approve','reviewer');await action('publish','admin');
    const match=await (await fetch(base+'/api/program-matches/'+p.id+'?age=6&region='+suffix)).json();assert.equal(match.data.matching.status,'MATCH');
    assert.equal((await call('/'+p.id,'admin','PATCH',{version:p.version,eligibilityComplete:false})).status,409);
    await action('unpublish','admin');assert.equal((await fetch(base+'/api/program-matches/'+p.id)).status,404);
    assert.ok((await db.query("SELECT count(*)::int AS n FROM balaqoldau.admin_audit_log WHERE target_id=$1 AND event='program.updated'",[p.id])).rows[0].n>=1);
  }finally{if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await db.query('ROLLBACK');db.release();await pool.end();}
});
