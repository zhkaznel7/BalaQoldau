import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {openUserDatabase} from '../helpers/user-database.mjs';
import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';
import {hashUserPassword} from '../../dist/admin/password.js';
import {userToken,userTokenHash} from '../../dist/users/repository.js';

test('private child CRUD and recommendations: ownership, consent, quota and matching, all fixtures rolled back',async t=>{
  const {pool,config}=await openUserDatabase(),db=await pool.connect();let server;
  try{
    await db.query('BEGIN');const suffix='test-child-'+randomUUID(),origin='https://parents.example.com';
    const region=(await db.query('INSERT INTO balaqoldau.regions(slug,name) VALUES($1,$2) RETURNING id',[suffix,'TEST region'])).rows[0].id;
    const category=(await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2) RETURNING id',[suffix,'TEST category'])).rows[0].id;
    const family=(await db.query('INSERT INTO balaqoldau.family_categories(slug,name) VALUES($1,$2) RETURNING id',[suffix,'TEST family - never a child preference'])).rows[0].id;
    const hash=await hashUserPassword('TESTpass8'),users=[];
    for(let i=0;i<2;i++){
      const u={id:randomUUID(),token:userToken(),csrf:userToken()};users.push(u);
      await db.query('INSERT INTO balaqoldau.user_accounts(id,email,password_hash) VALUES($1,$2,$3)',[u.id,u.id+'@example.com',hash]);
      await db.query("INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,expires_at,credential_version) VALUES($1,$2,$3,now()+interval '1 hour',1)",[userTokenHash(u.token),u.csrf,u.id]);
    }
    server=createApp(parseEnvironment({...config,NODE_ENV:'test',USER_AUTH_ENABLED:'true',USER_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin}),db).listen(0,'127.0.0.1');await once(server,'listening');
    const base='http://127.0.0.1:'+server.address().port+'/api';
    const call=(path,user=users[0],method='GET',body,csrf=true)=>fetch(base+'/auth'+path,{method,headers:{Origin:origin,...(user?{Cookie:'balaqoldau_user='+user.token,...(csrf?{'X-CSRF-Token':user.csrf}:{})}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const input={nickname:'TEST nickname',age:6,region:suffix,preferences:[suffix]};let child,second;
    await t.test('authentication, CSRF, strict input and supported taxonomy are required',async()=>{
      for(const path of ['/children','/children/options'])assert.equal((await call(path,null)).status,401);
      assert.equal((await call('/children',null,'POST',input)).status,401);
      assert.equal((await call('/children',users[0],'POST',input,false)).status,403);
      for(const extra of [{age:18},{age:-1},{age:6.5},{region:'unsupported-region'},{preferences:['unsupported-category']},{fullName:'private'},{medicalDiagnosis:'private'},{userId:users[1].id},{nickname:'123456789012'},{preferences:[suffix,suffix]}]){
        const response=await call('/children',users[0],'POST',{...input,...extra});assert.equal(response.status,400);assert.ok(!(await response.text()).includes('private'));
      }
      const options=await call('/children/options');assert.equal(options.headers.get('cache-control'),'no-store');const data=(await options.json()).data;
      assert.ok(data.regions.some(r=>r.slug===suffix));assert.ok(data.categories.some(r=>r.slug===suffix));assert.equal('familyCategories'in data,false);
    });
    await t.test('multiple children and minimal responses belong exclusively to the active parent',async()=>{
      let response=await call('/children',users[0],'POST',input);assert.equal(response.status,201);child=(await response.json()).data;
      response=await call('/children',users[0],'POST',{...input,nickname:null,age:0});assert.equal(response.status,201);second=(await response.json()).data;
      assert.equal((await (await call('/children')).json()).data.length,2);assert.deepEqual((await (await call('/children',users[1])).json()).data,[]);
      assert.deepEqual(Object.keys(child).sort(),['age','id','nickname','preferences','region','version']);
      assert.equal((await call('/children?userId='+users[1].id)).status,400);
    });
    await t.test('IDOR reads, writes, deletes and recommendations are indistinguishable from missing IDs',async()=>{
      for(const id of [child.id,randomUUID()]){
        for(const [path,method,body]of [['','GET',undefined],['','PATCH',{...input,version:1}],['','DELETE',{version:1,confirm:true}],['/recommendations','GET',undefined]])assert.equal((await call('/children/'+id+path,users[1],method,body)).status,404);
      }
      assert.equal((await call('/children/not-a-uuid')).status,400);
      assert.equal((await call('/children/'+child.id+'/recommendations?age=4')).status,400);
    });
    await t.test('updates preserve ownership; stale revisions and unconfirmed deletion fail',async()=>{
      assert.equal((await call('/children/'+child.id,users[0],'PATCH',{age:8,region:suffix,version:child.version})).status,400);
      assert.deepEqual((await (await call('/children/'+child.id)).json()).data,child,'omitted fields cannot erase profile data');
      assert.equal((await call('/children/'+child.id,users[0],'PATCH',{...input,age:8,version:child.version},false)).status,403);
      let response=await call('/children/'+child.id,users[0],'PATCH',{...input,age:8,version:child.version});assert.equal(response.status,200);child=(await response.json()).data;assert.equal(child.age,8);
      assert.equal((await call('/children/'+child.id,users[0],'PATCH',{...input,version:1})).status,409);
      response=await call('/children/'+child.id,users[0],'PATCH',{...input,age:child.age,preferences:[],version:child.version});assert.equal(response.status,200);child=(await response.json()).data;
      assert.deepEqual(child.preferences,[]);assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.child_preferences WHERE child_id=$1',[child.id])).rows[0].n,0);
      response=await call('/children/'+child.id,users[0],'PATCH',{...input,age:child.age,version:child.version});assert.equal(response.status,200);child=(await response.json()).data;assert.deepEqual(child.preferences,[suffix]);
      assert.equal((await call('/children/'+second.id,users[0],'DELETE',{version:second.version})).status,400);
      assert.equal((await call('/children/'+second.id,users[0],'DELETE',{version:second.version,confirm:true},false)).status,403);
      assert.equal((await call('/children/'+second.id,users[0],'DELETE',{version:second.version,confirm:true})).status,204);
      assert.equal((await call('/children/'+second.id)).status,404);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.child_preferences WHERE child_id=$1',[second.id])).rows[0].n,0);
    });
    await t.test('empty recommendations are honest; results never store child input or infer sensitive family status',async()=>{
      let response=await call('/children/'+child.id+'/recommendations');assert.equal(response.status,200);assert.deepEqual((await response.json()).data,[]);
      const ids={};
      for(const [key,status,demo,complete,min,max]of [['match','published',false,true,5,10],['unknown','published',false,false,0,17],['age','published',false,true,12,17],['family','published',false,true,5,10],['draft','draft',false,true,0,17],['demo','draft',true,false,0,17]]){
        const id=randomUUID();ids[key]=id;
        await db.query(`INSERT INTO balaqoldau.programs(id,slug,category_id,title,description,status,is_demo,eligibility_complete,age_min,age_max,source_url,source_name,verified_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'https://example.com/test','TEST source',now())`,[id,suffix+'-'+key,category,'TEST '+key,'Transient TEST fixture, not official',status,demo,complete,min,max]);
        await db.query('INSERT INTO balaqoldau.program_regions(program_id,region_id) VALUES($1,$2)',[id,region]);
        if(key==='family')await db.query('INSERT INTO balaqoldau.program_family_categories(program_id,family_category_id) VALUES($1,$2)',[id,family]);
      }
      response=await call('/children/'+child.id+'/recommendations?limit=2');assert.equal(response.status,200);let result=await response.json();assert.equal(result.pagination.total,4);assert.equal(result.data[0].id,ids.match);
      const all=(await (await call('/children/'+child.id+'/recommendations')).json()).data;
      assert.equal(all.find(p=>p.id===ids.match).matching.status,'MATCH');assert.equal(all.find(p=>p.id===ids.age).matching.status,'NOT_MATCH');
      assert.equal(all.find(p=>p.id===ids.unknown).matching.status,'POSSIBLE');assert.equal(all.find(p=>p.id===ids.family).matching.status,'POSSIBLE');
      assert.ok(all.find(p=>p.id===ids.family).matching.checks.some(c=>c.code==='NEED_MISSING'));
      assert.ok(all.every(p=>!('nickname'in p)&&!('userId'in p)&&!('childId'in p)));assert.equal((await call('/children/'+child.id+'/recommendations?limit=51')).status,400);
      assert.equal((await fetch(base+'/programs?category='+suffix)).status,200,'anonymous search remains public');
      const unchanged=(await (await call('/children/'+child.id)).json()).data;assert.deepEqual(unchanged,child);
    });
    await t.test('slot constraint bounds creation at 20; deleted slots are safely reusable',async()=>{
      for(let i=1;i<20;i++)assert.equal((await call('/children',users[0],'POST',{...input,nickname:null,preferences:[]})).status,201);
      const response=await call('/children',users[0],'POST',input);assert.equal(response.status,409);assert.equal((await response.json()).error.code,'CHILD_LIMIT');
      assert.equal((await (await call('/children')).json()).data.length,20);
    });
    await t.test('expired sessions cannot read or modify existing children',async()=>{
      await db.query("UPDATE balaqoldau.user_sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id=$1",[users[0].id]);
      for(const path of ['/children','/children/'+child.id,'/children/'+child.id+'/recommendations'])assert.equal((await call(path)).status,401);
    });
  }finally{if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await db.query('ROLLBACK');db.release();await pool.end();}
});
