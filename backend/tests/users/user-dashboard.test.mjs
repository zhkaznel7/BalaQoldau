import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {openUserDatabase} from '../helpers/user-database.mjs';
import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';
import {userToken,userTokenHash} from '../../dist/users/repository.js';
import {hashUserPassword} from '../../dist/admin/password.js';
import {dashboardRepository} from '../../dist/users/dashboard-repository.js';

test('profile/saved APIs enforce current-session ownership; only rolled-back synthetic fixtures',async t=>{
  const {pool,config}=await openUserDatabase();let db,server;
  try{
    db=await pool.connect();await db.query('BEGIN');
    const origin='https://parents.example.com',users=[];
    const hash=await hashUserPassword('User8pw!');
    for(let i=0;i<2;i++){
      const user={id:randomUUID(),token:userToken(),csrf:userToken()};users.push(user);
      await db.query('INSERT INTO balaqoldau.user_accounts(id,email,password_hash) VALUES($1,$2,$3)',[user.id,user.id+'@example.com',hash]);
      await db.query("INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour')",[userTokenHash(user.token),user.csrf,user.id]);
    }
    const category=(await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2) RETURNING id',['test-'+randomUUID(),'TEST rollback category'])).rows[0].id;
    const ids=[];
    for(const [status,demo]of [['published',false],['draft',false],['draft',true],['published',false]]){
      const id=randomUUID();ids.push(id);
      await db.query(`INSERT INTO balaqoldau.programs(id,slug,category_id,title,description,status,is_demo,source_url,source_name,verified_at,age_max)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp(),17)`,[id,'test-'+id,category,'TEST synthetic opportunity — rollback only','Not a real benefit',status,demo,'https://example.com/test','TEST source']);
    }
    server=createApp(parseEnvironment({CORS_ALLOWED_ORIGINS:origin,DATABASE_URL:config.DATABASE_URL,USER_AUTH_ENABLED:'true',USER_ORIGIN:origin}),db).listen(0,'127.0.0.1');await once(server,'listening');
    const call=(path,user=users[0],method='GET',body,extra={})=>fetch(`http://127.0.0.1:${server.address().port}/api/auth`+path,{method,
      headers:{Origin:origin,...(user?{Cookie:'balaqoldau_user='+user.token,'X-CSRF-Token':user.csrf}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    await t.test('profile read/update requires authentication, CSRF and strict normalized inputs',async()=>{
      assert.equal((await call('/profile',null)).status,401);
      assert.equal((await call('/profile',users[0],'PATCH',{fullName:'TEST',location:null},{'X-CSRF-Token':'bad'})).status,403);
      assert.equal((await call('/profile',users[0],'PATCH',{fullName:'TEST',location:null,email:'new@example.com'})).status,400);
      assert.equal((await call('/profile',users[0],'PATCH',{fullName:'a'.repeat(101),location:null})).status,400);
      const response=await call('/profile',users[0],'PATCH',{fullName:'  TEST   Parent ',location:' TEST city '});assert.equal(response.status,200);
      const p=(await response.json()).data;assert.equal(p.fullName,'TEST Parent');assert.equal(p.location,'TEST city');assert.equal(p.savedCount,0);
      assert.equal(p.email,users[0].id+'@example.com');
      assert.equal((await (await call('/profile',users[1])).json()).data.fullName,null);
      assert.equal((await call('/profile?userId='+users[1].id)).status,400);
    });
    await t.test('saving is idempotent and private; anonymous, CSRF and IDOR requests fail',async()=>{
      assert.equal((await call('/saved-programs/'+ids[0],null,'POST',{})).status,401);
      assert.equal((await call('/saved-programs/'+ids[0],users[0],'POST',{}, {'X-CSRF-Token':'bad'})).status,403);
      assert.equal((await call('/saved-programs/'+ids[0],users[0],'POST',{userId:users[1].id})).status,400);
      for(let i=0;i<2;i++)assert.equal((await call('/saved-programs/'+ids[0],users[0],'POST',{})).status,204);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.user_saved_programs WHERE user_id=$1',[users[0].id])).rows[0].n,1);
      assert.equal((await (await call('/profile')).json()).data.savedCount,1);
      const result=await call('/saved-programs?page=1&limit=1');assert.equal(result.status,200);const list=await result.json();assert.equal(list.data[0].id,ids[0]);assert.equal(list.pagination.total,1);
      assert.equal((await (await call('/saved-programs',users[1])).json()).data.length,0);
      assert.equal((await call('/saved-programs?userId='+users[0].id,users[1])).status,400);
      assert.deepEqual((await (await call('/saved-programs/status?ids='+ids[0],users[1])).json()).data,[]);
      assert.deepEqual((await (await call('/saved-programs/status?ids='+ids[0])).json()).data,[ids[0]]);
    });
    await t.test('draft/DEMO/missing records are not savable and pagination/injection input is rejected',async()=>{
      for(const id of [ids[1],ids[2],randomUUID()])assert.equal((await call('/saved-programs/'+id,users[0],'POST',{})).status,404);
      assert.equal((await call('/saved-programs?limit=51')).status,400);
      assert.equal((await call('/saved-programs/status?ids='+encodeURIComponent("' OR 1=1--"))).status,400);
      assert.equal((await call('/saved-programs/not-a-uuid',users[0],'DELETE',{})).status,400);
    });
    await t.test('unpublished/deleted fixture records never disclose details or inflate available count',async()=>{
      assert.equal((await call('/saved-programs/'+ids[3],users[0],'POST',{})).status,204);
      await db.query("UPDATE balaqoldau.programs SET status='draft' WHERE id=ANY($1::uuid[])",[[ids[0],ids[3]]]);
      assert.equal((await (await call('/saved-programs')).json()).data.length,0);
      assert.equal((await (await call('/profile')).json()).data.savedCount,0);
      await db.query('DELETE FROM balaqoldau.programs WHERE id=$1',[ids[3]]); // This transaction's synthetic draft only.
      assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.user_saved_programs WHERE program_id=$1',[ids[3]])).rows[0].n,0);
      assert.equal((await call('/saved-programs/'+ids[0],users[1],'DELETE',{})).status,204);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.user_saved_programs WHERE user_id=$1',[users[0].id])).rows[0].n,1);
      for(let i=0;i<2;i++)assert.equal((await call('/saved-programs/'+ids[0],users[0],'DELETE',{})).status,204);
    });
    await t.test('fresh SQL authorization rejects expired sessions even after an earlier route lookup',async()=>{
      await db.query("UPDATE balaqoldau.user_sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[users[0].id]);
      assert.equal(await dashboardRepository(db).profile(users[0].token),undefined);
      assert.equal((await dashboardRepository(db).save(users[0].token,ids[0])).authorized,false);
      assert.equal((await call('/saved-programs')).status,401);
    });
  }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db){await db.query('ROLLBACK');db.release();}await pool.end();}
});
