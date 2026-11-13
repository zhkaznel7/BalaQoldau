import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {openUserDatabase} from '../helpers/user-database.mjs';
import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';
import {compareMatches} from '../../dist/matching/engine.js';

test('anonymous matching SQL, pagination and visibility with rolled-back TEST fixtures',async t=>{
  const {pool}=await openUserDatabase();const db=await pool.connect();let server;
  try{
    await db.query('BEGIN');const slug='test-match-'+randomUUID();
    const category=(await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2) RETURNING id',[slug,'TEST category'])).rows[0].id;
    const region=(await db.query('INSERT INTO balaqoldau.regions(slug,name) VALUES($1,$2) RETURNING id',[slug,'TEST region'])).rows[0].id;
    const family=(await db.query('INSERT INTO balaqoldau.family_categories(slug,name) VALUES($1,$2) RETURNING id',[slug,'TEST need'])).rows[0].id;
    const ids={};
    for(const [name,status,demo,complete,min,max,deadline]of [
      ['first','published',false,true,5,10,'2099-01-01'],['tie','published',false,true,5,10,'2099-01-01'],
      ['legacy','published',false,false,0,17,null],['age','published',false,true,12,17,'2099-01-01'],
      ['expired','published',false,true,0,17,'2000-01-01'],['draft','draft',false,true,0,17,null],['demo','draft',true,true,0,17,null],
    ]){
      const id=randomUUID();ids[name]=id;
      await db.query(`INSERT INTO balaqoldau.programs(id,slug,category_id,title,description,status,is_demo,eligibility_complete,age_min,age_max,deadline,source_url,source_name,verified_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'https://example.com/test','TEST source',now())`,[id,slug+'-'+name,category,'TEST '+name,'Isolated TEST fixture, not official',status,demo,complete,min,max,deadline]);
      await db.query('INSERT INTO balaqoldau.program_regions(program_id,region_id) VALUES($1,$2)',[id,region]);
      await db.query('INSERT INTO balaqoldau.program_family_categories(program_id,family_category_id) VALUES($1,$2)',[id,family]);
    }
    server=createApp(parseEnvironment({NODE_ENV:'test',CORS_ALLOWED_ORIGINS:'https://example.com'}),db).listen(0,'127.0.0.1');await once(server,'listening');
    const base='http://127.0.0.1:'+server.address().port+'/api';
    const query=new URLSearchParams({category:slug,region:slug,age:'6',need:slug,limit:'2'});
    const get=path=>fetch(base+path);
    await t.test('anonymous access, combined criteria, stable global order before pagination',async()=>{
      const all=[];
      for(let page=1;page<=3;page++){
        const response=await get('/program-matches?'+query+'&page='+page);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
        const result=await response.json();assert.equal(result.pagination.total,5);all.push(...result.data);
      }
      assert.deepEqual(all.map(p=>p.matching.status),['MATCH','MATCH','POSSIBLE','NOT_MATCH','NOT_MATCH']);
      assert.deepEqual(all.map(p=>p.id),[...all].reverse().sort((a,b)=>compareMatches(a,b,{age:6,region:slug,need:slug})).map(p=>p.id));
      assert.deepEqual(all.slice(0,2).map(p=>p.id),[ids.first,ids.tie].sort());
      assert.equal((await (await get('/programs?category='+slug+'&age=6&region='+slug)).json()).pagination.total,4,'legacy filters remain hard filters');
      for(const input of [{},{age:0},{age:5,region:slug,need:slug},{age:10,region:slug,need:slug},{age:17,region:'other',need:slug},{age:6,region:slug,need:'other'},{age:6,region:'other',need:'other'}]){
        const params=new URLSearchParams({category:slug,limit:'50',...Object.fromEntries(Object.entries(input).map(([k,v])=>[k,String(v)]))});
        const items=(await (await get('/program-matches?'+params)).json()).data;
        assert.deepEqual(items.map(p=>p.id),[...items].reverse().sort((a,b)=>compareMatches(a,b,input)).map(p=>p.id),'SQL and deterministic engine agree across missing/boundary/incompatible criteria');
      }
    });
    await t.test('missing information stays POSSIBLE; mismatches and sources are explicit',async()=>{
      const possible=await (await get('/program-matches/'+ids.first)).json();assert.equal(possible.data.matching.status,'POSSIBLE');
      const mismatch=await (await get('/program-matches/'+ids.first+'?age=4&region=other&need=other')).json();assert.equal(mismatch.data.matching.status,'NOT_MATCH');
      assert.deepEqual(mismatch.data.matching.checks.filter(c=>c.result==='not_satisfied').map(c=>c.code),['AGE_MISMATCH','REGION_MISMATCH','NEED_MISMATCH']);
      assert.equal(mismatch.data.sourceUrl,'https://example.com/test');
    });
    await t.test('drafts, DEMO and nonexistent records remain hidden',async()=>{
      for(const id of [ids.draft,ids.demo,randomUUID()])assert.equal((await get('/program-matches/'+id)).status,404);
      assert.equal((await (await get('/family-categories')).json()).data.some(p=>p.slug===slug),true);
    });
    await t.test('strict validation rejects injection, arrays, profile fields and unbounded queries',async()=>{
      for(const q of ['age=18','limit=51','page=0','need=x&need=y','region='+encodeURIComponent("x' OR 1=1--"),'userId='+randomUUID(),'status=draft','age=1.2']){
        const response=await get('/program-matches?'+q);assert.equal(response.status,400);assert.equal((await response.json()).error.code,'VALIDATION_ERROR');
      }
      assert.equal((await get('/program-matches/not-a-uuid')).status,400);
      assert.equal((await get('/program-matches/'+ids.first+'?q=unexpected')).status,400);
    });
    await t.test('keyword SQL injection is literal, and column completeness remains false for legacy data',async()=>{
      const result=await get('/program-matches?category='+slug+'&q='+encodeURIComponent("' OR true--"));assert.equal(result.status,200);assert.equal((await result.json()).pagination.total,0);
      const legacy=await (await get('/program-matches/'+ids.legacy+'?age=6&region='+slug+'&need='+slug)).json();assert.equal(legacy.data.matching.status,'POSSIBLE');
    });
  }finally{
    if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    await db.query('ROLLBACK');db.release();await pool.end();
  }
});
