// Isolated Chrome + real Vite/Express smoke, followed by browser-only TEST API fixtures.
// No packages, user browser profile, database writes, or DEMO publication required.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, inspectAccessibility } from './helpers/accessibility.mjs';
import { serveBuiltSite } from './helpers/built-site.mjs';
import {tr} from '../src/i18n/ui.ts';
import {randomUUID} from 'node:crypto';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const backend = fileURLToPath(new URL('../../backend/', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening'); const port = server.address().port;
  await new Promise(resolve => server.close(resolve)); return port;
}
async function ready(url) {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) return; } catch { /* Wait for owned server. */ } await delay(100); }
  throw new Error('Owned test server did not become ready');
}

const frontPort = await freePort(), apiPort = await freePort();
const origin = `http://127.0.0.1:${frontPort}`;
const apiProcess = spawn(process.execPath, ['--env-file=.env', '--input-type=module', '-e',
  "process.on('message',v=>{if(v==='shutdown'){process.emit('SIGTERM');process.disconnect();}});await import('./dist/server.js');"], {
  cwd: backend, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(apiPort), DB_SSL_MODE: 'disable',
    // This suite tests public GET smoke; authentication requests are browser fixtures.
    // Do not inherit enabled local auth / privileged-role startup requirements.
    ADMIN_ENABLED: 'false', USER_AUTH_ENABLED: 'false',
    DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/balaqoldau_dev', CORS_ALLOWED_ORIGINS: origin },
});
const builtMode = process.env.BROWSER_BUILD === 'true';
const builtSite = builtMode ? await serveBuiltSite(path.join(cwd, 'dist'), frontPort, apiPort) : undefined;
const vite = builtMode ? undefined : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontPort), '--strictPort'], {
  cwd, windowsHide: true, stdio: 'ignore', env: { ...process.env, API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`, VITE_API_BASE_URL: '/api' },
});
let chrome, socket, keepAlive;
const pending = new Map();
let sequence = 0, session;
const requests = [], runtimeErrors = [];
let fixtureMode = false, flaky = 0, contactMode = 'success', catalogFailure = false;
let manyCategories = false,fixtureAuthenticated=false;
let passed = 0;
const check = name => { passed++; console.log(`PASS ${passed}: ${name}`); };
const id1 = '11111111-1111-4111-8111-111111111111', id2 = '22222222-2222-4222-8222-222222222222';
const privateId = '33333333-3333-4333-8333-333333333333';
const program = (id, title) => ({ id, slug: 'test-' + id, category: 'clubs', title, description: 'TEST fixture only', sourceUrl: 'https://example.com/test', sourceName: 'TEST дереккөз', verifiedAt: '2026-11-11T00:00:00Z', ageMin: 0, ageMax: 17, deadline: null, applyUrl: 'https://example.com/test/apply', isDemo: false, regions: ['test-region'], familyCategories: [] });
const programs = [program(id1, 'TEST Бірінші мүмкіндік'), program(id2, 'TEST Екінші мүмкіндік')];
const page = (data, number = 1, total = data.length, limit = 20) => ({ data, pagination: { page: number, limit, total, totalPages: Math.ceil(total / limit) } });
function send(method, params = {}, targetSession = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
  });
}
async function intercept(message) {
  const { requestId, request } = message.params;
  const url = new URL(request.url);
  if (!fixtureMode&&!url.pathname.startsWith('/api/auth/')) return send('Fetch.continueRequest', { requestId }, message.sessionId);
  requests.push({ path: url.pathname, search: url.search, method: request.method, body: request.postData });
  let status = 200, body;
  if (url.pathname==='/api/auth/session') body={data:{authenticated:fixtureAuthenticated,user:fixtureAuthenticated?{id:id1,email:'test@example.com',language:'kk'}:null,csrfToken:'a'.repeat(64),resetAvailable:false}};
  else if(url.pathname==='/api/family-categories')body=page([{id:'1',slug:'test-need',name:'TEST need'}]);
  else if(url.pathname==='/api/auth/profile')body={data:{id:id1,email:'test@example.com',language:'kk',fullName:null,location:null,savedCount:0}};
  else if (url.pathname.endsWith('/categories')) {
    if (catalogFailure) { status = 503; body = {}; }
    else body = page([{ id: '1', slug: 'clubs', name: 'TEST қолдау' }, ...(manyCategories ? Array.from({ length: 5 }, (_, i) => ({ id: String(i + 2), slug: 'test-extra-' + i, name: 'TEST отбасына қолдау туралы ұзақ санат атауы ' + (i + 2) })) : [])]);
  } else if (url.pathname.endsWith('/regions')) body = page([{ id: '1', slug: 'test-region', name: 'TEST өңір' }]);
  else if (url.pathname.endsWith('/contact-messages')) {
    await delay(250);
    status = contactMode === 'error' ? 503 : contactMode === 'limit' ? 429 : 201;
    body = status === 201 ? { data: { id: id1 } } : {};
  } else if ((url.pathname.endsWith('/programs')||url.pathname.endsWith('/program-matches'))) {
    const q = url.searchParams.get('q') || '';
    if (q === 'fail' || (q === 'flaky' && flaky === 0)) { status = 503; body = {}; }
    else {
      if (q === 'slow') await delay(700);
      const limit = Number(url.searchParams.get('limit') || 20), number = Number(url.searchParams.get('page') || 1);
      const data = q === 'empty' ? [] : q === 'slow' ? [program(id1, 'TEST Ескірген нәтиже')] : programs;
      body = page(data.slice((number - 1) * limit, number * limit), number, data.length, limit);
    }
  } else {
    const id = url.pathname.split('/').at(-1);
    if (id === privateId) body = { data: { ...program(privateId, 'DEMO hidden record'), isDemo: true, status: 'draft' } };
    else if (programs.some(item => item.id === id)) body = { data: programs.find(item => item.id === id) };
    else { status = 404; body = {}; }
  }
  return send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
    body: Buffer.from(JSON.stringify(body)).toString('base64') }, message.sessionId);
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed: ' + result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(50); }
  throw new Error('Browser condition timed out: ' + expression);
}
async function navigate(route) { await send('Page.navigate', { url: origin + route }); await until(`location.href===${JSON.stringify(origin + route)} && document.readyState === "complete" && !!document.querySelector("main")`); }
async function keypress(key, code, windowsVirtualKeyCode) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
}
async function setValue(selector, value) {
  await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
try {
  await ready(`http://127.0.0.1:${apiPort}/api/health`); await ready(origin);
  if (builtMode) {
    assert.equal((await fetch(origin + '/.env')).status, 404);
    assert.equal((await fetch(origin + '/assets/missing.js')).status, 404);
    assert.equal((await fetch(origin + '/src/main.tsx')).status, 404);
    assert.equal((await fetch(origin + '/api/health')).status, 200);
    check('built dist serves SPA routes and API without Vite; source/env files are unavailable');
  }
  const emptyQuery='qa-no-results-'+randomUUID();
  const real = await fetch(origin + '/api/programs?q='+emptyQuery);
  assert.equal(real.status, 200); assert.deepEqual((await real.json()).data, []);
  const profile = path.join(cwd, 'node_modules/.cache/stage5-chrome-' + Date.now());
  await mkdir(profile, { recursive: true });
  chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let address;
  for (let i = 0; i < 100; i++) {
    try { const lines = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); address = `ws://127.0.0.1:${lines[0]}${lines[1]}`; break; } catch { await delay(100); }
  }
  assert.ok(address, 'Owned Chrome debugging endpoint is ready');
  keepAlive = setInterval(() => {}, 1000);
  socket = new WebSocket(address);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('Chrome connection failed')), { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const item = pending.get(message.id); if (!item) return;
      pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    } else if (message.method === 'Fetch.requestPaused') {
      void intercept(message).catch(error => { if (!/Invalid InterceptionId|Invalid interception|not found|aborted/i.test(error.message)) runtimeErrors.push(error.message); });
    } else if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
  });
  socket.addEventListener('close', () => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Owned browser connection closed')); }
    pending.clear();
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__qaPerformance = { lcpMs: null, cls: 0, longTasks: 0 };
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__qaPerformance.lcpMs = e.startTime; }).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__qaPerformance.cls += e.value; }).observe({type:'layout-shift',buffered:true});
    new PerformanceObserver(list => { window.__qaPerformance.longTasks += list.getEntries().length; }).observe({type:'longtask',buffered:true});
  ` });
  await send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/*', requestStage: 'Request' }] });
  await navigate('/results?q='+emptyQuery);
  await until('!!document.querySelector(".empty-results")');
  assert.match(await evaluate('document.querySelector(".empty-results").textContent'), /Қазір бұл санатта бағдарламалар жоқ/);
  assert.equal(await evaluate('document.querySelectorAll(".request-error").length'), 0);
  assert.equal(await evaluate('document.querySelectorAll(".program-card").length'), 0);
  check(`real React → ${builtMode ? 'built-site QA proxy' : 'Vite proxy'} → Express/PostgreSQL; honest published-only empty state`);

  await navigate('/');
  await until('!!document.querySelector(".hero-finder [name=q]")');
  await until('document.querySelector(".hero-family-illustration")?.complete');
  assert.equal(await evaluate('document.querySelector(".hero-family-illustration").naturalWidth>0'), true);
  for(const language of ['kk','ru']){
    await navigate('/?lang='+language);await until('!!document.querySelector("#about-heading")');
    assert.equal(await evaluate('document.querySelector("#about-heading").textContent'),tr('m508',{},language));
    assert.equal(await evaluate('document.querySelectorAll(".about-grid article").length'),4);
    assert.equal(await evaluate('document.querySelectorAll(".service-directions>a").length'),4);
    assert.equal(await evaluate('document.querySelectorAll(".portal-help").length'),0);
    assert.equal(await evaluate('document.querySelectorAll(".platform-notice,.about-disclaimer").length'),0);
    assert.equal(await evaluate('document.querySelector(".header").getBoundingClientRect().top'),0);
    assert.equal(await evaluate('document.querySelectorAll("#primary-navigation a").length'),5);
    assert.equal(await evaluate('document.querySelector("#primary-navigation a[href^=\'/ai-assistant\']").textContent'),tr('aiTitle',{},language));
    assert.equal(await evaluate('document.querySelectorAll("#primary-navigation a[href*=\'#how\']").length'),0);
    assert.equal(await evaluate('document.querySelectorAll("#how ol li").length'),3);
    assert.equal(await evaluate(`document.querySelectorAll('.portal-about a[href="/contact"]').length`),1);
    assert.equal(await evaluate('document.querySelector("#footer-contact-heading").textContent'),tr('m526',{},language));
    assert.equal(await evaluate('document.querySelectorAll("footer a[href=\'/find\'],footer a[href=\'/favorites\']").length'),0);
    assert.equal(await evaluate('document.querySelectorAll(".footer-contacts svg[aria-hidden=true]").length'),2);
    assert.equal(await evaluate('document.querySelectorAll(".footer-placeholder").length'),2);
    assert.equal(await evaluate('document.querySelectorAll("footer a[href^=\'tel:\'],footer a[href^=\'mailto:\']").length'),0);
    assert.equal(await evaluate('document.querySelector(".footer-brand p").textContent'),tr('m525',{},language));
    for(const width of [320,375,768,1024,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
      if(width>=768){assert.equal(await evaluate("(()=>{const cards=[...document.querySelectorAll('.service-directions>a')].map(el=>el.getBoundingClientRect());return Math.abs(cards[0].top-cards[1].top)<2&&cards[1].left>cards[0].right&&cards[2].top>cards[0].top;})()"),true);}
      if(width===1280){assert.equal(await evaluate("document.querySelector('.service-directions').getBoundingClientRect().width>window.innerWidth*.8&&document.querySelector('.about-grid').getBoundingClientRect().width>window.innerWidth*.8"),true);}
      if(width>=1024){assert.equal(await evaluate("(()=>{const c=[...document.querySelector('.footer-top').children].map(el=>el.getBoundingClientRect());return c.length===3&&Math.abs(c[0].top-c[2].top)<2&&c[0].right<c[1].left&&c[1].right<c[2].left;})()"),true);}
      if(width<=375){assert.equal(await evaluate("(()=>{const c=[...document.querySelector('.footer-top').children].map(el=>el.getBoundingClientRect());return c[1].top>c[0].bottom&&c[2].top>c[1].bottom;})()"),true);}
    }
  }
  await navigate('/');await until('!!document.querySelector(".hero-finder [name=q]")');
  check('KZ/RU about content, existing category navigation and five responsive widths');
  assert.equal(await evaluate('document.querySelectorAll(".request-error").length'), 0);
  await delay(500);
  const performanceSample = await evaluate(`({ mode: ${JSON.stringify(builtMode ? 'built-dist' : 'vite-development')}, ...window.__qaPerformance,
    fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    ttfbMs: performance.getEntriesByType('navigation')[0]?.responseStart ?? null })`);
  await writeFile(path.join(cwd, `node_modules/.cache/stage7-performance-${builtMode ? 'built' : 'development'}.json`), JSON.stringify(performanceSample, null, 2));
  console.log('Local unthrottled home performance (not field CWV): ' + JSON.stringify(performanceSample));
  fixtureMode = true;
  await navigate('/');
  assert.equal(await evaluate('document.querySelectorAll(".hero #how ol li").length'), 3);
  assert.equal(await evaluate('document.querySelectorAll(".hero .eyebrow,.category-icon").length'), 0);
  assert.equal(await evaluate('document.querySelectorAll(".service-directions svg[aria-hidden=true]").length'), 8);
  for (const width of [1440, 375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 760 });
    assert.equal(await evaluate(`(() => { const search=document.querySelector('.discovery-panel').getBoundingClientRect(), guide=document.querySelector('#how').getBoundingClientRect(); return innerWidth>960 ? guide.left>=search.right : guide.top>=search.bottom; })()`), true);
  }
  check('compact portal puts an ordered three-step guide beside search on desktop and below on mobile');
  await navigate('/#how');
  await until('document.activeElement.id==="how"');
  await navigate('/');
      assert.equal(await evaluate('document.querySelectorAll(".platform-notice,.about-disclaimer").length'),0);
  assert.equal(await evaluate('document.querySelectorAll(".service-directions a").length'), 4);
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".service-directions a")].map(link=>new URL(link.href).searchParams.get("category"))'), ['benefits', 'free-courses', 'clubs', 'grants']);
  assert.equal(await evaluate('[...document.querySelectorAll(".service-directions a")].every(link=>!new URL(link.href).searchParams.has("q"))'),true);
  await until('document.querySelectorAll(".hero-finder select[name=region] option").length===2');
  await setValue('.hero-finder [name=q]', 'үйірме');
  await setValue('.hero-finder [name=age]', '0');
  await setValue('.hero-finder [name=region]', 'test-region');
  await setValue('.hero-finder [name=category]', 'clubs');
  await evaluate('document.querySelector(".hero-finder").requestSubmit()');
  await until('location.pathname==="/results" && !!document.querySelector(".program-card")');
  assert.equal(await evaluate('new URLSearchParams(location.search).get("q")'), 'үйірме');
  assert.deepEqual(await evaluate('Object.fromEntries(new URLSearchParams(location.search))'), { region: 'test-region', age: '0', category: 'clubs', q: 'үйірме' });
  check('public layout has no announcement/disclaimer blocks and keyword search preserves the API contract');
  await navigate('/');
  await evaluate('document.querySelector(".service-directions a").click()');
  await until('location.pathname==="/results" && !!document.querySelector(".program-card")');
  assert.equal(await evaluate('new URLSearchParams(location.search).get("q")'), null);
  assert.equal(await evaluate('new URLSearchParams(location.search).get("category")'), 'benefits');
  check('service direction navigation uses backend taxonomy slugs without injecting search keywords');
  if (process.env.UI_REVIEW) {
    const report = [];
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    for (const route of ['/', '/find', '/results?limit=1', '/program/' + id1, '/favorites', '/contact']) {
      await navigate(route);
      await until('!document.querySelector("[aria-busy=true]")');
      for (const width of [1440, 320]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 760 });
        await delay(100);
        const label = route === '/' ? 'home' : route.startsWith('/program/') ? 'details' : route.split(/[/?]/)[1];
        const metrics = await evaluate(`({ width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,
          shortControls:[...document.querySelectorAll('button,input,select,textarea,a')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<24}).map(el=>({tag:el.tagName,label:el.getAttribute('aria-label')||el.textContent.trim().slice(0,32),height:Math.round(el.getBoundingClientRect().height)})) })`);
        const accessibility = await evaluate(`(${inspectAccessibility.toString()})(${contrastRatio.toString()})`);
        report.push({ route, ...metrics, accessibility });
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(cwd, `node_modules/.cache/stage6-${process.env.UI_REVIEW}-${label}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await writeFile(path.join(cwd, `node_modules/.cache/stage6-${process.env.UI_REVIEW}.json`), JSON.stringify(report, null, 2));
    console.log(`UI inspection: ${report.length} screenshots/reports saved; ${report.reduce((sum, item) => sum + item.accessibility.failures.length, 0)} computed text contrast failures`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  }
  await navigate('/'); await until('!!document.querySelector(".hero-finder select[name=category] option[value=clubs]")');
  await setValue('.hero-finder select[name=category]','clubs');
  await evaluate('document.querySelector(".hero-finder").requestSubmit()');
  await until('location.pathname==="/results" && document.querySelectorAll(".program-card").length===2');
  assert.equal(await evaluate('new URLSearchParams(location.search).get("category")'), 'clubs');
  assert.ok(requests.some(item => item.path.endsWith('/programs') && new URLSearchParams(item.search).get('category') === 'clubs'));
  check('API category navigation opens filtered results');

  await navigate('/'); await until('document.querySelectorAll(".hero-finder select[name=region] option").length===2');
  await setValue('.hero-finder [name=region]', 'test-region'); await setValue('.hero-finder [name=category]', 'clubs'); await setValue('.hero-finder [name=age]', '0');
  await evaluate('document.querySelector(".hero-finder").requestSubmit()');
  await until('location.pathname==="/results" && !!document.querySelector(".program-card")');
  const filters = await evaluate('Object.fromEntries(new URLSearchParams(location.search))');
  assert.deepEqual(filters, { region: 'test-region', age: '0', category: 'clubs' });
  check('API region/category names map to supported slug filters and age zero');

  await navigate('/results?category=clubs&limit=1'); await until('!!document.querySelector(".pagination")');
  const first = await evaluate('document.querySelector(".program-card h2").textContent');
  await evaluate('document.querySelector(".pagination button:last-child").click()');
  await until('new URLSearchParams(location.search).get("page")==="2" && document.querySelector(".pagination [aria-current=page]")?.textContent.startsWith("2") && !!document.querySelector(".program-card")');
  assert.notEqual(await evaluate('document.querySelector(".program-card h2").textContent'), first);
  await setValue('.discovery-search [name=q]', 'new'); await evaluate('document.querySelector(".discovery-search").requestSubmit()');
  await until('new URLSearchParams(location.search).get("q")==="new" && !!document.querySelector(".program-card")');
  assert.equal(await evaluate('new URLSearchParams(location.search).has("page")'), false);
  check('pagination and search preserve filters and reset page');

  await navigate('/results?q=flaky'); await until('!!document.querySelector(".request-error")');
  assert.match(await evaluate('document.querySelector(".request-error").textContent'), /Деректерді жүктеу мүмкін болмады\. Қайталап көріңіз/);
  flaky = 1;
  await evaluate('document.querySelector(".request-error button").click()'); await until('document.querySelectorAll(".program-card").length===2');
  check('API failure has localized error and working retry');
  await navigate('/results?q=slow'); await until('!!document.querySelector("[aria-busy=true]")');
  await setValue('.discovery-search [name=q]', 'new'); await evaluate('document.querySelector(".discovery-search").requestSubmit()');
  await until('document.querySelectorAll(".program-card").length===2'); await delay(800);
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Ескірген")'), false);
  check('loading state and cancellation prevent stale search results');

  await navigate('/program/' + id1); await until('!!document.querySelector(".details-heading")');
  assert.equal(await evaluate('document.querySelector(".details-content a").href'), 'https://example.com/test');
  assert.match(await evaluate('document.querySelector(".details-content").textContent'), /Тексерілген күні:/);
  await until('!document.querySelector(".save-button").disabled');await evaluate('document.querySelector(".save-button").click()');
  await until('!!document.querySelector(".saved-feedback a")');
  assert.equal(new URL(await evaluate('document.querySelector(".saved-feedback a").href')).searchParams.get('returnTo'),'/program/'+id1);
  assert.equal(await evaluate('document.querySelector(".save-button").getAttribute("aria-pressed")'), 'false');
  await evaluate(`localStorage.setItem('balaqoldau:favorites',JSON.stringify([${JSON.stringify(id1)}]))`);
  await navigate('/favorites'); await until('!!document.querySelector(".program-card")');
  await evaluate('document.querySelector("main .inner-page > button").click()'); await until('!!document.querySelector(".empty")');
  check('API details offer anonymous login; existing browser favorites remain readable and clearable');
  await navigate('/program/' + privateId); await until('!!document.querySelector(".request-error")');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("DEMO hidden")'), false);
  await navigate('/program/44444444-4444-4444-8444-444444444444'); await until('!!document.querySelector(".empty")');
  check('DEMO/draft payload is rejected and unavailable detail is honest');

  catalogFailure = true; await navigate('/'); await until('!!document.querySelector(".request-error")');
  catalogFailure = false;
  await evaluate('document.querySelector(".request-error button").click()'); await until('!!document.querySelector(".hero-finder select[name=category]:not(:disabled)")');
  check('catalog loading failure can be retried');

  await navigate('/contact'); await evaluate('document.querySelector(".contact-form").requestSubmit()');
  await until('document.querySelectorAll(".field-error").length===3');
  await setValue('[name=senderName]', 'TEST sender'); await setValue('[name=email]', 'test@example.com'); await setValue('[name=message]', 'TEST contact, browser fixture only');
  contactMode = 'error'; await evaluate('document.querySelector(".contact-form").requestSubmit()');
  await until('!!document.querySelector(".contact-form [role=alert]")');
  const before = requests.filter(item => item.method === 'POST').length;
  contactMode = 'success'; await evaluate('document.querySelector(".contact-form").requestSubmit(); document.querySelector(".contact-form").requestSubmit()');
  await until('document.querySelector(".contact-form button").disabled');
  await until('!!document.querySelector(".contact-form [role=status]")');
  assert.equal(requests.filter(item => item.method === 'POST').length, before + 1);
  assert.equal(await evaluate('document.querySelector("[name=email]").value'), '');
  check('contact validation, pending state, explicit retry, success and duplicate-submit guard');

  await navigate('/'); await until('!!document.querySelector(".hero-finder select[name=category]:not(:disabled)")');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 760 });
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, `No overflow at ${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1000, deviceScaleFactor: 1, mobile: true });
  await evaluate('document.querySelector(".mobile-toggle").click()');
  await until('document.querySelector(".mobile-toggle").getAttribute("aria-expanded")==="true"');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until('document.querySelector(".mobile-toggle").getAttribute("aria-expanded")==="false"');
  assert.equal(await evaluate('document.activeElement.classList.contains("mobile-toggle")'), true);
  check('four responsive widths, mobile menu, Escape and focus');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/'); await until('!!document.querySelector(".hero-finder select[name=category]:not(:disabled)")');
  await send('Page.bringToFront');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate('document.activeElement.classList.contains("skip-link")'), true);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until('document.activeElement.id==="main"');
  check('keyboard skip link focuses semantic main content');
  await evaluate(`document.querySelector('header a[href="/results"]').focus()`);
  await keypress('Enter', 'Enter', 13);
  await until('location.pathname==="/results" && ["main","results-heading"].includes(document.activeElement.id)');
  assert.match(await evaluate('document.title'), /Іздеу нәтижелері/);
  check('SPA keyboard navigation updates title and focuses main');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 1000, deviceScaleFactor: 1, mobile: true });
  await evaluate('document.querySelector(".mobile-toggle").focus()');
  await keypress('Enter', 'Enter', 13);
  await until('document.querySelector(".mobile-toggle").getAttribute("aria-expanded")==="true"');
  await keypress('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.querySelector("#primary-navigation").contains(document.activeElement)'), true);
  await keypress('Escape', 'Escape', 27);
  assert.equal(await evaluate('document.activeElement.classList.contains("mobile-toggle")'), true);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#primary-navigation")).display'), 'none');
  check('320px disclosure menu supports Enter, Tab into links and Escape without hidden tab stops');

  await navigate('/contact');
  await evaluate('document.querySelector(".contact-form button[type=submit]").focus()');
  await keypress('Enter', 'Enter', 13);
  await until('document.activeElement.classList.contains("error-summary")');
  assert.equal(await evaluate('document.querySelectorAll("[aria-invalid=true]").length'), 3);
  await keypress('Tab', 'Tab', 9); await keypress('Enter', 'Enter', 13);
  await until('document.activeElement.id==="contact-senderName"');
  assert.match(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), /solid/);
  for (const expected of ['contact-email', 'contact-message']) {
    await keypress('Tab', 'Tab', 9); assert.equal(await evaluate('document.activeElement.id'), expected);
  }
  const tree = await send('Accessibility.getFullAXTree');
  const names = tree.nodes.filter(node => !node.ignored && node.role?.value === 'textbox').map(node => node.name?.value);
  assert.deepEqual(names, ['Атыңыз', 'Электрондық пошта', 'Хабарлама']);
  check('form summary links, visible keyboard focus, explicit labels and Chrome accessibility names');

  manyCategories = true;
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('/'); await until('document.querySelector(".hero-finder select[name=category]")?.options.length===7');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 760 });
    assert.equal(await evaluate(`(() => { const cards=[...document.querySelectorAll('.service-directions a')].map(el=>el.getBoundingClientRect()); return cards.every((a,i)=>cards.every((b,j)=>i===j||a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1)); })()`), true, `No category overlaps at ${width}`);
  }
  assert.equal(await evaluate('document.querySelectorAll(".service-directions").length'),1);
  assert.equal(await evaluate('document.querySelectorAll(".service-directions a").length'),4);
  check('six long API category options and one four-link category navigation fit five widths');

  const auditReports = [];
  const routes = ['/', '/find', '/ai-assistant', '/results?limit=1', '/results?q=empty', '/results?q=fail', '/program/' + id1, '/program/44444444-4444-4444-8444-444444444444', '/favorites', '/contact', '/not-found'];
  for (const route of routes) {
    await navigate(route); await until('!document.querySelector("[aria-busy=true]") && !document.querySelector("select:disabled")');
    for (const width of [320, 375, 768, 1024, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 760 });
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, `${route} at ${width}`);
      const report = await evaluate(`(${inspectAccessibility.toString()})(${contrastRatio.toString()})`);
      assert.equal(report.h1Count, 1, `${route}: one h1`); assert.equal(report.mainCount, 1); assert.equal(report.language, 'kk');
      assert.equal(await evaluate('document.querySelectorAll(".platform-notice,.about-disclaimer").length'),0);
      assert.deepEqual(report.unlabelled, []); assert.deepEqual(report.failures, [], `${route} at ${width}: computed contrast`);
      auditReports.push({ route, width, ...report });
    }
  }
  await writeFile(path.join(cwd, 'node_modules/.cache/stage6-accessibility.json'), JSON.stringify(auditReports, null, 2));
  check(`${auditReports.length} page/width combinations: no overflow, semantic headings/labels and computed WCAG AA text contrast`);
  await navigate('/'); await until('document.querySelector(".hero-finder select[name=category]")?.options.length===7');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero-copy")).animationName'), 'none');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero-finder")).animationName'), 'none');
  assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollBehavior'), 'auto');
  check('prefers-reduced-motion disables entrance animation and smooth scrolling');
  await navigate('/results?q=slow'); await until('!!document.querySelector("[aria-busy=true]")');
  await evaluate('document.querySelector(".discovery-search [name=q]").focus()');
  await until('!!document.querySelector(".program-card")');
  assert.equal(await evaluate('document.activeElement.getAttribute("name")'), 'q');
  check('background results never steal focus from a user editing search');
  await navigate('/results?category=clubs&region=test-region&limit=1&page=2');
  await until('!!document.querySelector(".program-card")');
  await evaluate('document.querySelector(".program-card h2 a").click()'); await until('!!document.querySelector(".details-heading")');
  await evaluate('document.querySelector(".back-link").click()');
  await until('location.pathname==="/results" && !!document.querySelector(".program-card")');
  assert.deepEqual(await evaluate('Object.fromEntries(new URLSearchParams(location.search))'), { category: 'clubs', region: 'test-region', limit: '1', page: '2' });
  check('program back navigation preserves category, region and pagination');
  await navigate('/login?lang=kk');await until('!!document.querySelector("#user-email")');
  assert.equal(await evaluate('!!document.querySelector(".account-language")'),false);
  await evaluate('document.querySelector(".language-trigger").focus()');await keypress('Enter','Enter',13);
  await until('document.activeElement.getAttribute("role")==="menuitemradio"');
  await keypress('ArrowDown','ArrowDown',40);await keypress('Enter','Enter',13);
  await until('document.querySelector(".account-page").lang==="ru"');
  assert.equal(await evaluate('document.querySelector(".language-trigger").textContent.trim()'),'РУС');
  assert.equal(await evaluate('document.activeElement.classList.contains("language-trigger")'),true);
  check('single header language menu supports keyboard selection and existing Russian localization');
  await evaluate('document.querySelector(".language-trigger").click()');await keypress('Escape','Escape',27);
  assert.equal(await evaluate('document.querySelector(".language-trigger").getAttribute("aria-expanded")'),'false');
  assert.equal(await evaluate('document.activeElement.classList.contains("language-trigger")'),true);
  await evaluate('document.querySelector(".language-trigger").click()');await until('!!document.querySelector(".language-menu")');
  await evaluate('document.querySelector("main").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');
  await until('document.querySelector(".language-trigger").getAttribute("aria-expanded")==="false"');
  check('Escape restores trigger focus and outside pointer closes the language menu');
  await evaluate('document.querySelector("#primary-navigation a[href^=\\"/results\\"]").click()');
  await until('location.pathname==="/results"&&new URLSearchParams(location.search).get("lang")==="ru"');
  await evaluate('document.querySelector(".footer-top a[href=\\"/contact\\"]").click()');
  await until('location.pathname==="/contact"&&new URLSearchParams(location.search).get("lang")==="ru"');
  assert.equal(await evaluate('document.querySelector(".language-trigger").textContent.trim()'),'РУС');
  check('language persists through header and existing footer navigation without another locale state');
  for(const width of [320,375,768,1024,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
    await evaluate('document.querySelector(".language-trigger").click()');
    const report=await evaluate('(()=>{const r=document.querySelector(".language-menu").getBoundingClientRect();return {left:r.left,right:r.right,overflow:document.documentElement.scrollWidth>innerWidth,visible:document.querySelector(".language-trigger").getBoundingClientRect().width>0};})()');
    assert.equal(report.visible,true);assert.equal(report.overflow,false);assert.ok(report.left>=0&&report.right<=width);
    await keypress('Escape','Escape',27);
  }
  check('compact language trigger and dropdown remain visible and within five viewport widths');
  fixtureAuthenticated=true;await navigate('/profile?lang=ru');await until('!!document.querySelector("#profile-name")');
  await setValue('#profile-name','TEST preserved draft');
  await evaluate('document.querySelector(".language-trigger").click()');await until('!!document.querySelector(".language-menu")');
  await evaluate('document.querySelector("[role=menuitemradio][lang=kk]").click()');
  await until('document.querySelector(".account-page").lang==="kk"');
  assert.equal(await evaluate('document.querySelector("#profile-name").value'),'TEST preserved draft');
  assert.equal(await evaluate('document.querySelector(".language-trigger").textContent.trim()'),'ҚАЗ');
  assert.equal(await evaluate('!!document.querySelector(".account-language")'),false);
  check('profile uses the single header switcher and retains unsaved inputs across language selection');
  assert.deepEqual(runtimeErrors, []);
  console.log(`Browser integration: ${passed}/${passed} PASS; only real GET requests reached development backend`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close', {}, null); } catch { /* Owned browser may close before acknowledgment. */ } socket.close(); }
  for (const item of pending.values()) clearTimeout(item.timer);
  clearInterval(keepAlive);
  if (chrome) chrome.kill(); vite?.kill();
  if (builtSite) { builtSite.closeAllConnections(); await new Promise(resolve => builtSite.close(resolve)); }
  if (apiProcess.exitCode === null && apiProcess.signalCode === null) { apiProcess.send('shutdown'); await Promise.race([once(apiProcess, 'exit'), delay(5000)]); if (apiProcess.exitCode === null) apiProcess.kill(); }
}
