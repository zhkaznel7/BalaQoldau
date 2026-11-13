// Real built React → Express → isolated PostgreSQL. Synthetic fixtures; rollback only.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../../backend/dist/app.js';
import { parseEnvironment } from '../../backend/dist/config/env.js';
import { parseTestDatabaseEnvironment } from '../../backend/dist/db/config.js';
import { createDatabasePool } from '../../backend/dist/db/pool.js';
import { runMigrations } from '../../backend/dist/db/migrate.js';
import { hashPassword } from '../../backend/dist/admin/password.js';
import { serveBuiltSite } from './helpers/built-site.mjs';
import { adminBrowser } from './helpers/admin-browser.mjs';
import { inspectAccessibility, contrastRatio } from './helpers/accessibility.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const config = parseTestDatabaseEnvironment(process.env);
assert.equal(new URL(config.DATABASE_URL).pathname, '/balaqoldau_test');
const pool = createDatabasePool(config);
let db, apiServer, site, browser, passed = 0;
const pass = label => { passed++; console.log(`PASS ${passed}: ${label}`); };
try {
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'balaqoldau_test');
  await runMigrations(pool);
  db = await pool.connect(); await db.query('BEGIN');
  const suffix = randomUUID(), category = 'browser-' + suffix, password = 'Synthetic browser password only!';
  await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2)', [category, 'TEST браузер санаты']);
  const hash = await hashPassword(password), users = {};
  for (const role of ['editor','reviewer','admin']) { const id = randomUUID(); users[role] = { id, email: id + '@example.com' }; await db.query('INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)', [id, users[role].email, hash, role]); }
  // Static QA site chooses a free port before constructing the exact admin Origin.
  const { createServer } = await import('node:net');
  const reservation = createServer().listen(0, '127.0.0.1'); await once(reservation, 'listening'); const frontPort = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${frontPort}`;
  apiServer = createApp(parseEnvironment({ NODE_ENV: 'test', TRUST_PROXY_LOOPBACK: 'true', CORS_ALLOWED_ORIGINS: origin, ADMIN_ORIGIN: origin, ADMIN_ENABLED: 'true', DATABASE_URL: config.DATABASE_URL }), db).listen(0, '127.0.0.1');
  await once(apiServer, 'listening'); site = await serveBuiltSite(path.join(cwd, 'dist'), frontPort, apiServer.address().port);
  browser = await adminBrowser(cwd);
  const { evaluate, until, setValue, button, send } = browser;
  const login = async role => { await setValue('#admin-email', users[role].email); await setValue('#admin-password', password); await button('Кіру'); await until(`location.pathname==='/admin/programs' && !!document.querySelector('.admin-table-wrap, .admin-empty')`); };
  const action = async label => { await button(label); await button('Растау'); await until(`!!document.querySelector('.admin-success') && !document.querySelector('.admin-confirm')`); };
  await browser.navigate(origin + '/admin/login'); await until(`!!document.querySelector('#admin-email')`);
  assert.equal(await evaluate(`!!document.querySelector('.site-header')`), false);
  await setValue('#admin-email', users.editor.email); await setValue('#admin-password', 'incorrect'); await button('Кіру');
  await until(`!!document.querySelector('.admin-login [role=alert]')`);
  assert.equal(await evaluate(`document.querySelector('#admin-password').value`), ''); pass('login uses real generic 401, clears password and separates public layout');
  await login('editor');
  const cookie = (await send('Network.getCookies', { urls: [origin + '/api/admin/session'] })).cookies.find(value => value.name === 'balaqoldau_admin');
  assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'Strict');
  assert.equal(await evaluate(`document.cookie.includes('balaqoldau_admin')`), false);
  assert.equal(await evaluate(`Object.values(localStorage).some(x=>x.includes('csrfToken')||x.includes('password'))`), false); pass('real HttpOnly session cookie and memory-only auth state');
  await evaluate(`document.querySelector('a[href="/admin/programs/new"]').click()`); await until(`!!document.querySelector('#program-title')`);
  await button('Жобаны сақтау'); await until(`document.querySelector('#program-title').getAttribute('aria-invalid')==='true'`);
  assert.equal(await evaluate(`document.activeElement.getAttribute('role')==='alert'`), true);
  pass('localized form errors focus an accessible validation summary');
  await setValue('#program-title', 'TEST <script>window.__adminXss=1</script>'); await setValue('#program-slug', 'browser-program-' + suffix);
  await setValue('#program-category', category); await setValue('#program-description', 'TEST browser fixture; not an official opportunity');
  await setValue('#program-sourceName', 'TEST дереккөз'); await setValue('#program-sourceUrl', 'https://example.com/test/source');
  await button('Жобаны сақтау'); await until(`!!document.querySelector('#admin-detail-title')`);
  const id = (await evaluate('location.pathname')).split('/').at(-1);
  assert.equal(await evaluate('window.__adminXss===undefined'), true);
  assert.equal((await db.query('SELECT status FROM balaqoldau.programs WHERE id=$1', [id])).rows[0].status, 'draft'); pass('Editor creates a real private draft with real taxonomy');
  await action('Тексеруге жіберу'); await button('Шығу'); await until(`!!document.querySelector('#admin-email')`);
  await login('reviewer'); assert.equal(await evaluate(`[...document.querySelectorAll('.admin-nav a')].some(x=>x.textContent.includes('Жаңа'))`), false);
  for (const width of [320,375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'List viewport overflow');
    const report = await evaluate(`(${inspectAccessibility.toString()})(${contrastRatio.toString()})`);
    assert.deepEqual(report.failures, []); assert.deepEqual(report.unlabelled, []);
  }
  pass('program list table, filters and navigation stay accessible at five widths');
  await setValue('#admin-search', 'browser-program-' + suffix); await setValue('#admin-status', 'review'); await button('Іздеу');
  await until(`location.search.includes('status=review') && !!document.querySelector('.admin-table-wrap')`);
  assert.equal(await evaluate(`document.querySelectorAll('tbody tr').length`), 1);
  await setValue('#admin-search', 'does-not-exist-' + suffix); await button('Іздеу'); await until(`!!document.querySelector('.admin-empty')`);
  await button('Тазалау'); await until(`!!document.querySelector('.admin-table-wrap')`);
  pass('real search/status filters and honest empty state');
  await browser.navigate(origin + '/admin/programs/' + id); await until(`!!document.querySelector('#admin-detail-title')`);
  await button('Мақұлдау'); assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Растау').disabled`), true);
  await evaluate(`document.querySelector('.admin-confirm input[type=checkbox]').click()`); await button('Растау'); await until(`!!document.querySelector('.admin-success')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(x=>x.textContent==='Жариялау')`), false); pass('Reviewer human-review confirmation and role-aware controls');
  await button('Шығу'); await until(`!!document.querySelector('#admin-email')`); await login('admin');
  await browser.navigate(origin + '/admin/programs/' + id); await until(`!!document.querySelector('#admin-detail-title')`);
  await db.query('UPDATE balaqoldau.admin_users SET role=$1 WHERE id=$2', ['reviewer', users.admin.id]);
  await button('Жариялау'); await button('Растау'); await until(`!!document.querySelector('.admin-error')`);
  assert.equal((await db.query('SELECT status FROM balaqoldau.programs WHERE id=$1', [id])).rows[0].status, 'verified'); pass('server-side 403 blocks stale Admin UI privileges');
  await db.query('UPDATE balaqoldau.admin_users SET role=$1 WHERE id=$2', ['admin', users.admin.id]);
  await button('Сервердегі күйді жаңарту'); await until(`!document.querySelector('.admin-error')`);
  await action('Жариялау'); assert.equal((await fetch(origin + '/api/programs/' + id)).status, 200);
  await action('Жариялаудан алу'); assert.equal((await fetch(origin + '/api/programs/' + id)).status, 404); pass('Admin publish/unpublish preserves actual public visibility');
  await evaluate(`document.querySelector('a[href$="/edit"]').click()`); await until(`!!document.querySelector('#program-title')`);
  await db.query('UPDATE balaqoldau.programs SET title=$1,version=version+1 WHERE id=$2', ['TEST external revision', id]);
  await setValue('#program-title', 'TEST stale revision'); await button('Жобаны сақтау'); await until(`!!document.querySelector('.admin-error')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Жобаны сақтау').disabled`), true);
  await button('Сервердегі нұсқаны жүктеу (енгізілген өзгерістер жойылады)'); await until(`document.querySelector('#program-title')?.value==='TEST external revision'`); pass('409 retains the draft and requires explicit reload, never blind retry');
  for (const width of [320,375,768,1024,1440]) { await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    const report = await evaluate(`(${inspectAccessibility.toString()})(${contrastRatio.toString()})`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'No overflow at ' + width);
    assert.deepEqual(report.unlabelled, []); assert.deepEqual(report.failures, []); assert.equal(report.h1Count, 1); assert.equal(report.mainCount, 1); }
  await evaluate(`document.querySelector('.admin-skip').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
  await until(`document.activeElement.id==='admin-main'`);
  await evaluate(`document.querySelector('#program-title').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  assert.equal(await evaluate(`document.activeElement.id==='program-slug' && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3`), true);
  pass('keyboard skip link, form tab order and visible focus');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(browser.profile, 'admin-form.png'), Buffer.from(shot.data,'base64'));
  console.log('Screenshot:', path.join(browser.profile, 'admin-form.png')); pass('responsive form and accessible labels at five viewport widths');
  const originalQuery = db.query.bind(db);
  let failRead = true;
  db.query = async (...args) => { if (failRead && typeof args[0] === 'string' && args[0].startsWith('SELECT count(*)::int AS total FROM balaqoldau.programs p')) { failRead = false; throw new Error('synthetic-private-read-error'); } return originalQuery(...args); };
  try {
    await evaluate(`document.querySelector('.admin-nav a[href="/admin/programs"]').click()`);
    await until(`!!document.querySelector('.admin-error')`);
    assert.equal(await evaluate(`document.body.textContent.includes('synthetic-private-read-error')`), false);
    await button('Қайталап жүктеу'); await until(`!!document.querySelector('.admin-table-wrap')`);
  } finally { db.query = originalQuery; }
  pass('safe real API read error has an explicit working retry');
  await db.query("UPDATE balaqoldau.admin_sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE admin_id=$1", [users.admin.id]);
  await evaluate(`window.dispatchEvent(new Event('focus'))`); await until(`!!document.querySelector('#admin-email')`);
  assert.equal(await evaluate(`!!document.querySelector('.admin-table-wrap')`), false); pass('expired sessions clear private UI and require login');
  assert.deepEqual(browser.errors, []);
  console.log(`Admin browser: ${passed}/${passed} PASS; real isolated Express/PostgreSQL, rollback only`);
} finally {
  await browser?.close();
  if (site) { site.closeAllConnections(); await new Promise(resolve => site.close(resolve)); }
  if (apiServer) { apiServer.closeAllConnections(); await new Promise(resolve => apiServer.close(resolve)); }
  if (db) { await db.query('ROLLBACK'); db.release(); }
  await pool.end();
}
