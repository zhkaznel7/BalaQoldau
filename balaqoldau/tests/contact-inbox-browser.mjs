// Real public form -> Express/PostgreSQL -> authenticated inbox. Synthetic rows roll back.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {openUserDatabase} from '../../backend/tests/helpers/user-database.mjs';
import {createApp} from '../../backend/dist/app.js';
import {parseEnvironment} from '../../backend/dist/config/env.js';
import {hashPassword} from '../../backend/dist/admin/password.js';
import {serveBuiltSite} from './helpers/built-site.mjs';
import {adminBrowser} from './helpers/admin-browser.mjs';
import {tr} from '../src/i18n/ui.ts';
const {pool,config}=await openUserDatabase(),db=await pool.connect();let api,site,browser,count=0;
const pass=label=>{count++;console.log('PASS '+count+': '+label);};
try{
 await db.query('BEGIN');const id=randomUUID(),email=id+'@example.com',password='TEST inbox browser password!';
 await db.query("INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,'admin')",[id,email,await hashPassword(password)]);
 const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 const origin='http://127.0.0.1:'+port;
 api=createApp(parseEnvironment({...config,NODE_ENV:'test',TRUST_PROXY_LOOPBACK:'true',ADMIN_ENABLED:'true',ADMIN_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin,RATE_LIMIT_MAX:'1000'}),db).listen(0,'127.0.0.1');await once(api,'listening');
 site=await serveBuiltSite(fileURLToPath(new URL('../dist',import.meta.url)),port,api.address().port);browser=await adminBrowser(fileURLToPath(new URL('../',import.meta.url)));
 let drop=true;const failures=[];
 await browser.send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/contact-messages',requestStage:'Response'}]});
 browser.onEvent(event=>{if(event.method!=='Fetch.requestPaused')return;void(async()=>{
  if(drop&&event.params.responseStatusCode===201){drop=false;await browser.send('Fetch.failRequest',{requestId:event.params.requestId,errorReason:'ConnectionClosed'});}
  else await browser.send('Fetch.continueResponse',{requestId:event.params.requestId});
 })().catch(error=>failures.push(error.message));});
 const choose=async language=>{await browser.evaluate("document.querySelector('.language-trigger').click()");await browser.evaluate(`document.querySelector('[role=menuitemradio][lang=${language}]').click()`);};
 for(const language of ['kk','ru']){
  const sender='TEST inbox '+language,reply='test-'+randomUUID()+'@example.com',body='TEST <img src=x onerror=alert(1)> '+language;
  await browser.navigate(origin+'/contact?lang='+language);await browser.until("!!document.querySelector('#contact-senderName')");
  await browser.setValue('#contact-senderName',sender);await browser.setValue('#contact-email',reply);await browser.setValue('#contact-message',body);
  await browser.evaluate("document.querySelector('.contact-form').requestSubmit()");
  if(language==='kk'){
   await browser.until("!!document.querySelector('.form-feedback.is-error')");assert.equal(await browser.evaluate("document.querySelector('#contact-message').value"),body);
   // A normalized no-op edit must retain the key after an ambiguous lost response.
   await browser.setValue('#contact-message',body+' ');await browser.evaluate("document.querySelector('.contact-form').requestSubmit()");
  }
  await browser.until("!!document.querySelector('.form-feedback.is-success')");
  const stored=(await db.query('SELECT id,status,submission_id FROM balaqoldau.contact_messages WHERE email=$1',[reply])).rows;
  assert.equal(stored.length,1);assert.equal(stored[0].status,'unread');assert.ok(stored[0].submission_id);const messageId=stored[0].id;
  pass(language+' real form persists once; temporary failure preserves input and retry key');
  await browser.navigate(origin+'/admin/login?lang='+language);
  await browser.until("!!document.querySelector('#admin-email')||!!document.querySelector('.admin-nav')");
  if(await browser.evaluate("!!document.querySelector('#admin-email')")){await browser.setValue('#admin-email',email);await browser.setValue('#admin-password',password);await browser.button(tr('m030',{},language));await browser.until("!!document.querySelector('.admin-nav')");}
  await browser.evaluate("document.querySelector('.admin-nav a[href=\"/admin/messages\"]').click()");await browser.until(`!!document.querySelector('a[href="/admin/messages/${messageId}"]')`);
  assert.equal(await browser.evaluate("document.querySelector('h1').textContent"),tr('m460',{},language));
  await browser.evaluate(`document.querySelector('a[href="/admin/messages/${messageId}"]').click()`);await browser.until("!!document.querySelector('.contact-message-text')");
  assert.equal(await browser.evaluate("document.querySelector('.contact-message-text').textContent"),body);assert.equal(await browser.evaluate("!!document.querySelector('.contact-message-text img')"),false);
  await choose(language==='kk'?'ru':'kk');await browser.until(`document.querySelector('h1')?.textContent===${JSON.stringify(tr('m466',{},language==='kk'?'ru':'kk'))}`);await choose(language);
  await browser.until(`document.querySelector('h1')?.textContent===${JSON.stringify(tr('m466',{},language))}`);
  pass(language+' authorized inbox/detail displays plaintext safely and switches locale');
  await browser.button(tr('m469',{},language));await browser.until("!!document.querySelector('.admin-success')");
  assert.equal((await db.query('SELECT status FROM balaqoldau.contact_messages WHERE id=$1',[messageId])).rows[0].status,'read');
  await browser.button(tr('m410',{},language));await browser.until(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(tr('m471',{},language))})`);
  assert.equal((await db.query('SELECT status FROM balaqoldau.contact_messages WHERE id=$1',[messageId])).rows[0].status,'resolved');
  await browser.send('Page.reload',{ignoreCache:true});await browser.until(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(tr('m471',{},language))})`);
  await browser.button(tr('m471',{},language));await browser.until(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(tr('m410',{},language))})`);
  pass(language+' NEW -> READ -> RESOLVED persists after refresh and can reopen');
  await browser.until(`!!document.querySelector('#reply-${messageId}')&&!document.querySelector('#reply-${messageId}').disabled`);
  await browser.setValue('#reply-'+messageId,'TEST reply <script>not executable</script>');await browser.button(tr('m486',{},language));
  await browser.until(`document.querySelector('[aria-label="${tr('m487',{},language)}"]')?.textContent.includes(${JSON.stringify(tr('m490',{},language))})`);
  const response=(await db.query('SELECT body,delivery_status,admin_id FROM balaqoldau.inbox_replies WHERE contact_id=$1',[messageId])).rows;
  assert.equal(response.length,1);assert.equal(response[0].delivery_status,'saved_not_delivered');assert.equal(response[0].admin_id,id);
  assert.equal(await browser.evaluate(`!!document.querySelector('#reply-${messageId}').closest('section').querySelector('script')`),false);
  await browser.until("document.querySelectorAll('.reply-timeline li').length===1");
  assert.equal(await browser.evaluate("document.querySelectorAll('.reply-status-badge').length"),1);
  assert.equal(await browser.evaluate(`document.querySelector('.reply-form').textContent.includes(${JSON.stringify(tr('m488',{},language))})`),false);
  await browser.setValue('#reply-'+messageId,'TEST follow-up');await browser.button(tr('m484',{},language));await browser.button(tr('m484',{},language));
  assert.equal(await browser.evaluate(`document.querySelector('#reply-${messageId}').value`),'TEST follow-up');
  await browser.button(tr('m486',{},language));await browser.until("document.querySelectorAll('.reply-timeline li').length===2");
  assert.equal(await browser.evaluate("document.querySelectorAll('.reply-status-badge').length"),1);
  await browser.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  pass(language+' reply is persisted, escaped and truthfully marked not delivered');
  await browser.navigate(origin+'/admin/messages?status=read&limit=1&lang='+language);await browser.until("!!document.querySelector('.contact-inbox-list')");
  assert.equal(await browser.evaluate("document.querySelectorAll('.contact-inbox-list li').length"),1);
  for(const width of [320,375,768,1024,1440]){await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);}
  pass(language+' status filtering, bounded page and responsive inbox work');
 }
 assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);console.log('Contact inbox browser: '+count+'/'+count+' PASS; actual API/DB, rollback only.');
}finally{if(browser)await browser.close();if(site)await new Promise(resolve=>site.close(resolve));if(api){api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}await db.query('ROLLBACK');db.release();await pool.end();}
