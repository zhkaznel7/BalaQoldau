// Built frontend, owned Chrome, API fixtures only: no database or external services.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {serveBuiltSite} from './helpers/built-site.mjs';
import {adminBrowser} from './helpers/admin-browser.mjs';
import {tr} from '../src/i18n/ui.ts';
import {authText} from '../src/account/translations.ts';
import {kk} from '../src/i18n/kk.ts';
import {ru} from '../src/i18n/ru.ts';
import {evaluateMatch} from '../../backend/dist/matching/engine.js';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const server=await serveBuiltSite(fileURLToPath(new URL('../dist',import.meta.url)),0,1);
const origin='http://127.0.0.1:'+server.address().port;
const browser=await adminBrowser(cwd);
const id='11111111-1111-4111-8111-111111111111';
const program={id,slug:'test-original',title:'SOURCE original title',description:'SOURCE original description',category:'test-support',regions:['test-region'],familyCategories:[],sourceUrl:'https://example.com/test',sourceName:'SOURCE original source',applyUrl:'https://example.com/apply',verifiedAt:'2026-11-11T00:00:00Z',ageMin:0,ageMax:17,deadline:null,isDemo:false};
const privateProgram={...program,status:'draft',version:1,createdBy:id,submittedBy:null,reviewedBy:null};
const taxonomy=[{id:'1',slug:'test-support',name:'SOURCE original category'}];
const page=data=>({data,pagination:{page:1,limit:20,total:data.length,totalPages:data.length?1:0}});
let user=false,admin=false,empty=false,fail=false,noCategories=false,programStatus='draft',count=0;
let children=[],childSequence=1,childFail=false,childDelay=0,childRecommendationsEmpty=false;
const childRequests=[];
const failures=[];
function matchedProgram(url){const p={...program,eligibilityComplete:true,ageMin:5,ageMax:12,deadline:'2099-01-01',familyCategories:['test-need']};return {...p,matching:evaluateMatch(p,{...(url.searchParams.has('age')?{age:Number(url.searchParams.get('age'))}:{}),...(url.searchParams.has('region')?{region:url.searchParams.get('region')}:{}),...(url.searchParams.has('need')?{need:url.searchParams.get('need')}:{})})};}
await browser.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
// Use a dedicated listener on the existing CDP connection via protocol interception.
// adminBrowser exposes an event subscription so fixtures never reach a real backend.
const intercept=async event=>{
  const url=new URL(event.params.request.url),p=url.pathname;let status=200,body;
  const session={authenticated:user,user:user?{id,email:'test@example.com',language:'kk'}:null,csrfToken:'a'.repeat(64),resetAvailable:true};
  if(p.startsWith('/api/auth/children')){
    const method=event.params.request.method,input=event.params.request.postData?JSON.parse(event.params.request.postData):undefined;
    childRequests.push({path:p,search:url.search,method});
    if(!user){status=401;body={error:{code:'UNAUTHENTICATED'}};}
    else if(childFail){status=503;body={error:{code:'AUTH_UNAVAILABLE',message:'DO NOT DISPLAY PRIVATE DATA'}};}
    else if(p==='/api/auth/children/options')body={data:{regions:[{slug:'test-region',name:'SOURCE original region'}],categories:[{slug:'test-support',name:'SOURCE original category'}]}};
    else if(p==='/api/auth/children'&&method==='GET'){if(childDelay)await new Promise(resolve=>setTimeout(resolve,childDelay));body={data:children};}
    else if(p==='/api/auth/children'&&method==='POST'){status=201;const c={...input,id:'44444444-4444-4444-8444-'+String(childSequence++).padStart(12,'0'),version:1};children.push(c);body={data:c};}
    else{
      const parts=p.split('/'),index=children.findIndex(c=>c.id===parts[4]),c=children[index];
      if(!c){status=404;body={error:{code:'NOT_FOUND'}};}
      else if(method==='GET'&&parts[5]==='recommendations'){
        const candidate={...program,eligibilityComplete:true,ageMin:5,ageMax:12,deadline:'2099-01-01'};
        body=page(childRecommendationsEmpty?[]:[{...candidate,matching:evaluateMatch(candidate,{age:c.age,region:c.region})}]);
      }
      else if(input?.version!==c.version){status=409;body={error:{code:'CHILD_CONFLICT'}};}
      else if(method==='PATCH'){children[index]={...c,...input,version:c.version+1};body={data:children[index]};}
      else if(method==='DELETE'&&input.confirm){children.splice(index,1);status=204;}
      else {status=400;body={error:{code:'VALIDATION_ERROR'}};}
    }
  }
  else if(p==='/api/auth/session')body={data:session};
  else if(p==='/api/auth/profile')body={data:{id,email:'test@example.com',language:'kk',fullName:'TEST parent',location:'TEST city',savedCount:empty?0:1}};
  else if(p==='/api/auth/saved-programs/status')body={data:[id]};
  else if(p==='/api/auth/saved-programs')body=page(empty?[]:[program]);
  else if(p==='/api/admin/session')body={data:{authenticated:admin,admin:admin?{id}:null,csrfToken:'b'.repeat(64)}};
  else if(p==='/api/admin/access')body={data:{id,role:'admin',permissions:['programs:read','programs:draft:write','programs:review','programs:publish']}};
  else if(p==='/api/admin/programs/taxonomy')body={data:{categories:noCategories?[]:taxonomy,regions:[{slug:'test-region',name:'SOURCE original region'}],familyCategories:[]}};
  else if(p==='/api/admin/programs'){
    if(url.searchParams.has('lang'))failures.push('UI locale leaked into admin API query');
    body=page([privateProgram]);
  }
  else if(p.startsWith('/api/admin/programs/'))body={data:{...privateProgram,status:programStatus,createdBy:programStatus==='review'?'22222222-2222-4222-8222-222222222222':id,reviewedBy:programStatus==='verified'?'22222222-2222-4222-8222-222222222222':null}};
  else if(p==='/api/contact-messages'){status=201;body={data:{id}};}
  else if(p==='/api/family-categories')body=page([{id:'1',slug:'test-need',name:'SOURCE original need'}]);
  else if(p==='/api/categories')body=page(taxonomy);
  else if(p==='/api/regions')body=page([{id:'1',slug:'test-region',name:'SOURCE original region'}]);
  else if(p==='/api/programs'||p==='/api/program-matches'){
    if(fail){status=503;body={error:{code:'UNAVAILABLE',message:'DO NOT DISPLAY RAW SERVER MESSAGE'}};}
    else body=page(empty?[]:[p==='/api/program-matches'?matchedProgram(url):program]);
  }
  else if((p==='/api/programs/'+id||p==='/api/program-matches/'+id))body={data:p==='/api/program-matches/'+id?matchedProgram(url):program};
  else {status=404;body={error:{code:'NOT_FOUND'}};}
  await browser.send('Fetch.fulfillRequest',{requestId:event.params.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],...(status===204?{}:{body:Buffer.from(JSON.stringify(body)).toString('base64')})});
};
browser.onEvent(event=>{if(event.method==='Fetch.requestPaused')void intercept(event).catch(error=>failures.push(error.message));});
const routes=[
  ['/', 'm267'],['/find','m178'],['/results','m195'],['/program/'+id,'SOURCE original title'],['/favorites','m231'],['/contact','m243'],['/not-found','m170'],
  ['/login','login'],['/register','register'],['/forgot-password','reset'],['/reset-password','reset'],
  ['/profile','account'],['/profile/saved','savedTitle'],['/profile/children','m335'],
  ['/admin','m012'],['/admin/login','m024'],['/admin/programs','m012'],['/admin/programs/new','m015'],['/admin/programs/'+id,'SOURCE original title'],['/admin/programs/'+id+'/edit','m117'],['/admin/not-found','m020'],
];
function heading(key,language){return authText[language][key]??tr(key,{},language);}
async function expectPage(key,language){
  const title=heading(key,language);
  await browser.until(`document.querySelector('h1')?.textContent.trim()===${JSON.stringify(title)}`);
  await browser.until(`document.documentElement.lang===${JSON.stringify(language)}`);
  assert.equal(await browser.evaluate("document.querySelectorAll('.language-trigger').length"),1);
  assert.equal(await browser.evaluate("document.querySelectorAll('.account-language').length"),0);
  assert.equal(await browser.evaluate("document.querySelector('.language-trigger').textContent.trim()"),language==='ru'?'РУС':'ҚАЗ');
  assert.equal(await browser.evaluate("/\\bm\\d{3}\\b/.test(document.body.innerText)"),false,'No untranslated dictionary keys');
  const own=new Set([...Object.values(language==='ru'?ru:kk),...Object.values(authText[language])]);
  const wrong=new Set([...Object.values(language==='ru'?kk:ru),...Object.values(authText[language==='ru'?'kk':'ru'])].filter(value=>!own.has(value)));
  const visible=await browser.evaluate(`(()=>{const values=[];const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walk.nextNode()){const n=walk.currentNode;if(n.parentElement?.checkVisibility()&&!n.parentElement.closest('script,style'))values.push(n.textContent.trim());}for(const el of document.querySelectorAll('[aria-label],[placeholder],[alt]'))if(el.checkVisibility())for(const a of ['aria-label','placeholder','alt'])if(el.hasAttribute(a))values.push(el.getAttribute(a));return values;})()`);
  assert.deepEqual(visible.filter(value=>wrong.has(value)),[],'All visible dictionary text / accessible labels use '+language);
}
async function choose(language){
  await browser.evaluate("document.querySelector('.language-trigger').click()");
  await browser.until("!!document.querySelector('[role=menuitemradio]')");
  await browser.evaluate(`document.querySelector('[role=menuitemradio][lang="${language}"]').click()`);
}
try{
  for(const [route,key] of routes){
    user=route.startsWith('/profile');admin=(route==='/admin'||route.startsWith('/admin/'))&&route!=='/admin/login';
    for(const language of ['kk','ru']){
      await browser.navigate(origin+route+'?lang='+language+(route==='/reset-password'?'#token='+'c'.repeat(64):''));
      await expectPage(key,language);
      if(route==='/contact'||route==='/admin/programs/new'){
        await browser.evaluate("document.querySelector('main form').requestSubmit()");
        await browser.until("!!document.querySelector('[role=alert]')");
      }
      const draftSelector=route==='/find'?'input[name=q]':route==='/admin/programs'?'#admin-search':route==='/results'?'.discovery-search input[name=q]':null;
      if(draftSelector)await browser.setValue(draftSelector,'TEST unsent draft');
      // Switch in place, check the same route, then restore. No page reload is used.
      const opposite=language==='kk'?'ru':'kk';
      await choose(opposite);await expectPage(key,opposite);
      if(draftSelector)assert.equal(await browser.evaluate(`document.querySelector(${JSON.stringify(draftSelector)}).value`),'TEST unsent draft','Language switching preserves unsent form input');
      await choose(language);await expectPage(key,language);
      const previous=await browser.evaluate('performance.timeOrigin');
      await browser.send('Page.reload');await browser.until('performance.timeOrigin!=='+previous);await expectPage(key,language);
      await browser.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
      assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false,route+' '+language+' mobile overflow');
      await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
      if(route.includes('/program/')||(route.startsWith('/admin/programs/')&&route!=='/admin/programs/new')){
        assert.equal(await browser.evaluate("document.body.innerText.includes('SOURCE original title')||!!document.querySelector('input[value=\"SOURCE original title\"]')"),true);
      }
      count++;console.log('PASS '+count+': '+route+' '+language+' / switch / refresh');
    }
  }
  // Follow an internal link lacking lang and retain the current locale.
  user=false;admin=false;
  await browser.navigate(origin+'/?lang=ru');await expectPage('m267','ru');
  await browser.evaluate("document.querySelector('footer a[href=\"/contact\"]').click()");
  await expectPage('m243','ru');
  assert.equal(await browser.evaluate("new URLSearchParams(location.search).get('lang')"),'ru');
  count++;console.log('PASS '+count+': internal navigation retains locale');
  for(const language of ['kk','ru']){
    empty=true;await browser.navigate(origin+'/results?lang='+language);await expectPage('m195',language);
    await browser.until("!!document.querySelector('.empty')");
    empty=false;fail=true;await browser.navigate(origin+'/results?lang='+language);await expectPage('m195',language);
    await browser.until("!!document.querySelector('[role=alert]')");
    assert.equal(await browser.evaluate("document.body.innerText.includes('DO NOT DISPLAY RAW SERVER MESSAGE')"),false);
    fail=false;count++;console.log('PASS '+count+': '+language+' localized empty / safe error');
    await browser.navigate(origin+'/contact?lang='+language);await expectPage('m243',language);
    await browser.setValue('#contact-senderName','TEST parent');await browser.setValue('#contact-email','test@example.com');await browser.setValue('#contact-message','TEST message');
    await browser.evaluate("document.querySelector('main form').requestSubmit()");
    await browser.until("!!document.querySelector('.is-success')");
    await choose(language==='kk'?'ru':'kk');await expectPage('m243',language==='kk'?'ru':'kk');
    count++;console.log('PASS '+count+': '+language+' contact success relocalizes');
    user=true;empty=true;await browser.navigate(origin+'/profile/saved?lang='+language);await expectPage('savedTitle',language);
    await browser.until(`document.body.innerText.includes(${JSON.stringify(authText[language].savedEmpty)})`);
    empty=false;user=false;count++;console.log('PASS '+count+': '+language+' saved programs empty');
    admin=true;noCategories=true;await browser.navigate(origin+'/admin/programs/new?lang='+language);await expectPage('m015',language);
    await browser.until(`document.body.innerText.includes(${JSON.stringify(tr('m305',{},language))})`);
    noCategories=false;count++;console.log('PASS '+count+': '+language+' unavailable admin taxonomy');
    for(const [status,actionKey]of [['draft','m140'],['review','m141'],['verified','m143'],['published','m144']]){
      programStatus=status;await browser.navigate(origin+'/admin/programs/'+id+'?lang='+language);await expectPage('SOURCE original title',language);
      await browser.button(tr(actionKey,{},language));await browser.until("!!document.querySelector('.admin-confirm')");
      await choose(language==='kk'?'ru':'kk');await expectPage('SOURCE original title',language==='kk'?'ru':'kk');
      assert.equal(await browser.evaluate("document.querySelector('#admin-confirm-heading').textContent.trim()"),tr(actionKey,{},language==='kk'?'ru':'kk'));
      count++;console.log('PASS '+count+': '+language+' '+status+' confirmation relocalizes');
    }
    programStatus='draft';admin=false;
  }
  assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);
  for(const language of ['kk','ru']){
    user=false;admin=false;
    await browser.navigate(origin+'/find?lang='+language);await expectPage('m178',language);
    await browser.until("!!document.querySelector('select[name=need] option[value=\"test-need\"]')");
    await browser.setValue('input[name=age]','6');await browser.setValue('select[name=region]','test-region');await browser.setValue('select[name=category]','test-support');await browser.setValue('select[name=need]','test-need');
    await browser.evaluate("document.querySelector('.search-form').requestSubmit()");
    await browser.until("location.pathname==='/results'&&!!document.querySelector('.matching-match')");
    assert.equal(await browser.evaluate("new URLSearchParams(location.search).get('matching')"),'1');
    await expectPage('m195',language);
    await browser.evaluate("document.querySelector('.program-card h2 a').click()");
    await browser.until("location.pathname.startsWith('/program/')&&!!document.querySelector('.matching-match')");
    await expectPage('SOURCE original title',language);
    for(const key of ['m310','m313','m316','m326'])assert.equal(await browser.evaluate(`document.body.innerText.includes(${JSON.stringify(tr(key,{},language))})`),true);
    assert.equal(await browser.evaluate("new URLSearchParams(location.search).get('need')"),'test-need');
    await choose(language==='kk'?'ru':'kk');await expectPage('SOURCE original title',language==='kk'?'ru':'kk');
    count++;console.log('PASS '+count+': '+language+' anonymous combined matching search, details, source and translated reasons');
    await browser.navigate(origin+'/results?matching=1&age=4&region=other&need=other&lang='+language);await expectPage('m195',language);
    await browser.until("!!document.querySelector('.matching-not_match')");
    await browser.evaluate("document.querySelector('.matching-summary details').open=true");
    for(const key of ['m311','m314','m317'])assert.equal(await browser.evaluate(`document.body.innerText.includes(${JSON.stringify(tr(key,{},language))})`),true);
    await browser.send('Page.reload');await browser.until("!!document.querySelector('.matching-not_match')");
    count++;console.log('PASS '+count+': '+language+' incompatible filters remain explicit and persist after refresh');
  }
  assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);
  for(const language of ['kk','ru']){
    children=[];user=true;admin=false;childRequests.length=0;childDelay=450;
    await browser.navigate(origin+'/profile/children?lang='+language);await expectPage('m335',language);
    await browser.until(`document.body.innerText.includes(${JSON.stringify(tr('m280',{},language))})`);
    await browser.until(`document.body.innerText.includes(${JSON.stringify(tr('m350',{},language))})`);childDelay=0;
    await browser.button(tr('m337',{},language));await browser.until("!!document.querySelector('#child-age')");
    await browser.setValue('#child-age','18');await browser.evaluate("document.querySelector('.child-editor form').requestSubmit()");
    await browser.until(`document.body.innerText.includes(${JSON.stringify(authText[language].childInvalid)})`);
    assert.equal(childRequests.filter(r=>r.method==='POST').length,0,'invalid form never sends a mutation');
    await browser.setValue('#child-nickname','TEST nickname');await browser.setValue('#child-age','6');await browser.setValue('#child-region','test-region');
    await browser.evaluate("document.querySelector('.child-preferences input').click()");
    await choose(language==='kk'?'ru':'kk');await expectPage('m335',language==='kk'?'ru':'kk');
    assert.equal(await browser.evaluate("document.querySelector('#child-nickname').value"),'TEST nickname');await choose(language);
    await browser.evaluate("document.querySelector('.child-editor form').requestSubmit()");await browser.until("document.querySelectorAll('.child-card').length===1&&!document.querySelector('.child-editor')");
    await browser.button(tr('m337',{},language));await browser.until("!!document.querySelector('#child-age')");await browser.setValue('#child-age','0');await browser.setValue('#child-region','test-region');
    await browser.evaluate("document.querySelector('.child-editor form').requestSubmit()");await browser.until("document.querySelectorAll('.child-card').length===2&&!document.querySelector('.child-editor')");
    count++;console.log('PASS '+count+': '+language+' child loading, empty, validation, multiple profiles and locale-preserved draft');
    await browser.button(tr('m345',{},language));await browser.until("!!document.querySelector('#child-age')");await browser.setValue('#child-age','8');
    await browser.evaluate("document.querySelector('.child-editor form').requestSubmit()");await browser.until("!document.querySelector('.child-editor')&&document.querySelectorAll('.child-card').length===2");assert.equal(children[0].age,8);
    await browser.button(tr('m346',{},language));await browser.until("!!document.querySelector('[role=alertdialog]')");
    assert.equal(childRequests.filter(r=>r.method==='DELETE').length,0);assert.equal(await browser.evaluate("document.activeElement.id"),'child-confirm-title');
    await browser.button(tr('m344',{},language));await browser.until("!document.querySelector('[role=alertdialog]')");assert.equal(childRequests.filter(r=>r.method==='DELETE').length,0);
    await browser.button(tr('m346',{},language));await browser.button(tr('m349',{},language));await browser.until("document.querySelectorAll('.child-card').length===1&&!document.querySelector('[role=alertdialog]')");
    assert.equal(childRequests.filter(r=>r.method==='DELETE').length,1);
    count++;console.log('PASS '+count+': '+language+' child editing and explicit keyboard-accessible deletion confirmation');
    await browser.button(tr('m353',{},language));await browser.until("!!document.querySelector('.child-recommendations .matching-not_match')");
    assert.equal(await browser.evaluate("location.pathname+location.search"),'/profile/children?lang='+language);
    const rec=childRequests.find(r=>r.path.endsWith('/recommendations'));
    assert.deepEqual([...new URLSearchParams(rec.search).keys()].sort(),['limit','page']);
    await browser.button(tr('m362',{},language));childRecommendationsEmpty=true;
    await browser.button(tr('m353',{},language));await browser.until(`document.body.innerText.includes(${JSON.stringify(tr('m355',{},language))})`);
    childRecommendationsEmpty=false;
    for(const width of [320,375,768,1024,1440]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
      assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false,'child page fits '+width);
    }
    count++;console.log('PASS '+count+': '+language+' private recommendations, empty state, no child facts in URL and five responsive widths');
    childFail=true;await browser.navigate(origin+'/profile/children?lang='+language);await expectPage('m335',language);await browser.until("!!document.querySelector('[role=alert]')");
    assert.equal(await browser.evaluate("document.body.innerText.includes('DO NOT DISPLAY PRIVATE DATA')"),false);
    childFail=false;await browser.button(tr('m298',{},language));await browser.until("!!document.querySelector('.child-card')");
    user=false;await browser.button(tr('m353',{},language));await browser.until("location.pathname==='/login'&&!document.querySelector('.child-card')");
    await browser.until(`document.body.innerText.includes(${JSON.stringify(authText[language].expired)})`);
    await browser.button(authText[language].retry);await browser.until("!!document.querySelector('#user-email')");
    assert.equal(await browser.evaluate("!!document.querySelector('.child-card')"),false);
    count++;console.log('PASS '+count+': '+language+' safe child errors/retry and session-expiry redirect clear private content');
  }
  assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);
  console.log('Localization browser: '+count+'/'+count+' PASS; API fixtures only, no database access.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
