// Built React and isolated API fixtures; no accounts, credentials or database writes.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {serveBuiltSite} from './helpers/built-site.mjs';
import {adminBrowser} from './helpers/admin-browser.mjs';
import {tr} from '../src/i18n/ui.ts';
const server=await serveBuiltSite(fileURLToPath(new URL('../dist',import.meta.url)),0,1);
const origin=process.env.ADMIN_SESSION_TEST_ORIGIN||'http://127.0.0.1:'+server.address().port;
if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin))throw new Error('Owned local browser target required');
const browser=await adminBrowser(fileURLToPath(new URL('../',import.meta.url)));
const id='11111111-1111-4111-8111-111111111111';
let mode='ok',count=0;const calls=[];
const page={data:[],pagination:{page:1,limit:20,total:0,totalPages:0}};
await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__clockOffset=0;const originalNow=Date.now.bind(Date);Date.now=()=>originalNow()+window.__clockOffset;'});
await browser.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
const failures=[],cancelled=new Set();
browser.onEvent(event=>{
if(event.method==='Network.loadingFailed'&&event.params.canceled)cancelled.add(event.params.requestId);
if(event.method!=='Fetch.requestPaused')return;void(async()=>{
  const path=new URL(event.params.request.url).pathname;
  if(!path.startsWith('/api/')){await browser.send('Fetch.continueRequest',{requestId:event.params.requestId});return;}
  calls.push(path);
  let status=200,body,headers=[];
  if(path==='/api/admin/session'){
    if(mode==='network'){await browser.send('Fetch.failRequest',{requestId:event.params.requestId,errorReason:'InternetDisconnected'});return;}
    status=/^\d+$/.test(mode)?Number(mode):200;
    if(status===429)headers.push({name:'Retry-After',value:'5'});
    body=status===200?{data:{authenticated:true,admin:{id},csrfToken:'b'.repeat(64)}}:{error:{code:'TEST_FAILURE',message:'PRIVATE SERVER DETAILS'}};
  }else if(path==='/api/admin/access'){
    status=mode==='access403'?403:200;body={data:{id,role:'admin',permissions:['programs:read','programs:draft:write','programs:review','programs:publish']}};
  }else if(path==='/api/admin/programs/taxonomy')body={data:{categories:[{slug:'benefits',name:'Source category'}],regions:[],familyCategories:[]}};
  else if(path==='/api/admin/programs')body=page;
  else{status=404;body={error:{code:'NOT_FOUND'}};}
  await browser.send('Fetch.fulfillRequest',{requestId:event.params.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},...headers],body:Buffer.from(JSON.stringify(body)).toString('base64')});
})().catch(async error=>{await new Promise(resolve=>setTimeout(resolve,0));if(!cancelled.has(event.params.networkId))failures.push(error.message);});});
const verifyCount=()=>calls.filter(path=>path==='/api/admin/session').length;
const check=(label)=>{count++;console.log('PASS '+count+': '+label);};
const burst=()=>browser.evaluate("window.__clockOffset+=20000;for(let i=0;i<10;i++){window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));}");
const choose=async language=>{await browser.evaluate("document.querySelector('.language-trigger').click()");await browser.evaluate(`document.querySelector('[role=menuitemradio][lang=${language}]').click()`);};
try{
 for(const language of ['kk','ru']){
  mode='ok';calls.length=0;await browser.navigate(origin+'/admin/programs/new?lang='+language);
  await browser.until("!!document.querySelector('#program-title')");assert.equal(verifyCount(),1);
  for(let i=0;i<6;i++){
    await browser.evaluate("document.querySelector('.admin-nav a[href=\"/admin/programs\"]').click()");await browser.until("!!document.querySelector('.admin-filters')");
    await browser.evaluate("document.querySelector('.admin-nav a[href=\"/admin/programs/new\"]').click()");await browser.until("!!document.querySelector('#program-title')");
  }
  assert.equal(verifyCount(),1);check(language+' repeated navigation keeps one verified session');
  await browser.send('Page.reload',{ignoreCache:true});await browser.until("!!document.querySelector('#program-title')");assert.equal(verifyCount(),2);check(language+' refresh verifies once and retains authenticated access');
  await browser.setValue('#program-title','TEST unsaved draft');
  for(const failure of ['429','503','500','network']){
    mode=failure;const before=verifyCount();await burst();await browser.until("!!document.querySelector('.admin-session-problem')");
    assert.equal(verifyCount(),before+1);assert.equal(await browser.evaluate("document.querySelector('#program-title')?.value"),'TEST unsaved draft');
    assert.equal(await browser.evaluate("!!document.querySelector('.admin-nav')&&!document.querySelector('#admin-email')"),true);
    assert.equal(await browser.evaluate("document.body.innerText.includes('PRIVATE SERVER DETAILS')"),false);
    await choose(language==='kk'?'ru':'kk');
    await browser.until(`document.querySelector('.admin-session-problem p')?.textContent===${JSON.stringify(tr(failure==='429'?'m039':failure==='network'?'m032':'m041',{},language==='kk'?'ru':'kk'))}`);
    assert.equal(await browser.evaluate("document.querySelector('.admin-session-problem p').textContent"),tr(failure==='429'?'m039':failure==='network'?'m032':'m041',{},language==='kk'?'ru':'kk'));
    if(failure==='429'){
      assert.equal(await browser.evaluate("document.querySelector('.admin-session-problem button').disabled"),true);
      await browser.evaluate("document.querySelector('.admin-session-problem button').click();window.dispatchEvent(new Event('focus'))");assert.equal(verifyCount(),before+1);
      await browser.evaluate('window.__clockOffset+=6000');await browser.until("!document.querySelector('.admin-session-problem button').disabled");
    }
    mode='ok';await browser.evaluate("document.querySelector('.admin-session-problem button').click()");await browser.until("!document.querySelector('.admin-session-problem')");
    assert.equal(await browser.evaluate("document.querySelector('#program-title').value"),'TEST unsaved draft');
    await choose(language);check(language+' '+failure+' preserves session/draft, localizes safely and recovers explicitly');
  }
  mode='access403';await burst();await browser.until(`document.querySelector('h1')?.textContent===${JSON.stringify(tr('m458',{},language))}`);
  assert.equal(await browser.evaluate("location.pathname"),'/admin/programs/new');assert.equal(await browser.evaluate("!!document.querySelector('.admin-nav')"),false);
  mode='ok';await browser.evaluate("document.querySelector('.admin-session-problem button').click()");await browser.until("!!document.querySelector('#program-title')");check(language+' 403 denies UI access without an automatic logout request');
  mode='401';await burst();await browser.until("location.pathname==='/admin/login'&&!!document.querySelector('#admin-email')");check(language+' actual 401 clears private UI and redirects to login');
  mode='429';await browser.navigate(origin+'/admin/programs/new?lang='+language);await browser.until("!!document.querySelector('.admin-session-problem')");
  assert.equal(await browser.evaluate("!!document.querySelector('#admin-email')"),false);
  await browser.evaluate('window.__clockOffset+=6000');await browser.until("!document.querySelector('.admin-session-problem button').disabled");
  mode='ok';await browser.evaluate("document.querySelector('.admin-session-problem button').click()");await browser.until("!!document.querySelector('#program-title')");check(language+' initial limited verification recovers without losing a valid server session');
 }
 assert.equal(calls.some(path=>path.endsWith('/logout')),false);assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);
 console.log('Admin session browser: '+count+'/'+count+' PASS; no database access.');
}catch(error){
 console.error('Owned QA browser diagnostic:',JSON.stringify({requests:calls,errors:browser.errors,fixtureFailures:failures,view:await browser.evaluate("({path:location.pathname,heading:document.querySelector('h1')?.textContent,main:document.querySelector('main')?.innerText.slice(0,500)})")}));throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
