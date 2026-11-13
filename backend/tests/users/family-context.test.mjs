import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {once} from 'node:events';
import {openUserDatabase} from '../helpers/user-database.mjs';import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';import {userToken,userTokenHash} from '../../dist/users/repository.js';
import {hashUserPassword} from '../../dist/admin/password.js';
test('private household/child context: ownership, CSRF, preservation, erasure and no public matching inference',async t=>{
 const {pool,config}=await openUserDatabase(),db=await pool.connect();let server;
 try{await db.query('BEGIN');const origin='https://parents.example.com',users=[],hash=await hashUserPassword('TESTpass8');
  for(let i=0;i<2;i++){const u={id:randomUUID(),token:userToken(),csrf:userToken()};users.push(u);await db.query('INSERT INTO balaqoldau.user_accounts(id,email,password_hash) VALUES($1,$2,$3)',[u.id,u.id+'@example.com',hash]);await db.query("INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,expires_at,credential_version) VALUES($1,$2,$3,now()+interval '1 hour',1)",[userTokenHash(u.token),u.csrf,u.id]);}
  server=createApp(parseEnvironment({...config,USER_AUTH_ENABLED:'true',USER_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin}),db).listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api/auth';
  const call=(path,method='GET',body,u=users[0],csrf=true)=>fetch(base+path,{method,headers:{Origin:origin,...(u?{Cookie:'balaqoldau_user='+u.token,...(csrf?{'X-CSRF-Token':u.csrf}:{})}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const familyContext={childrenCount:3,singleParent:true,largeFamily:null,disabilitySupportEligible:false,supportNeeds:['sports-activities']},profile={fullName:'TEST',location:null,familyContext};let child;
  await t.test('parent flags require session and CSRF; omitted fields preserve, null erases',async()=>{
   assert.equal((await call('/profile','PATCH',profile,null)).status,401);assert.equal((await call('/profile','PATCH',profile,users[0],false)).status,403);
   let response=await call('/profile','PATCH',profile);assert.equal(response.status,200);assert.deepEqual((await response.json()).data.familyContext,familyContext);
   const other=(await(await call('/profile','GET',undefined,users[1])).json()).data;assert.equal(other.familyContext,null);
   response=await call('/profile','PATCH',{fullName:'TEST',location:null});assert.deepEqual((await response.json()).data.familyContext,familyContext);
   assert.equal((await call('/profile','PATCH',{...profile,familyContext:{medicalDiagnosis:'private'}})).status,400);
   response=await call('/profile','PATCH',{...profile,familyContext:null});assert.equal((await response.json()).data.familyContext,null);
  });
  await t.test('child context remains owner-only, optional and clearable',async()=>{
   const input={nickname:null,age:5,region:'astana',preferences:[],familyContext:{disabilitySupportEligible:true,supportNeeds:['education-support']}};
   let response=await call('/children','POST',input);assert.equal(response.status,201);child=(await response.json()).data;assert.deepEqual(child.familyContext,input.familyContext);
   assert.equal((await call('/children/'+child.id,'PATCH',{...input,version:child.version},users[1])).status,404);
   assert.equal((await call('/children/'+child.id,'PATCH',{...input,version:child.version},users[0],false)).status,403);
   response=await call('/children/'+child.id,'PATCH',{age:5,region:'astana',preferences:[],nickname:null,version:child.version});assert.equal(response.status,200);child=(await response.json()).data;assert.deepEqual(child.familyContext,input.familyContext);
   response=await call('/children/'+child.id,'PATCH',{...input,version:child.version,familyContext:null});assert.equal(response.status,200);child=(await response.json()).data;assert.equal(child.familyContext,null);
   const session=(await(await call('/session')).json()).data;assert.equal(session.user.familyContext,undefined);
   const results=await call('/children/'+child.id+'/recommendations');assert.equal(results.status,200);assert.equal(JSON.stringify(await results.json()).includes('disabilitySupportEligible'),false);
  });
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await db.query('ROLLBACK');db.release();await pool.end();}
});
