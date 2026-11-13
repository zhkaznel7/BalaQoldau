import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {once} from 'node:events';
import {openUserDatabase} from '../helpers/user-database.mjs';import {createApp} from '../../dist/app.js';import {parseEnvironment} from '../../dist/config/env.js';import {hashUserPassword} from '../../dist/admin/password.js';import {userToken,userTokenHash} from '../../dist/users/repository.js';
test('enhanced child information remains parent-only; interests rank without inventing eligibility',async t=>{
 const {pool,config}=await openUserDatabase(),db=await pool.connect();let server;
 try{await db.query('BEGIN');const users=[],hash=await hashUserPassword('TESTpass8'),origin='https://child.example.com';
  for(let n=0;n<2;n++){const u={id:randomUUID(),token:userToken(),csrf:userToken()};users.push(u);await db.query('INSERT INTO balaqoldau.user_accounts(id,email,password_hash) VALUES($1,$2,$3)',[u.id,u.id+'@example.com',hash]);await db.query("INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,expires_at,credential_version) VALUES($1,$2,$3,now()+interval '1 hour',1)",[userTokenHash(u.token),u.csrf,u.id]);}
  server=createApp(parseEnvironment({...config,USER_AUTH_ENABLED:'true',USER_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin}),db).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=(path,method='GET',body,u=users[0],csrf=true)=>fetch(base+path,{method,headers:{Origin:origin,...(u?{Cookie:'balaqoldau_user='+u.token,...(csrf?{'X-CSRF-Token':u.csrf}:{})}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const category=(await db.query("INSERT INTO balaqoldau.categories(slug,name) VALUES($1,'TEST interest') RETURNING id",['test-interest-'+randomUUID()])).rows[0].id;
  const slug=(await db.query('SELECT slug FROM balaqoldau.categories WHERE id=$1',[category])).rows[0].slug;
  const input={nickname:'TEST',age:8,region:'astana',preferences:[slug],fullName:'  TEST  Child ',gender:'female',interests:['sports'],familyContext:{supportNeeds:[]}};let child;
  await t.test('create, retrieve and edit preserve old fields; old clients cannot erase new private fields',async()=>{
   const r=await call('/auth/children','POST',input);assert.equal(r.status,201);child=(await r.json()).data;assert.equal(child.fullName,'TEST Child');assert.equal(child.gender,'female');assert.deepEqual(child.interests,['sports']);
   const legacy={nickname:child.nickname,age:child.age,region:child.region,preferences:child.preferences,version:child.version};
   const edit=await call('/auth/children/'+child.id,'PATCH',legacy);assert.equal(edit.status,200);child=(await edit.json()).data;assert.equal(child.fullName,'TEST Child');assert.deepEqual(child.interests,['sports']);
   const read=await(await call('/auth/children/'+child.id)).json();assert.equal(read.data.fullName,child.fullName);
  });
  await t.test('CSRF, unauthenticated requests, IDOR and invalid fields are rejected without leaking names',async()=>{
   assert.equal((await call('/auth/children','POST',input,null)).status,401);assert.equal((await call('/auth/children','POST',input,users[0],false)).status,403);
   for(const method of ['GET','PATCH','DELETE']){const r=await call('/auth/children/'+child.id,method,method==='PATCH'?{...input,version:child.version}:method==='DELETE'?{version:child.version,confirm:true}:undefined,users[1]);assert.equal(r.status,404);assert.ok(!(await r.text()).includes(child.fullName));}
   for(const patch of [{fullName:'123456789012'},{gender:'invalid'},{interests:['diagnosis']},{medicalDiagnosis:'private'}])assert.equal((await call('/auth/children','POST',{...input,...patch})).status,400);
   assert.deepEqual((await(await call('/auth/children','GET',undefined,users[1])).json()).data,[]);
   assert.equal((await call('/children/'+child.id)).status,404);
  });
  await t.test('interests only rank verified tags; unknown eligibility stays POSSIBLE and private attributes never leave the owner API',async()=>{
   const ids=[randomUUID(),randomUUID()].sort();
   for(const [n,need]of ['education-support','sports-activities'].entries()){
    await db.query("INSERT INTO balaqoldau.programs(id,slug,category_id,title,description,status,source_url,source_name,verified_at,eligibility_complete) VALUES($1,$2,$3,'TEST interest','TEST rollback fixture','published','https://example.com/test','TEST',now(),true)",[ids[n],'test-'+ids[n],category]);
    await db.query("INSERT INTO balaqoldau.program_regions(program_id,region_id) SELECT $1,id FROM balaqoldau.regions WHERE slug='astana'",[ids[n]]);
    await db.query('INSERT INTO balaqoldau.program_family_categories(program_id,family_category_id) SELECT $1,id FROM balaqoldau.family_categories WHERE slug=$2',[ids[n],need]);
   }
   const response=await call('/auth/children/'+child.id+'/recommendations'),payload=await response.json();assert.equal(response.status,200);assert.deepEqual(payload.data.map(p=>p.id),[ids[1],ids[0]]);
   assert.ok(!JSON.stringify(payload).includes(child.fullName));assert.ok(!JSON.stringify(payload).includes('gender'));assert.ok(payload.data.every(p=>JSON.stringify(p.matching).includes('POSSIBLE')));
   const publicResponse=await call('/programs?category='+slug);assert.ok(!(await publicResponse.text()).includes(child.fullName));
  });
  await t.test('explicit clearing and confirmed deletion erase only the selected profile',async()=>{
   const r=await call('/auth/children/'+child.id,'PATCH',{...input,fullName:null,gender:null,interests:[],version:child.version});assert.equal(r.status,200);child=(await r.json()).data;assert.equal(child.fullName,null);assert.equal(child.gender,null);assert.deepEqual(child.interests,[]);
   assert.equal((await call('/auth/children/'+child.id,'DELETE',{version:child.version,confirm:true})).status,204);assert.equal((await call('/auth/children/'+child.id)).status,404);
  });
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await db.query('ROLLBACK');db.release();await pool.end();}
});
