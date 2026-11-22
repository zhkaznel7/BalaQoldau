import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../dist/app.js';
import {parseEnvironment} from '../../dist/config/env.js';
import {parseTestDatabaseEnvironment} from '../../dist/db/config.js';
import {createDatabasePool} from '../../dist/db/pool.js';
import {runMigrations} from '../../dist/db/migrate.js';

test('keyless recommendations use real PostgreSQL visibility, category, eligibility and ranking', async t => {
  const database = parseTestDatabaseEnvironment(process.env);
  const pool = createDatabasePool(database);
  t.after(() => pool.end());
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,
    decodeURIComponent(new URL(database.DATABASE_URL).pathname.slice(1)));
  await runMigrations(pool);
  const db = await pool.connect();
  let server;
  try {
    await db.query('BEGIN');
    const prefix = 'test-ai-' + randomUUID();
    const ids = {};
    for (const [name, category, region, min, max, options = {}] of [
      ['infant', 'benefits', 'astana', 0, 2],
      ['possible', 'benefits', 'astana', 0, 17, {complete: false}],
      ['older', 'benefits', 'astana', 8, 12],
      ['club', 'clubs', 'almaty-city', 5, 12, {need: 'sports-activities'}],
      ['wrong-region', 'clubs', 'astana', 5, 12],
      ['wrong-need', 'clubs', 'almaty-city', 5, 12, {need: 'creative-development'}],
      ['stale', 'benefits', 'astana', 0, 2, {verified: '2000-01-01'}],
      ['review-age-limit', 'benefits', 'astana', 0, 2, {verified: new Date(Date.now() - 8 * 86400000).toISOString()}],
      ['recheck', 'benefits', 'astana', 0, 2, {recheck: true}],
      ['expired', 'benefits', 'astana', 0, 2, {expiresOn: '2000-01-01'}],
      ['closed', 'benefits', 'astana', 0, 2, {deadline: '2000-01-01', complete: false}],
      ['draft', 'benefits', 'astana', 0, 2, {status: 'draft'}],
      ['demo', 'benefits', 'astana', 0, 2, {status: 'draft', demo: true}],
      ['verified', 'benefits', 'astana', 0, 2, {status: 'verified'}],
      ['grant', 'grants', 'astana', 9, 15],
    ]) {
      const id = randomUUID();
      ids[name] = id;
      const fixture = await db.query(`INSERT INTO balaqoldau.programs
        (id,slug,category_id,title,description,status,is_demo,eligibility_complete,age_min,age_max,
         verified_at,source_needs_recheck,expires_on,deadline,source_url,source_name)
        SELECT $1,$2,id,$3,'Rollback-only TEST fixture',$4,$5,$6,$7,$8,COALESCE($9::timestamptz,now()),$10,$11,$12,$13,'TEST source'
        FROM balaqoldau.categories WHERE slug=$14`, [id, prefix+'-'+name, 'TEST '+name,
        options.status ?? 'published', options.demo ?? false, options.complete ?? true, min, max,
        options.verified ?? null, options.recheck ?? false, options.expiresOn ?? null, options.deadline ?? null,
        'https://example.com/' + name, category]);
      assert.equal(fixture.rowCount, 1, 'catalog category exists');
      assert.equal((await db.query(`INSERT INTO balaqoldau.program_regions(program_id,region_id)
        SELECT $1,id FROM balaqoldau.regions WHERE slug=$2`, [id,region])).rowCount, 1);
      if (options.need) assert.equal((await db.query(`INSERT INTO balaqoldau.program_family_categories(program_id,family_category_id)
        SELECT $1,id FROM balaqoldau.family_categories WHERE slug=$2`, [id,options.need])).rowCount, 1);
    }
    const config = parseEnvironment({NODE_ENV:'test', CORS_ALLOWED_ORIGINS:'https://example.com', PROGRAM_REVIEW_DAYS:'7'});
    server = createApp(config, db).listen(0,'127.0.0.1');
    await once(server,'listening');
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    async function ask(query) {
      const response = await fetch(base + '/ai/recommendations', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({query,consent:true}),
      });
      assert.equal(response.status, 200);
      return response.json();
    }

    const location = await ask('Астанада 2 жастағы балаға қандай көмек бар?');
    assert.deepEqual(location.intent,{age:2,region:'astana',need:null,category:null});
    const confirmed = location.data.find(item => item.id === ids.infant);
    assert.equal(confirmed?.matching.status, 'MATCH');
    assert.equal(confirmed.title, 'TEST infant');
    assert.equal(confirmed.sourceUrl, 'https://example.com/infant');
    assert.equal((await fetch(base+'/programs/'+confirmed.id)).status,200);
    assert.equal(location.data.find(item => item.id === ids.possible)?.matching.status, 'POSSIBLE');
    assert.ok(location.data.findIndex(item => item.id === ids.infant) < location.data.findIndex(item => item.id === ids.possible));
    for (const name of ['older','stale','review-age-limit','recheck','expired','closed','draft','demo','verified','grant']) {
      assert.ok(!location.data.some(item => item.id === ids[name]), name);
    }

    for (const question of ['Бала туғанда қандай жәрдемақы беріледі?', 'Какие пособия доступны для ребенка до года?']) {
      const result = await ask(question);
      assert.deepEqual(result.intent,{age:0,region:null,need:null,category:'benefits'});
      assert.ok(result.data.some(item => item.id === ids.infant && item.matching.status === 'POSSIBLE'));
      assert.ok(result.data.every(item => item.category === 'benefits'));
      assert.ok(!result.data.some(item => item.id === ids.older));
    }

    const clubs = await ask('Алматыда тегін үйірмелер бар ма?');
    assert.equal(clubs.intent.category, 'clubs');
    assert.ok(clubs.data.some(item => item.id === ids.club));
    assert.ok(clubs.data.every(item => item.category === 'clubs' && item.regions.includes('almaty-city')));

    const sports = await ask('Нужен спортивный кружок для ребёнка 7 лет в Алматы');
    assert.equal(sports.intent.need, 'sports-activities');
    assert.ok(sports.data.some(item => item.id === ids.club && item.matching.status === 'MATCH'));
    assert.ok(!sports.data.some(item => item.id === ids['wrong-need']));

    assert.deepEqual(await ask('Алматы или Астана, 7 лет'), {
      intent:{age:null,region:null,need:null,category:null}, data:[],
    });
    const manual = await (await fetch(base + '/program-matches?region=astana&age=2&category=benefits')).json();
    assert.ok(manual.data.some(item => item.id === ids.infant && item.matching.status === 'MATCH'));
  } finally {
    if (server) await new Promise(resolve => {server.close(resolve); server.closeAllConnections();});
    await db.query('ROLLBACK');
    db.release();
  }
});
