import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../dist/app.js';
import { parseEnvironment } from '../../dist/config/env.js';
import {openUserDatabase} from '../helpers/user-database.mjs';
import { runMigrations } from '../../dist/db/migrate.js';
import { hashPassword } from '../../dist/admin/password.js';
import { randomToken, tokenHash } from '../../dist/admin/repository.js';

test('admin program CRUD/workflow against isolated PostgreSQL; all fixture changes roll back', async t => {
  const {pool,config:cfg}=await openUserDatabase();
  let db, server;
  try {
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, process.env.GITHUB_ACTIONS==='true'?'balaqoldau_test':'balaqoldau_dev');
    await runMigrations(pool);
    db = await pool.connect(); await db.query('BEGIN');
    const suffix = randomUUID(), category = 'test-cat-' + suffix, region = 'test-region-' + suffix, family = 'test-family-' + suffix;
    await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2)', [category, 'TEST category']);
    await db.query('INSERT INTO balaqoldau.regions(slug,name) VALUES($1,$2)', [region, 'TEST region']);
    await db.query('INSERT INTO balaqoldau.family_categories(slug,name) VALUES($1,$2)', [family, 'TEST family']);
    const hash = await hashPassword('Synthetic program fixture password!');
    const users = {};
    for (const name of ['editor', 'other', 'reviewer', 'admin']) {
      const id = randomUUID(), token = randomToken(), csrf = randomToken();
      await db.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)', [id, id + '@example.com', hash, name === 'other' ? 'editor' : name]);
      await db.query("INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')", [tokenHash(token), csrf, id]);
      users[name] = { id, token, csrf };
    }
    const origin = 'https://admin.example.kz';
    const appConfig=parseEnvironment({ CORS_ALLOWED_ORIGINS: origin, ADMIN_ORIGIN: origin, ADMIN_ENABLED: 'true', DATABASE_URL: cfg.DATABASE_URL });
    server = createApp(appConfig, db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    let base = `http://127.0.0.1:${server.address().port}/api`;
    const call = (path, user, method = 'GET', body, headers = {}) => fetch(base + '/admin/programs' + path, { method,
      headers: { Origin: origin, ...(user ? { Cookie: 'balaqoldau_admin=' + user.token, 'X-CSRF-Token': user.csrf } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const input = { slug: 'test-program-' + suffix, category, title: 'TEST program; fixture only', description: 'TEST not an official opportunity',
      sourceUrl: 'https://example.com/test/source', sourceName: 'TEST source only', ageMax: 10, regions: [region], familyCategories: [family] };
    let program, demo;
    await t.test('20 real regions, neutral needs, nationwide and multiple selections use existing IDs',async()=>{
      const regions=['abay','akmola','aktobe','almaty-region','atyrau','west-kazakhstan','zhambyl','zhetisu','karaganda','kostanay','kyzylorda','mangystau','pavlodar','north-kazakhstan','turkistan','ulytau','east-kazakhstan','astana','almaty-city','shymkent'];
      const reference=await call('/taxonomy',users.editor);assert.equal(reference.status,200);
      const refs=(await reference.json()).data;
      assert.equal(refs.regions.filter(r=>regions.includes(r.slug)).length,20);
      for(const need of ['education-support','creative-development','sports-activities'])assert.ok(refs.familyCategories.some(f=>f.slug===need));
      const before=(await db.query('SELECT id,slug,name FROM balaqoldau.regions WHERE slug=ANY($1) ORDER BY id',[regions])).rows;
      assert.equal(await runMigrations(pool),0);
      assert.deepEqual((await db.query('SELECT id,slug,name FROM balaqoldau.regions WHERE slug=ANY($1) ORDER BY id',[regions])).rows,before);
      const made=await call('',users.editor,'POST',{...input,slug:'reference-'+suffix,category:'benefits',regions,familyCategories:['education-support']});
      assert.equal(made.status,201);let real=(await made.json()).data;assert.equal(real.regions.length,20);
      assert.equal(real.eligibilityComplete,false,'Tags cannot imply verified eligibility');
      const edited=await call('/'+real.id,users.editor,'PATCH',{version:real.version,regions:['astana','almaty-city'],familyCategories:[]});
      assert.equal(edited.status,200);real=(await edited.json()).data;assert.deepEqual(real.regions,['almaty-city','astana']);
      assert.equal((await call('/'+real.id,users.editor,'PATCH',{version:real.version,regions:['astana','astana']})).status,400);
      const demoSlug='demo-reference-'+suffix;
      await db.query('INSERT INTO balaqoldau.regions(slug,name) VALUES($1,$2)',[demoSlug,'DEMO fixture']);
      assert.equal((await call('/'+real.id,users.editor,'PATCH',{version:real.version,regions:[demoSlug]})).status,400,'DEMO must not become real program geography');
      for(const kind of ['categories','family_categories'])await db.query('INSERT INTO balaqoldau.'+kind+'(slug,name) VALUES($1,$2)',[demoSlug,'DEMO fixture']);
      for(const extra of [{category:demoSlug},{familyCategories:[demoSlug]}])assert.equal((await call('/'+real.id,users.editor,'PATCH',{version:real.version,...extra})).status,400);
      // Simulate a legacy bad association on this rollback-only fixture, not real data.
      await db.query('UPDATE balaqoldau.program_regions SET region_id=(SELECT id FROM balaqoldau.regions WHERE slug=$2) WHERE program_id=$1 AND region_id=(SELECT id FROM balaqoldau.regions WHERE slug=$3)',[real.id,demoSlug,'astana']);
      await db.query("UPDATE balaqoldau.programs SET status='review',submitted_by=$2 WHERE id=$1",[real.id,users.editor.id]);
      assert.equal((await call('/'+real.id+'/approve',users.reviewer,'POST',{version:real.version,sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true})).status,400);
      assert.equal((await db.query('SELECT status FROM balaqoldau.programs WHERE id=$1',[real.id])).rows[0].status,'review');
    });
    // New reference-data probes have an independent real rate-limit budget.
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    server=createApp(appConfig,db).listen(0,'127.0.0.1');await once(server,'listening');
    base=`http://127.0.0.1:${server.address().port}/api`;
    const mutate = async (action, user) => {
      const response = await call('/' + program.id + '/' + action, user, 'POST', { version: program.version,...(['publish','archive'].includes(action)?{confirm:true}:{}),...(action==='approve'?{sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true}:action==='reject'?{notes:'TEST rejection reason'}:{}) });
      assert.equal(response.status, 200);
      program = (await response.json()).data;
    };
    await t.test('authentication/CSRF/strict fields and reviewer creation denial', async () => {
      assert.equal((await call('')).status, 401);
      assert.equal((await call('', undefined, 'POST', input)).status, 401);
      assert.equal((await call('', users.editor, 'POST', input, { 'X-CSRF-Token': 'wrong' })).status, 403);
      assert.equal((await call('', users.reviewer, 'POST', input)).status, 403);
      assert.equal((await call('', users.editor, 'POST', { ...input, status: 'published' })).status, 400);
    });
    await t.test('create draft with taxonomy links, safe literal SQL text and admin pagination', async () => {
      const response = await call('', users.editor, 'POST', input);
      assert.equal(response.status, 201); program = (await response.json()).data;
      assert.equal(program.status, 'draft'); assert.equal(program.createdBy, users.editor.id);
      assert.equal(program.verifiedAt, null); assert.equal(program.version, 1);
      assert.deepEqual(program.regions, [region]); assert.deepEqual(program.familyCategories, [family]);
      const listed = await call('?status=draft&page=1&limit=1', users.reviewer);
      assert.equal(listed.status, 200); assert.equal((await listed.json()).data.length, 1);
      assert.equal((await call('?limit=51', users.admin)).status, 400);
      assert.equal((await call('/' + randomUUID(), users.editor)).status, 404);
      const taxonomy = await call('/taxonomy', users.editor);
      assert.equal(taxonomy.status, 200);
      assert.ok((await taxonomy.json()).data.categories.some(item => item.slug === category));
      const found = await call('?q=' + encodeURIComponent(input.slug), users.editor);
      assert.equal((await found.json()).pagination.total, 1);
      const wildcard = await call('?q=' + encodeURIComponent("%_' OR 1=1--"), users.editor);
      assert.equal((await wildcard.json()).pagination.total, 0);
    });
    await t.test('ownership, field validation, stale revisions and injection safety', async () => {
      const path = '/' + program.id;
      assert.equal((await call(path, users.other, 'PATCH', { version: program.version, title: 'TEST other' })).status, 403);
      assert.equal((await call(path, users.reviewer, 'PATCH', { version: program.version, title: 'TEST reviewer' })).status, 403);
      assert.equal((await call(path, users.editor, 'PATCH', { version: program.version, ageMin: 12 })).status, 400);
      assert.equal((await call(path, users.editor, 'PATCH', { version: program.version, isDemo: true })).status, 400);
      assert.equal((await call('', users.editor, 'POST', { ...input, slug: 'bad-' + suffix, category: 'missing-taxonomy' })).status, 400);
      assert.equal((await call('', users.editor, 'POST', input)).status, 409);
      const title = "TEST literal x'); SELECT 1; --";
      const response = await call(path, users.editor, 'PATCH', { version: program.version, title, regions: [] });
      assert.equal(response.status, 200); program = (await response.json()).data;
      assert.equal(program.title, title); assert.deepEqual(program.regions, []);
      assert.equal((await call(path, users.editor, 'PATCH', { version: 1, title: 'stale' })).status, 409);
    });
    await t.test('review rejection, re-submission and separate reviewer approval', async () => {
      program=(await (await call('/'+program.id,users.editor,'PATCH',{version:program.version,regions:[region]})).json()).data;
      assert.equal((await call('/' + program.id + '/publish', users.editor, 'POST', { version:program.version,confirm:true})).status, 403);
      assert.equal((await call('/' + program.id + '/publish', users.admin, 'POST', { version:program.version,confirm:true})).status, 409);
      await mutate('submit', users.editor); assert.equal(program.status, 'review'); assert.equal(program.verifiedAt, null);
      assert.equal((await call('/' + program.id, users.editor, 'PATCH', { version: program.version, title: 'under review' })).status, 409);
      assert.equal((await call('/' + program.id + '/approve', users.editor, 'POST', { version: program.version })).status, 403);
      await mutate('reject', users.reviewer); assert.equal(program.status, 'rejected');await mutate('reopen',users.editor);
      await mutate('submit', users.editor); await mutate('approve', users.reviewer);
      assert.equal(program.status, 'verified'); assert.equal(program.reviewedBy, users.reviewer.id); assert.ok(program.verifiedAt);
      assert.equal((await call('/' + program.id + '/approve', users.reviewer, 'POST', { version: program.version,sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true })).status, 409);
      assert.equal((await fetch(base + '/programs/' + program.id)).status, 404);
      // Admin can withdraw approval for correction without first publishing the record.
      assert.equal((await call('/' + program.id + '/reject', users.reviewer, 'POST', { version: program.version,notes:'TEST reason' })).status, 409);
      await mutate('reject', users.admin); assert.equal(program.status, 'rejected');await mutate('reopen',users.editor);
      await mutate('submit', users.editor); await mutate('approve', users.reviewer);
    });
    await t.test('only Admin publishes; public visibility, no published edits/deletes and safe unpublish', async () => {
      assert.equal((await call('/' + program.id + '/publish', users.reviewer, 'POST', { version:program.version,confirm:true})).status, 403);
      await mutate('publish', users.admin); assert.equal(program.status, 'published');
      assert.equal((await fetch(base + '/programs/' + program.id)).status, 200);
      assert.equal((await call('/' + program.id, users.admin, 'PATCH', { version: program.version, title: 'published edit' })).status, 409);
      assert.equal((await call('/' + program.id + '/unpublish', users.editor, 'POST', { version: program.version })).status, 403);
      assert.equal((await call('/' + program.id, users.admin, 'DELETE')).status, 405);
      assert.equal((await call('/' + program.id + '/unpublish', users.admin)).status, 405);
      await db.query('SAVEPOINT published_delete');
      await assert.rejects(db.query('DELETE FROM balaqoldau.programs WHERE id=$1', [program.id]), /Published programs cannot be deleted/);
      await db.query('ROLLBACK TO SAVEPOINT published_delete');
      await mutate('unpublish', users.admin); assert.equal(program.status, 'draft'); assert.equal(program.verifiedAt, null);
      assert.equal((await fetch(base + '/programs/' + program.id)).status, 404);
      const edited = await call('/' + program.id, users.admin, 'PATCH', { version: program.version, sourceName: 'TEST revised source' });
      assert.equal(edited.status, 200); program = (await edited.json()).data;
      assert.equal(program.createdBy, users.editor.id);
    });
    await t.test('optimistic revisions prevent lost updates', async () => {
      const results = await Promise.all(['TEST concurrent A', 'TEST concurrent B'].map(title => call('/' + program.id, users.editor, 'PATCH', { version: program.version, title })));
      assert.deepEqual(results.map(row => row.status).sort(), [200, 409]);
      program = (await (await call('/' + program.id, users.editor)).json()).data;
    });
    await t.test('DEMO cannot enter review and Admin cannot approve its own submission', async () => {
      const created = await call('', users.admin, 'POST', { ...input, slug: 'demo-' + suffix, isDemo: true });
      demo = (await created.json()).data;
      assert.equal((await call('/' + demo.id + '/submit', users.admin, 'POST', { version: demo.version })).status, 409);
      assert.equal((await fetch(base + '/programs/' + demo.id)).status, 404);
      const real = await call('', users.admin, 'POST', { ...input, slug: 'own-' + suffix, description: 'TEST ' + 'Ә'.repeat(3000) });
      assert.equal(real.status, 201); let own = (await real.json()).data;
      const submitted = await call('/' + own.id + '/submit', users.admin, 'POST', { version: own.version });
      assert.equal(submitted.status, 200); own = (await submitted.json()).data;
      assert.equal((await call('/' + own.id + '/approve', users.admin, 'POST', { version: own.version,sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true })).status, 403);
    });
    await t.test('audit failure rolls back content, revision and relation changes', async () => {
      const before = await db.query('SELECT title,version FROM balaqoldau.programs WHERE id=$1', [program.id]);
      const beforeRegions=(await db.query('SELECT count(*)::int AS count FROM balaqoldau.program_regions WHERE program_id=$1',[program.id])).rows[0].count;
      await db.query('SAVEPOINT reject_program_audit');
      await db.query(`CREATE FUNCTION pg_temp.reject_program_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic-audit-failure'; END; $$`);
      await db.query('CREATE TRIGGER reject_program_audit BEFORE INSERT ON balaqoldau.admin_audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_program_audit()');
      const response = await call('/' + program.id, users.editor, 'PATCH', { version: program.version, title: 'must rollback', regions: [] });
      assert.equal(response.status, 503); assert.equal((await response.text()).includes('synthetic-audit-failure'), false);
      assert.deepEqual((await db.query('SELECT title,version FROM balaqoldau.programs WHERE id=$1', [program.id])).rows, before.rows);
      assert.equal((await db.query('SELECT count(*)::int AS count FROM balaqoldau.program_regions WHERE program_id=$1', [program.id])).rows[0].count, beforeRegions);
      const failedSlug = 'failed-create-' + suffix;
      assert.equal((await call('', users.editor, 'POST', { ...input, slug: failedSlug })).status, 503);
      assert.equal((await db.query('SELECT count(*)::int AS count FROM balaqoldau.programs WHERE slug=$1', [failedSlug])).rows[0].count, 0);
      await db.query('ROLLBACK TO SAVEPOINT reject_program_audit');
      const audit = (await db.query('SELECT event,previous_status,new_status FROM balaqoldau.admin_audit_log WHERE target_id=$1', [program.id])).rows;
      assert.ok(audit.some(row => row.event === 'program.published' && row.previous_status === 'verified' && row.new_status === 'published'));
      assert.ok(audit.some(row => row.event === 'program.unpublished'));
    });
    await t.test('session revocation after middleware is rechecked inside the mutation transaction', async () => {
      const before = (await db.query('SELECT title,version FROM balaqoldau.programs WHERE id=$1', [program.id])).rows;
      const original = db.query.bind(db);
      let revoke = true;
      db.query = async (...args) => {
        const result = await original(...args);
        if (revoke && typeof args[0] === 'string' && args[0].startsWith('SELECT s.admin_id')) {
          revoke = false;
          await original('DELETE FROM balaqoldau.admin_sessions WHERE token_hash=$1', [tokenHash(users.editor.token)]);
        }
        return result;
      };
      try {
        assert.equal((await call('/' + program.id, users.editor, 'PATCH', { version: program.version, title: 'revoked change' })).status, 401);
      } finally { db.query = original; }
      assert.deepEqual((await db.query('SELECT title,version FROM balaqoldau.programs WHERE id=$1', [program.id])).rows, before);
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (db) { await db.query('ROLLBACK'); db.release(); }
    await pool.end();
  }
});
