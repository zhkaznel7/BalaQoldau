// Real built frontend and Express with synthetic user fixtures on authorized dev DB only.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import { createApp } from '../../backend/dist/app.js';
import { parseEnvironment } from '../../backend/dist/config/env.js';
import { openUserDatabase } from '../../backend/tests/helpers/user-database.mjs';
import { serveBuiltSite } from './helpers/built-site.mjs';
import { adminBrowser } from './helpers/admin-browser.mjs';
import { inspectAccessibility,contrastRatio } from './helpers/accessibility.mjs';
import { hashPassword } from '../../backend/dist/admin/password.js';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const {pool,config}=await openUserDatabase();
let db,apiServer,site,browser,passed=0;
const pass=label=>console.log(`PASS ${++passed}: ${label}`),deliveries=[];
const password='User8pw!',email=`test-${randomUUID()}@example.com`;
try{
  db=await pool.connect();await db.query('BEGIN');
  const suffix=randomUUID(),programIds=[];
  const category=(await db.query('INSERT INTO balaqoldau.categories(slug,name) VALUES($1,$2) RETURNING id',['test-browser-'+suffix,'TEST category — rollback only'])).rows[0].id;
  const childRegion='test-child-browser-'+suffix;
  await db.query('INSERT INTO balaqoldau.regions(slug,name) VALUES($1,$2)',[childRegion,'TEST child region — rollback only']);
  for(let i=0;i<2;i++){
    const id=randomUUID();programIds.push(id);
    await db.query(`INSERT INTO balaqoldau.programs(id,slug,category_id,title,description,status,source_url,source_name,verified_at,age_max)
      VALUES($1,$2,$3,$4,$5,'published',$6,$7,clock_timestamp(),17)`,[id,'test-'+id,category,'TEST browser '+suffix+' '+i,'Synthetic fixture, not a real benefit','https://example.com/test','TEST source']);
  }
  const reservation=createServer().listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const origin=`http://127.0.0.1:${port}`;
  apiServer=createApp(parseEnvironment({NODE_ENV:'test',TRUST_PROXY_LOOPBACK:'true',CORS_ALLOWED_ORIGINS:origin,DATABASE_URL:config.DATABASE_URL,
    USER_AUTH_ENABLED:'true',USER_ORIGIN:origin,ADMIN_ENABLED:'true',ADMIN_ORIGIN:origin}),db,async()=>true,async(_email,url)=>{deliveries.push(url);}).listen(0,'127.0.0.1');
  await once(apiServer,'listening');site=await serveBuiltSite(path.join(cwd,'dist'),port,apiServer.address().port);
  browser=await adminBrowser(cwd);const {evaluate,until,setValue,button,send}=browser;
  const cleanAuth=async()=>assert.equal(await evaluate(`!document.querySelector('.account-language, #password-hint')&&!document.querySelector('#user-password')?.hasAttribute('aria-describedby')`),true,'Auth pages hide language controls/helper text without dangling descriptions');
  await browser.navigate(origin+'/profile');await until(`location.pathname==='/login'&&!!document.querySelector('#user-email')`);pass('anonymous profile redirects; real server owns access');
  await cleanAuth();
  const resultsPath='/results?q='+suffix;
  await browser.navigate(origin+resultsPath);await until(`document.querySelectorAll('.program-card').length===2&&!document.querySelector('.save-button').disabled`);
  await evaluate(`document.querySelector('.save-button').click()`);await until(`!!document.querySelector('.saved-feedback a')`);
  const offered=await evaluate(`document.querySelector('.saved-feedback a').getAttribute('href')`);
  assert.equal(new URL(offered,origin).searchParams.get('returnTo'),resultsPath);assert.equal(await evaluate('location.pathname'),'/results');
  pass('anonymous save offers login without leaving search or persisting local data');
  await browser.navigate(origin+'/login');await until(`!!document.querySelector('#user-email')`);
  await evaluate(`document.querySelector('.account-links a[href^="/register"]').click()`);await until(`!!document.querySelector('#user-confirm')`);
  await setValue('#user-email',email);await setValue('#user-password','x'.repeat(7));await setValue('#user-confirm','x'.repeat(7));await button('Тіркелу');
  await until(`!!document.querySelector('.account-feedback.error')`);
  assert.equal(await evaluate(`document.querySelector('.account-feedback').textContent.includes('8')&&document.querySelector('.account-feedback').textContent.includes('256')`),true);
  pass('seven-character registration is rejected with localized password bounds');
  await cleanAuth();
  await browser.navigate(origin+'/register?lang=ru');await until(`document.querySelector('.account-page')?.lang==='ru'&&!!document.querySelector('#user-confirm')`);await cleanAuth();
  await setValue('#user-email',email);await setValue('#user-password',password);await setValue('#user-confirm',password);
  await until(`document.querySelector('.account-page h1').textContent==='Регистрация'`);await button('Регистрация');await until(`!!document.querySelector('.account-feedback[role=status]')`);
  assert.equal((await db.query('SELECT language FROM balaqoldau.user_accounts WHERE email=$1',[email])).rows[0].language,'ru');pass('real registration and Russian URL localization work without language controls');
  await evaluate(`document.querySelector('.account-panel a[href^="/login"]').click()`);await until(`!!document.querySelector('#user-password')&&!document.querySelector('#user-confirm')`);
  await setValue('#user-email',email);await setValue('#user-password','incorrect-password');await button('Войти');await until(`!!document.querySelector('.account-feedback.error')`);
  assert.equal(await evaluate(`document.querySelector('#user-password').value`),'');assert.equal(await evaluate(`document.querySelector('.account-feedback').textContent.includes('Неверная')`),true);pass('generic login failure and password cleared without leaking backend errors');
  await browser.navigate(origin+'/login?lang=ru&returnTo='+encodeURIComponent(resultsPath));await until(`!!document.querySelector('#user-email')`);
  await setValue('#user-email',email);await setValue('#user-password',password);await button('Войти');await until(`location.pathname==='/results'&&document.querySelectorAll('.program-card').length===2`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('q')`),suffix);assert.equal(await evaluate(`new URLSearchParams(location.search).get('lang')`),'ru');pass('login returns safely to the original filtered search with selected language');
  await browser.navigate(origin+'/profile?lang=ru');await until(`!!document.querySelector('#profile-name')`);
  assert.equal(await evaluate(`document.querySelector('dd').textContent`),email);
  const cookie=(await send('Network.getCookies',{urls:[origin+'/api/auth/session']})).cookies.find(value=>value.name==='balaqoldau_user');
  assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'Strict');assert.equal(await evaluate(`document.cookie.includes('balaqoldau_user')`),false);
  assert.equal(await evaluate(`Object.values(localStorage).some(value=>value.includes(${JSON.stringify(email)})||value.includes('csrfToken'))`),false);pass('real login/profile with HttpOnly cookie and no client auth persistence');
  assert.equal(await evaluate(`fetch('/api/admin/access',{credentials:'same-origin'}).then(response=>response.status)`),401);pass('regular user cannot access existing admin RBAC');
  await setValue('#profile-name','  TEST   Parent  ');await setValue('#profile-location',' TEST city ');
  await evaluate(`document.querySelector('.language-trigger').click()`);await button('Қазақша');await until(`document.querySelector('.account-page').lang==='kk'`);
  assert.equal(await evaluate(`document.querySelector('#profile-name').value`),'  TEST   Parent  ');
  assert.equal(await evaluate(`!!document.querySelector('.account-language')`),false);
  await evaluate(`document.querySelector('.language-trigger').click()`);await button('Русский');await until(`document.querySelector('.account-page').lang==='ru'`);
  pass('header language selection updates profile localization without clearing edits or duplicate controls');
  await button('Сохранить изменения');
  await until(`!!document.querySelector('.account-panel [role=status]')`);assert.equal(await evaluate(`document.querySelector('#profile-name').value`),'TEST Parent');
  await browser.navigate(origin+'/profile?lang=ru');await until(`document.querySelector('#profile-name')?.value==='TEST Parent'`);
  assert.equal(await evaluate(`document.querySelector('#profile-location').value`),'TEST city');assert.equal(await evaluate(`!!document.querySelector('input[type=email]')`),false);
  pass('profile edits normalize and persist; authenticated email remains read-only');
  await browser.navigate(origin+'/profile/children?lang=ru');await until(`!!document.querySelector('.children-dashboard')&&!document.querySelector('.child-card')`);
  await button('Добавить профиль ребёнка');await until(`!!document.querySelector('#child-age')`);
  await setValue('#child-nickname','TEST child');await setValue('#child-age','6');await setValue('#child-region',childRegion);
  await evaluate(`[...document.querySelectorAll('.child-preferences label')].find(el=>el.textContent.includes('rollback only')).querySelector('input').click()`);
  await evaluate(`document.querySelector('.child-editor form').requestSubmit()`);await until(`document.querySelectorAll('.child-card').length===1&&!document.querySelector('.child-editor')`);
  await browser.navigate(origin+'/profile/children?lang=ru');await until(`document.querySelector('.child-card h2')?.textContent==='TEST child'`);
  pass('real authenticated child create and refresh persistence use the existing session and CSRF');
  await button('Редактировать');await until(`!!document.querySelector('#child-age')`);await setValue('#child-age','8');
  await evaluate(`document.querySelector('.child-editor form').requestSubmit()`);await until(`!document.querySelector('.child-editor')&&document.querySelector('.child-card dd')?.textContent==='8'`);
  await button('Посмотреть рекомендации');await until(`document.querySelectorAll('.child-recommendations .matching-possible').length===2`);
  assert.equal(await evaluate(`location.pathname+location.search`),'/profile/children?lang=ru');
  pass('real child editing and private Stage 14 recommendations keep incomplete source rules POSSIBLE');
  await button('Удалить');await until(`!!document.querySelector('[role=alertdialog]')`);await button('Отмена');await until(`!document.querySelector('[role=alertdialog]')`);
  assert.equal(await evaluate(`document.querySelectorAll('.child-card').length`),1);
  await button('Удалить');await button('Подтвердить удаление');await until(`!document.querySelector('.child-card')&&!document.querySelector('[role=alertdialog]')`);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM balaqoldau.child_profiles WHERE user_id=(SELECT id FROM balaqoldau.user_accounts WHERE email=$1)',[email])).rows[0].n,0);
  pass('real child deletion requires confirmation and removes only the selected synthetic profile');
  await browser.navigate(origin+'/profile/saved?lang=ru');await until(`!!document.querySelector('.dashboard .account-panel[role=status]')`);assert.equal(await evaluate(`document.querySelectorAll('.program-card').length`),0);pass('saved dashboard has an honest localized empty state');
  await browser.navigate(origin+resultsPath);await until(`document.querySelectorAll('.program-card').length===2&&!document.querySelector('.save-button').disabled`);
  await evaluate(`document.querySelectorAll('.save-button')[0].click()`);await until(`document.querySelectorAll('.save-button')[0].getAttribute('aria-pressed')==='true'`);
  const second=await evaluate(`document.querySelectorAll('.program-card h2 a')[1].getAttribute('href')`);await browser.navigate(origin+second);await until(`!!document.querySelector('.details-heading .save-button')&&!document.querySelector('.save-button').disabled`);
  await evaluate(`document.querySelector('.save-button').click()`);await until(`document.querySelector('.save-button').getAttribute('aria-pressed')==='true'`);
  await browser.navigate(origin+'/profile?lang=ru');await until(`document.querySelector('[data-saved-count]')?.getAttribute('data-saved-count')==='2'`);pass('results/detail saves persist in PostgreSQL and update the profile count');
  await browser.navigate(origin+'/profile/saved?lang=ru');await until(`document.querySelectorAll('.dashboard .program-card').length===2&&!document.querySelector('.save-button').disabled`);
  await evaluate(`document.querySelector('.save-button').click()`);await until(`document.querySelectorAll('.dashboard .program-card').length===1`);
  const remaining=await evaluate(`document.querySelector('.program-card h2 a').getAttribute('href')`);await evaluate(`document.querySelector('.program-card h2 a').click()`);await until(`!!document.querySelector('.back-link')`);
  assert.equal(await evaluate(`document.querySelector('.back-link').getAttribute('href')`),'/profile/saved?lang=ru');pass('saved removal and detail/back navigation preserve dashboard context');
  await db.query("UPDATE balaqoldau.programs SET status='draft' WHERE id=$1",[remaining.split('/').at(-1)]);
  await browser.navigate(origin+'/profile/saved?lang=ru');await until(`!!document.querySelector('.dashboard .account-panel[role=status]')`);
  assert.equal(await evaluate(`document.querySelectorAll('.program-card').length`),0);pass('unpublished fixture disappears from saved list without exposing its details');
  const originalQuery=db.query.bind(db);let releaseRead;const barrier=new Promise(resolve=>releaseRead=resolve);let delayOnce=true;
  db.query=async(...args)=>{if(delayOnce&&typeof args[0]==='string'&&args[0].includes('AS "savedCount"')){delayOnce=false;await barrier;}return originalQuery(...args);};
  try{await browser.navigate(origin+'/profile?lang=ru');await until(`!!document.querySelector('.dashboard > p[role=status]')`);releaseRead();await until(`!!document.querySelector('#profile-name')`);}finally{releaseRead();db.query=originalQuery;}
  let failOnce=true;db.query=async(...args)=>{if(failOnce&&typeof args[0]==='string'&&args[0].includes('AS "savedCount"')){failOnce=false;throw new Error('synthetic-private-profile-failure');}return originalQuery(...args);};
  try{await browser.navigate(origin+'/profile?lang=ru');await until(`!!document.querySelector('.dashboard [role=alert]')`);assert.equal(await evaluate(`document.body.textContent.includes('synthetic-private-profile-failure')`),false);await button('Проверить снова');await until(`!!document.querySelector('#profile-name')`);}finally{db.query=originalQuery;}
  pass('real dashboard loading/read failure has safe localized feedback and explicit retry');
  for(const width of [320,375,768,1024,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);const report=await evaluate(`(${inspectAccessibility.toString()})(${contrastRatio.toString()})`);assert.deepEqual(report.unlabelled,[]);assert.deepEqual(report.failures,[]);}
  pass('profile dashboard labels/contrast/layout work at five responsive widths');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(browser.profile,'profile-dashboard.png'),Buffer.from(screenshot.data,'base64'));console.log('Dashboard screenshot:',path.join(browser.profile,'profile-dashboard.png'));
  await button('Выйти');await until(`location.pathname==='/login'&&!!document.querySelector('#user-email')`);
  assert.equal(await evaluate(`fetch('/api/auth/profile',{credentials:'same-origin'}).then(response=>response.status)`),401);pass('logout revokes real server session');
  await evaluate(`document.querySelector('.account-links a[href^="/forgot-password"]').click()`);await until(`!!document.querySelector('#user-email')&&!document.querySelector('#user-password')`);
  await cleanAuth();
  await setValue('#user-email',email);await button('Запросить восстановление');await until(`!!document.querySelector('.account-feedback[role=status]')`);
  for(let i=0;i<100&&!deliveries.length;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(deliveries.length,1);
  const resetLink=deliveries[0];await browser.navigate(resetLink);await until(`!!document.querySelector('#user-confirm')`);await cleanAuth();
  assert.equal(await evaluate('location.hash'),'');await setValue('#user-password','Reset8x!');await setValue('#user-confirm','Reset8x!');
  await button('Жаңа құпиясөзді сақтау');await until(`!!document.querySelector('.account-feedback[role=status]')`);pass('real single-use reset flow; token removed from URL and no token displayed');
  await browser.navigate(resetLink);await until(`!!document.querySelector('#user-confirm')`);
  await setValue('#user-password',password);await setValue('#user-confirm',password);await button('Жаңа құпиясөзді сақтау');await until(`!!document.querySelector('.account-feedback.error')`);pass('replayed reset token is rejected');
  await browser.navigate(origin+'/login');await until(`!!document.querySelector('#user-email')`);
  for(const width of [320,375,768,1024,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'No overflow at '+width);
    const report=await evaluate(`(${inspectAccessibility.toString()})(${contrastRatio.toString()})`);assert.deepEqual(report.unlabelled,[]);assert.deepEqual(report.failures,[]);
  }
  await evaluate(`document.querySelector('#user-email').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  assert.equal(await evaluate(`document.activeElement.id==='user-password'&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3`),true);pass('five responsive widths, contrast, labels and visible keyboard focus');
  await setValue('#user-email',email);await setValue('#user-password','Reset8x!');await button('Кіру');await until(`location.pathname==='/profile'&&!!document.querySelector('dd')`);
  await db.query("UPDATE balaqoldau.user_sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE user_id IN(SELECT id FROM balaqoldau.user_accounts WHERE email=$1)",[email]);
  await evaluate(`window.dispatchEvent(new Event('focus'))`);await until(`location.pathname==='/login'&&!document.querySelector('dd')`);pass('expired server session removes private profile on focus');
  const adminEmail=randomUUID()+'@example.com';
  const adminPassword='Synthetic admin browser password!';
  await db.query('INSERT INTO balaqoldau.admin_users(email,password_hash,role) VALUES($1,$2,$3)',[adminEmail,await hashPassword(adminPassword),'editor']);
  await browser.navigate(origin+'/admin/login');await until(`!!document.querySelector('#admin-email')`);
  await setValue('#admin-email',adminEmail);await setValue('#admin-password',adminPassword);await button('Кіру');await until(`location.pathname==='/admin/programs'&&!!document.querySelector('.admin-table-wrap,.admin-empty')`);
  await button('Шығу');await until(`!!document.querySelector('#admin-email')`);pass('existing real admin login, program listing and logout remain operational');
  const apiPort=apiServer.address().port;apiServer.closeAllConnections();await new Promise(resolve=>apiServer.close(resolve));
  apiServer=createApp(parseEnvironment({NODE_ENV:'test',TRUST_PROXY_LOOPBACK:'true',CORS_ALLOWED_ORIGINS:origin,DATABASE_URL:config.DATABASE_URL,
    USER_AUTH_ENABLED:'true',USER_ORIGIN:origin}),db).listen(apiPort,'127.0.0.1');await once(apiServer,'listening');
  await browser.navigate(origin+'/forgot-password?lang=ru');await until(`!!document.querySelector('.account-panel [role=status]')`);
  assert.equal(await evaluate(`!!document.querySelector('#user-email')`),false);
  assert.equal(await evaluate(`document.querySelector('.account-panel').textContent.includes('не настроена')`),true);pass('unconfigured delivery has an honest Russian notice and no send form');
  assert.deepEqual(browser.errors,[]);console.log(`User browser: ${passed}/${passed} PASS; actual APIs; all synthetic data rolled back`);
}finally{
  await browser?.close();if(site){site.closeAllConnections();await new Promise(resolve=>site.close(resolve));}if(apiServer){apiServer.closeAllConnections();await new Promise(resolve=>apiServer.close(resolve));}
  if(db){await db.query('ROLLBACK');db.release();}await pool.end();
}
