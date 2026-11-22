import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import {openUserDatabase} from '../helpers/user-database.mjs';
import { createApp } from '../../dist/app.js';
import { parseEnvironment } from '../../dist/config/env.js';

test('public API against dedicated PostgreSQL; every fixture and message is rolled back', async t => {
  const {pool,config}=await openUserDatabase();
  const client = await pool.connect();
  let server;
  try {
    const identity = (await client.query('SELECT current_database() AS name')).rows[0];
    assert.equal(identity.name, decodeURIComponent(new URL(config.DATABASE_URL).pathname.slice(1)));
    await client.query('BEGIN');
    const token = 'test-api-' + randomUUID();
    const category = (await client.query("SELECT id FROM balaqoldau.categories WHERE slug='clubs'")).rows[0].id;
    const hiddenCategory = (await client.query('INSERT INTO balaqoldau.categories(slug,name) VALUES ($1,$2) RETURNING id', ['demo-' + token, 'DEMO hidden category'])).rows[0].id;
    const region = (await client.query('INSERT INTO balaqoldau.regions(slug,name) VALUES ($1,$2) RETURNING id', [token, 'TEST region'])).rows[0].id;
    const hiddenRegion = (await client.query('INSERT INTO balaqoldau.regions(slug,name) VALUES ($1,$2) RETURNING id', [token + '-hidden', 'TEST hidden region'])).rows[0].id;
    const ids = {};
    for (const [key, status, demo, min, max] of [['first', 'published', false, 0, 6], ['second', 'published', false, 6, 17], ['draft', 'draft', false, 0, 17], ['verified', 'verified', false, 0, 17], ['demo', 'draft', true, 0, 17], ['legacy-demo-category','published',false,0,17], ['legacy-demo-marker','published',false,0,17]]) {
      const visible = key === 'first' || key === 'second';
      const result = await client.query(`INSERT INTO balaqoldau.programs
        (slug,category_id,title,description,status,is_demo,source_url,source_name,verified_at,age_min,age_max,apply_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$10,$11) RETURNING id`,
      [token + '-' + key, visible || key==='legacy-demo-marker' ? category : hiddenCategory, `${demo || key==='legacy-demo-marker' ? 'DEMO' : 'TEST'} ${token} ${key}`,
        'Transient integration fixture, not an official program.', status, demo, 'https://example.com/test/source',
        'TEST source', min, max, 'https://example.com/test/apply']);
      ids[key] = result.rows[0].id;
      await client.query('INSERT INTO balaqoldau.program_regions(program_id,region_id) VALUES ($1,$2)', [ids[key], visible ? region : hiddenRegion]);
    }
    const appConfig = parseEnvironment({ NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'https://example.kz', RATE_LIMIT_MAX: '200' });
    server = createApp(appConfig, client).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = async path => {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      return response.json();
    };
    const query = (extra = {}) => '/api/programs?' + new URLSearchParams({ q: token, ...extra });

    await t.test('published-only listing, stable pagination and empty pages', async () => {
      const all = await get(query());
      assert.equal(all.pagination.total, 2);
      assert.deepEqual(new Set(all.data.map(item => item.id)), new Set([ids.first, ids.second]));
      assert.ok(all.data.every(item => item.isDemo === false && item.sourceUrl === 'https://example.com/test/source'));
      const first = await get(query({ limit: '1' }));
      const second = await get(query({ limit: '1', page: '2' }));
      assert.equal(first.pagination.totalPages, 2);
      assert.notEqual(first.data[0].id, second.data[0].id);
      const empty = await get(query({ limit: '1', page: '3' }));
      assert.deepEqual(empty.data, []);
      assert.equal(empty.pagination.total, 2);
    });
    await t.test('category/region/age/text filters intersect and boundaries are inclusive', async () => {
      assert.equal((await get(query({ category: 'clubs', region: token, age: '6' }))).data.length, 2);
      assert.deepEqual((await get(query({ age: '0' }))).data.map(item => item.id), [ids.first]);
      assert.deepEqual((await get(query({ age: '17' }))).data.map(item => item.id), [ids.second]);
      assert.equal((await get(query({ region: 'no-such-region' }))).data.length, 0);
      assert.equal((await get(query({ category: 'no-such-category' }))).data.length, 0);
      assert.equal((await get(query({ q: token.toUpperCase() + ' FIRST' }))).data.length, 1);
    });
    await t.test('details return published records only; UUID and query are validated', async () => {
      const detail = await get('/api/programs/' + ids.first);
      assert.equal(detail.data.id, ids.first);
      assert.deepEqual(detail.data.regions, [token]);
      for (const id of [ids.draft, ids.verified, ids.demo, ids['legacy-demo-category'], ids['legacy-demo-marker'], randomUUID()]) {
        const response = await fetch(base + '/api/programs/' + id);
        assert.equal(response.status, 404);
        assert.equal((await response.json()).error.code, 'NOT_FOUND');
      }
      for (const id of [ids['legacy-demo-category'], ids['legacy-demo-marker']]) {
        assert.equal((await fetch(base + '/api/program-matches/' + id)).status, 404);
        assert.equal((await fetch(base + '/api/programs/' + id + '/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'incorrect'})})).status,404);
      }
      assert.deepEqual((await get('/api/program-matches?category=demo-'+token)).data,[]);
      for (const path of ['/api/programs/invalid', '/api/programs/' + ids.first + '?status=draft', '/api/programs/%ZZ']) {
        assert.equal((await fetch(base + path)).status, 400);
      }
    });
    await t.test('taxonomy includes stable empty categories without revealing private taxonomy', async () => {
      const categories=(await get('/api/categories')).data;
      assert.deepEqual(categories.map(item=>item.slug).sort(),['benefits','clubs','free-courses','grants']);
      for(const slug of ['benefits','free-courses','grants','clubs']){
        assert.ok(categories.some(item=>item.slug===slug));
        const filtered=await get('/api/programs?category='+slug);
        const expected=(await client.query('SELECT p.id FROM balaqoldau.published_programs p JOIN balaqoldau.categories c ON c.id=p.category_id WHERE c.slug=$1 AND p.id<>$2',[slug,ids['legacy-demo-marker']])).rows;
        assert.equal(filtered.pagination.total,expected.length,'Catalog must reflect existing published data, not assume development categories are empty');
        assert.ok(filtered.data.every(item=>expected.some(row=>row.id===item.id)),'No fabricated or unpublished programs');
      }
      for (const path of ['/api/categories', '/api/regions']) {
        const result = await get(path);
        assert.equal(result.data.some(item => item.slug === token),path==='/api/regions');
        assert.ok(result.data.every(item => item.slug !== token + '-hidden'));
        assert.equal((await get(path + '?limit=1')).data.length, 1);
        assert.equal((await fetch(base + path + '?q=unsupported')).status, 400);
      }
    });
    await t.test('SQL injection and wildcard queries are literal values, never SQL', async () => {
      for (const q of ["' OR TRUE --", "'; DROP TABLE balaqoldau.programs; --", '%', '_', '\\']) {
        const response = await get(query({ q }));
        assert.equal(response.pagination.total, 0);
      }
      for (const key of ['age', 'region', 'category', 'page']) {
        assert.equal((await fetch(base + query({ [key]: "1 OR 1=1--" }))).status, 400);
      }
      assert.equal((await client.query('SELECT id FROM balaqoldau.programs WHERE id=$1', [ids.first])).rowCount, 1);
    });
    await t.test('invalid contact bodies/media/query fail; valid text is parameterized and not echoed', async () => {
      const endpoint = base + '/api/contact-messages';
      const body = { senderName: 'TEST sender', email: 'test@example.com', message: "TEST message'); DROP TABLE balaqoldau.programs; --" };
      assert.equal((await fetch(endpoint, { method: 'POST', body: 'not-json' })).status, 415);
      assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
      assert.equal((await fetch(endpoint + '?extra=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 400);
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 201);
      const result = await response.json();
      assert.deepEqual(Object.keys(result.data), ['id']);
      const stored = (await client.query('SELECT sender_name,email,message FROM balaqoldau.contact_messages WHERE id=$1', [result.data.id])).rows[0];
      assert.deepEqual(stored, { sender_name: body.senderName, email: body.email, message: body.message });
      assert.equal((await fetch(endpoint)).status, 405);
      assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 201);
      const limited = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(limited.status, 429);
      assert.ok(limited.headers.get('retry-after'));
    });
    await t.test('contact POST preflight is allowed only for configured origin', async () => {
      for (const [origin, status] of [['https://example.kz', 204], ['https://evil.kz', 403]]) {
        const response = await fetch(base + '/api/contact-messages', {
          method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
        });
        assert.equal(response.status, status);
      }
    });
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    try { await client.query('ROLLBACK'); } finally { client.release(); await pool.end(); }
  }
});
