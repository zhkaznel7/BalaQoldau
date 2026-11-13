// Real authenticated submissions -> both admin inboxes -> private account. Rollback-only fixtures.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {once} from 'node:events';import {createServer} from 'node:http';import {fileURLToPath} from 'node:url';
import {openUserDatabase} from '../../backend/tests/helpers/user-database.mjs';import {createApp} from '../../backend/dist/app.js';import {parseEnvironment} from '../../backend/dist/config/env.js';import {hashPassword} from '../../backend/dist/admin/password.js';import {userToken,userTokenHash} from '../../backend/dist/users/repository.js';
import {serveBuiltSite} from './helpers/built-site.mjs';import {adminBrowser} from './helpers/admin-browser.mjs';import {tr} from '../src/i18n/ui.ts';
const {pool,config}=await openUserDatabase(),db=await pool.connect();let api,site,browser,count=0;
const pass=label=>{count++;console.log('PASS '+count+': '+label);};
try{
 await db.query('BEGIN');const admin=randomUUID(),parent=randomUUID(),program=randomUUID(),hash=await hashPassword('TEST reply browser password!'),token=userToken(),csrf=userToken();
 await db.query("INSERT INTO balaqoldau.admin_users(id,email,password_hash,role) VALUES($1,$2,$3,'admin')",[admin,admin+'@example.com',hash]);
 await db.query("INSERT INTO balaqoldau.user_accounts(id,email,password_hash,full_name) VALUES($1,$2,$3,'TEST parent')",[parent,parent+'@example.com',hash]);
 await db.query("INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,expires_at,credential_version) VALUES($1,$2,$3,now()+interval '1 hour',1)",[userTokenHash(token),csrf,parent]);
 await db.query(`INSERT INTO balaqoldau.programs(id,slug,category_id,title,description,status,source_url,source_name,verified_at)
  SELECT $1,$2,id,'TEST reply browser','TEST fixture, rolled back','published','https://example.com/test','TEST',now() FROM balaqoldau.categories LIMIT 1`,[program,'test-reply-'+program]);
 const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));const origin='http://127.0.0.1:'+port;
 api=createApp(parseEnvironment({...config,NODE_ENV:'test',TRUST_PROXY_LOOPBACK:'true',USER_AUTH_ENABLED:'true',USER_ORIGIN:origin,ADMIN_ENABLED:'true',ADMIN_ORIGIN:origin,CORS_ALLOWED_ORIGINS:origin,RATE_LIMIT_MAX:'1000'}),db).listen(0,'127.0.0.1');await once(api,'listening');
 site=await serveBuiltSite(fileURLToPath(new URL('../dist',import.meta.url)),port,api.address().port);browser=await adminBrowser(fileURLToPath(new URL('../',import.meta.url)));
 await browser.send('Network.setCookie',{name:'balaqoldau_user',value:token,url:origin,path:'/api/auth',httpOnly:true,sameSite:'Strict'});
 await browser.navigate(origin+'/contact?lang=kk');await browser.until(`document.querySelector('#contact-senderName')?.value==='TEST parent'`);
 await browser.setValue('#contact-message','TEST authenticated message');await browser.evaluate("document.querySelector('.contact-form').requestSubmit()");await browser.until("!!document.querySelector('.form-feedback.is-success')");
 const contact=(await db.query('SELECT id FROM balaqoldau.contact_messages WHERE user_id=$1',[parent])).rows[0].id;pass('authenticated contact uses real session ownership');
 await browser.navigate(origin+'/program/'+program+'?lang=ru');await browser.until("!!document.querySelector('.program-report')");await browser.evaluate("document.querySelector('.program-report').open=true");await browser.setValue('#public-report-explanation','TEST report');await browser.button(tr('m404',{},'ru'));await browser.until(`document.querySelector('.program-report [role=status]')?.textContent===${JSON.stringify(tr('m405',{},'ru'))}`);
 const report=(await db.query('SELECT id FROM balaqoldau.program_reports WHERE user_id=$1 AND program_id=$2',[parent,program])).rows[0].id;pass('authenticated error report uses the existing public detail form');
 await browser.navigate(origin+'/admin/login?lang=ru');await browser.until("!!document.querySelector('#admin-email')");await browser.setValue('#admin-email',admin+'@example.com');await browser.setValue('#admin-password','TEST reply browser password!');await browser.button(tr('m030',{},'ru'));await browser.until("!!document.querySelector('.admin-nav')");
 for(const [kind,id,path]of [['contact',contact,'/admin/messages/'+contact],['report',report,'/admin/reports']]){
  await browser.navigate(origin+path+'?lang=ru');await browser.until(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(tr('m484',{},'ru'))})`);
  if(kind==='report')await browser.evaluate(`document.querySelector('a[href="/admin/programs/${program}"]').closest('li').querySelector('button[aria-expanded]').click()`);else await browser.button(tr('m484',{},'ru'));
  await browser.until(`!!document.querySelector('#reply-${id}')`);await browser.setValue('#reply-'+id,'TEST '+kind+' reply <script>plain text</script>');
  await browser.evaluate(`document.querySelector('#reply-${id}').closest('form').requestSubmit()`);await browser.until(`document.querySelector('#reply-${id}').closest('section')?.textContent.includes(${JSON.stringify(tr('m489',{},'ru'))})`);pass(kind+' admin reply is stored and made available in the account');
 }
 for(const language of ['kk','ru']){
  await browser.send('Emulation.setDeviceMetricsOverride',{width:language==='kk'?375:1280,height:900,deviceScaleFactor:1,mobile:language==='kk'});
  await browser.navigate(origin+'/profile/messages?lang='+language);await browser.until("document.querySelector('.dashboard')?.textContent.includes('TEST contact reply')&&document.querySelector('.dashboard')?.textContent.includes('TEST report reply')");
  assert.equal(await browser.evaluate("document.querySelector('.dashboard h1').textContent"),tr('m492',{},language));assert.equal(await browser.evaluate("!!document.querySelector('.dashboard script')"),false);assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);pass(language+' private inbox shows both escaped replies with responsive layout');
 }
 assert.deepEqual(browser.errors,[]);console.log('Replies browser: '+count+'/'+count+' PASS; all fixtures rolled back.');
}finally{if(browser)await browser.close();if(site){site.closeAllConnections();await new Promise(resolve=>site.close(resolve));}if(api){api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}await db.query('ROLLBACK');db.release();await pool.end();}
