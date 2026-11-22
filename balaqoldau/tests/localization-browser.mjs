// Built frontend, owned Chrome, API fixtures only: no database or external services.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {serveBuiltSite} from './helpers/built-site.mjs';
import {adminBrowser} from './helpers/admin-browser.mjs';
import {tr} from '../src/i18n/ui.ts';
import {authText} from '../src/account/translations.ts';
import {kk} from '../src/i18n/kk.ts';
import {ru} from '../src/i18n/ru.ts';
import {regionSlugs} from '../src/api/reference-data.ts';
import {categorySlugs} from '../src/api/categories.ts';
import {evaluateMatch} from '../../backend/dist/matching/engine.js';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const server=await serveBuiltSite(fileURLToPath(new URL('../dist',import.meta.url)),0,1);
const origin='http://127.0.0.1:'+server.address().port;
const browser=await adminBrowser(cwd);
const id='11111111-1111-4111-8111-111111111111';
const program={id,slug:'test-original',title:'SOURCE original title',description:'SOURCE original description',category:'clubs',regions:['test-region'],familyCategories:[],sourceUrl:'https://example.com/test',sourceName:'SOURCE original source',applyUrl:'https://example.com/apply',verifiedAt:'2026-11-11T00:00:00Z',ageMin:0,ageMax:17,deadline:null,isDemo:false};
const privateProgram={...program,status:'draft',version:1,createdBy:id,submittedBy:null,reviewedBy:null};
const taxonomy=[{id:'1',slug:'test-support',name:'SOURCE original category'}];
const publicQueries=[];
const page=data=>({data,pagination:{page:1,limit:20,total:data.length,totalPages:data.length?1:0}});
let user=false,admin=false,empty=false,fail=false,noCategories=false,missingProgramSource=false,programStatus='draft',count=0;
let children=[],childSequence=1,childFail=false,childDelay=0,childRecommendationsEmpty=false;
const childRequests=[];
let reportState='open',reportVersion=1;
let aiState='results';
let catalogSuggestions=false;
let releaseAI;
const aiRequests=[];
const reportId='77777777-7777-4777-8777-777777777777';
const adminQueries=[];
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
    else if(p==='/api/auth/children/options')body={data:{regions:[{slug:'test-region',name:'SOURCE original region'}],categories:[{slug:'clubs',name:'SOURCE original category'},{slug:'demo-example',name:'DEMO fixture'}]}};
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
  else if(p==='/api/ai/suggestions')body={data:catalogSuggestions?[{category:'clubs',age:7,region:'astana'}]:[]};
  else if(p==='/api/ai/recommendations'){
    aiRequests.push({method:event.params.request.method,search:url.search,input:JSON.parse(event.params.request.postData)});
    if(aiState==='results')await new Promise(resolve=>{releaseAI=resolve;});
    if(aiState==='unavailable'){
      status=503;body={error:{code:'AI_UNAVAILABLE',message:'DO NOT DISPLAY RAW SERVER MESSAGE'}};
    }else if(aiState==='error'){
      status=500;body={error:{message:'DO NOT DISPLAY RAW SERVER MESSAGE'}};
    }else if(aiState==='followUp'){
      const input=aiRequests.at(-1).input;
      const intent={category:'clubs',age:input.query==='8'?8:7,region:input.context?.region??null,need:null};
      body={intent,data:[],followUp:null};
    }else{
      const russian=aiRequests.at(-1).input.query.startsWith('Какие пособия');
      const intent=aiState==='clarify'?{age:null,region:null,need:null,category:null}:
        russian?{age:0,region:null,need:null,category:'benefits'}:
          {age:null,region:'almaty-city',need:null,category:'clubs'};
      const confirmed={...matchedProgram(new URL('?age=7&region=test-region&need=test-need',origin)),category:intent.category};
      const possible={...confirmed,id:'22222222-2222-4222-8222-222222222222',matching:{
        status:'POSSIBLE',checks:[{code:'RULES_UNVERIFIED',result:'missing'}],
      }};
      body={intent,data:aiState==='results'?[confirmed,possible]:[]};
    }
  }
  else if(p==='/api/auth/session')body={data:session};
  else if(p==='/api/auth/profile')body={data:{id,email:'test@example.com',language:'kk',fullName:'TEST parent',location:'TEST city',savedCount:empty?0:1}};
  else if(p==='/api/auth/saved-programs/status')body={data:[id]};
  else if(p==='/api/auth/saved-programs')body=page(empty?[]:[program]);
  else if(p==='/api/admin/session')body={data:{authenticated:admin,admin:admin?{id}:null,csrfToken:'b'.repeat(64)}};
  else if(p==='/api/admin/access')body={data:{id,role:'admin',permissions:['programs:read','programs:draft:write','programs:review','programs:publish']}};
  else if(p==='/api/admin/programs/taxonomy')body={data:{categories:noCategories?[]:[...taxonomy,...categorySlugs.map((slug,i)=>({slug,name:tr('m'+(418+i),{},'kk')}))],regions:[{slug:'test-region',name:'SOURCE original region'},...regionSlugs.map((slug,i)=>({slug,name:tr('m'+(422+i),{},'kk')}))],familyCategories:['education-support','creative-development','sports-activities'].map((slug,i)=>({slug,name:tr('m'+(442+i),{},'kk')}))}};
  else if(p==='/api/admin/programs/dashboard')body={data:{counts:{total:1,draft:1,review:0,verified:0,published:0,rejected:0,archived:0,needsReverification:0,expired:0},recent:[{id,title:program.title,status:'draft',version:1,updatedAt:'2026-11-13T00:00:00Z'}],reviewPeriodDays:180}};
  else if(p==='/api/admin/programs/'+id+'/history')body=page([{id:reportId,actorId:id,programVersion:1,decision:'approve',notes:'TEST internal verification note',createdAt:'2026-11-13T00:00:00Z',sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true}]);
  else if(p==='/api/admin/reports')body=page([{id:reportId,programId:id,programTitle:program.title,reason:'outdated',explanation:'TEST report <img src=x onerror=alert(1)>',status:reportState,version:reportVersion,createdAt:'2026-11-13T00:00:00Z'}]);
  else if(p==='/api/admin/reports/'+reportId){const input=JSON.parse(event.params.request.postData);reportState=input.status;reportVersion++;body={data:{id:reportId,status:reportState,version:reportVersion}};}
  else if(p==='/api/admin/programs'){
    adminQueries.push(url.search);
    if(url.searchParams.has('lang'))failures.push('UI locale leaked into admin API query');
    body=page([privateProgram]);
  }
  else if(p.startsWith('/api/admin/programs/'))body={data:{...privateProgram,sourceUrl:missingProgramSource?null:privateProgram.sourceUrl,status:programStatus,createdBy:programStatus==='review'?'22222222-2222-4222-8222-222222222222':id,reviewedBy:programStatus==='verified'?'22222222-2222-4222-8222-222222222222':null}};
  else if(p==='/api/programs/'+id+'/reports'){status=202;body={data:{accepted:true}};}
  else if(p==='/api/contact-messages'){status=201;body={data:{id}};}
  else if(p==='/api/family-categories')body=page([{id:'1',slug:'test-need',name:'SOURCE original need'},
    {id:'2',slug:'sports-activities',name:'SOURCE sport'},{id:'3',slug:'education-support',name:'SOURCE education'}]);
  else if(p==='/api/categories')body=page(taxonomy);
  else if(p==='/api/regions')body=page([{id:'1',slug:'test-region',name:'SOURCE original region'}]);
  else if(p==='/api/programs'||p==='/api/program-matches'){
    publicQueries.push(url.search);
    if(fail){status=503;body={error:{code:'UNAVAILABLE',message:'DO NOT DISPLAY RAW SERVER MESSAGE'}};}
    else body=page(empty?[]:[p==='/api/program-matches'?matchedProgram(url):program]);
  }
  else if((p==='/api/programs/'+id||p==='/api/program-matches/'+id))body={data:p==='/api/program-matches/'+id?matchedProgram(url):program};
  else {status=404;body={error:{code:'NOT_FOUND'}};}
  await browser.send('Fetch.fulfillRequest',{requestId:event.params.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],...(status===204?{}:{body:Buffer.from(JSON.stringify(body)).toString('base64')})});
};
browser.onEvent(event=>{if(event.method==='Fetch.requestPaused')void intercept(event).catch(error=>failures.push(error.message));});
const routes=[
  ['/', 'm267'],['/find','m178'],['/ai-assistant','aiTitle'],['/results','m195'],['/program/'+id,'SOURCE original title'],['/favorites','m231'],['/contact','m243'],['/not-found','m170'],
  ['/login','login'],['/register','register'],['/forgot-password','reset'],['/reset-password','reset'],
  ['/profile','account'],['/profile/saved','savedTitle'],['/profile/children','m335'],
  ['/admin','m012'],['/admin/login','m024'],['/admin/overview','m368'],['/admin/reports','m392'],['/admin/programs','m012'],['/admin/programs/new','m015'],['/admin/programs/'+id,'SOURCE original title'],['/admin/programs/'+id+'/edit','m117'],['/admin/not-found','m020'],
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
      const draftSelector=route==='/find'?'input[name=q]':route==='/ai-assistant'?'.ai-composer textarea':route==='/admin/programs'?'#admin-search':route==='/results'?'.discovery-search input[name=q]':null;
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
    programStatus='draft';missingProgramSource=true;
    await browser.navigate(origin+'/admin/programs/'+id+'?lang='+language);
    await expectPage('SOURCE original title',language);
    const submit=JSON.stringify(tr('m140',{},language));
    const submitAvailable=`[...document.querySelectorAll('.admin-actions button')].some(button=>button.textContent.trim()===${submit}&&!button.disabled)`;
    assert.equal(await browser.evaluate("document.querySelector('#admin-submit-blocker').textContent"),tr('adminSubmitMissingSourceUrl',{},language));
    assert.equal(await browser.evaluate("document.querySelector('.admin-page-heading a').pathname"),'/admin/programs/'+id+'/edit');
    assert.equal(await browser.evaluate(submitAvailable),false);
    missingProgramSource=false;
    await browser.button(tr('m096',{},language));
    await browser.until(submitAvailable);
    assert.equal(await browser.evaluate("!!document.querySelector('#admin-submit-blocker')"),false);
    count++;console.log('PASS '+count+': '+language+' missing draft source guidance and restored submit action');
    for(const [status,actionKey]of [['draft','m140'],['review','m141'],['verified','m143'],['published','m144'],['published','m365'],['published','m367'],['rejected','m366'],['archived','m366']]){
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
    assert.equal(await browser.evaluate("!!document.querySelector('.recommendation-assistant')"),false);
    await browser.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
    await browser.evaluate("document.querySelector('.mobile-toggle').click()");
    const navLink='#primary-navigation a[href^="/ai-assistant"]';
    assert.equal(await browser.evaluate(`document.querySelector(${JSON.stringify(navLink)}).textContent.trim()`),tr('aiTitle',{},language));
    await browser.evaluate(`document.querySelector(${JSON.stringify(navLink)}).click()`);
    await expectPage('aiTitle',language);
    assert.equal(await browser.evaluate("document.querySelector('.mobile-toggle').getAttribute('aria-expanded')"),'false');
    await browser.send('Emulation.clearDeviceMetricsOverride');
    await browser.navigate(origin+'/?lang='+language);await expectPage('m267',language);
    const cta='main a[href^="/ai-assistant"]';
    assert.equal(await browser.evaluate(`document.querySelector(${JSON.stringify(cta)}).textContent.trim()`),tr('aiSearch',{},language));
    await browser.evaluate(`document.querySelector(${JSON.stringify(cta)}).click()`);
    await expectPage('aiTitle',language);
    await browser.until("location.pathname==='/ai-assistant'");
    assert.equal(await browser.evaluate("document.querySelector('#primary-navigation a[aria-current=page]').pathname"),'/ai-assistant');
    assert.equal(await browser.evaluate("!!document.querySelector('.search-form')"),false);
    assert.ok((await browser.evaluate('document.title')).includes(tr('aiTitle',{},language)));
    assert.equal(await browser.evaluate("document.querySelector('#ai-privacy').textContent"),tr('aiPrivacy',{},language));
    assert.ok(tr('aiPrivacy',{},language).includes(language==='kk'?'машиналық оқыту':'машинного обучения'));
    const query=tr('aiExampleBenefits',{},language);
    const naturalQuestion=language==='ru'?'Какие пособия доступны для ребенка до года?':'Алматыда тегін үйірмелер бар ма?';
    await browser.until("!!document.querySelector('.ai-suggestions button')");
    await browser.evaluate("document.querySelector('.ai-suggestions button').click()");
    assert.equal(await browser.evaluate("document.querySelector('.recommendation-assistant textarea').value"),query);
    assert.equal(await browser.evaluate("document.querySelector('.recommendation-assistant button[type=submit]').disabled"),true);
    await browser.evaluate("document.querySelector('.ai-consent input').click()");
    const states=[['results','aiResults'],['empty','aiEmpty'],['clarify','aiClarify'],['error','m148'],['unavailable','aiUnavailable']];
    for(const [index,[state,key]] of states.entries()){
      aiState=state;
      const question=state==='clarify'?(language==='ru'?'Алматы или Астана?':'Алматы немесе Астана ма?'):naturalQuestion;
      await browser.setValue('.recommendation-assistant textarea',question);
      await browser.evaluate("document.querySelector('.recommendation-assistant form').requestSubmit()");
      if(state==='results'){
        for(let attempt=0;!releaseAI&&attempt<100;attempt++)await new Promise(resolve=>setTimeout(resolve,20));
        await browser.until("!!document.querySelector('.ai-pending')");
        assert.equal(await browser.evaluate("document.querySelector('.recommendation-assistant button[type=submit]').disabled"),true);
        assert.equal(typeof releaseAI,'function');
        releaseAI();
        releaseAI=undefined;
      }
      await browser.until(`document.querySelector('.ai-turn:last-child .ai-reply')?.innerText.includes(${JSON.stringify(tr(key,{},language))})`);
      assert.deepEqual(aiRequests.at(-1),{method:'POST',search:'',input:{query:question,consent:true,context:null}});
      assert.equal(await browser.evaluate("document.querySelectorAll('.ai-turn').length"),index+1);
      const source=await browser.evaluate("document.querySelector('.ai-turn:last-child .ai-programs a[rel=noreferrer]')?.getAttribute('href') ?? null");
      assert.equal(source,state==='results'?'https://example.com/test':null);
      if(state==='results'){
        const category=tr(language==='ru'?'m418':'m421',{},language);
        assert.ok((await browser.evaluate("document.querySelector('.ai-intent').innerText")).includes(category));
        for(const [status,label] of [['match','m306'],['possible','m307']]){
          assert.equal(await browser.evaluate(`document.querySelector('.ai-programs .matching-${status} strong').textContent`),tr(label,{},language));
        }
        assert.equal(await browser.evaluate(`[...document.querySelectorAll('.ai-programs li:has(.matching-possible) > p')].some(p=>p.textContent===${JSON.stringify(tr('aiAgeRange',{0:0,1:17},language))})`),false);
        assert.equal(await browser.evaluate(`document.querySelector('.ai-programs').innerText.includes(${JSON.stringify(tr('programOriginalLanguage',{},language))})`),language==='ru');
        if(language==='kk')assert.ok((await browser.evaluate("document.querySelector('.ai-reply:has(.ai-programs)').innerText")).includes(tr('aiClubFees',{},language)));
      }
    }
    assert.equal(await browser.evaluate("document.querySelector('.ai-programs a[href^=\"/program/\"]').pathname"),'/program/'+id);
    assert.equal(await browser.evaluate("!!document.querySelector('.ai-programs .matching-summary details[open]')"),true);
    for(const width of [320,375,768,1024,1440]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
      assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false,'chat fits '+width);
    }
    await browser.send('Emulation.clearDeviceMetricsOverride');
    assert.equal(await browser.evaluate("document.body.innerText.includes('DO NOT DISPLAY RAW SERVER MESSAGE')"),false);
    await browser.evaluate("document.querySelector('.ai-turn:last-child .ai-reply a').click()");
    await expectPage('m178',language);
    assert.equal(await browser.evaluate('location.pathname'),'/find');
    assert.equal(await browser.evaluate("!!document.querySelector('.recommendation-assistant')"),false);
    count++;console.log('PASS '+count+': '+language+' chat suggestions, consent, history, sourced matches, errors and manual fallback');
    await browser.until("!!document.querySelector('select[name=need] option[value=\"test-need\"]')");
    await browser.setValue('input[name=age]','6');await browser.setValue('select[name=region]','test-region');await browser.setValue('select[name=category]','clubs');await browser.setValue('select[name=need]','test-need');
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
  catalogSuggestions=true;
  program.translationRu={title:'Название программы RU',description:'Описание программы RU'};
  for(const language of ['kk','ru']){
    await browser.navigate(origin+'/ai-assistant?lang='+language);await expectPage('aiTitle',language);
    const suggestion=tr('aiCatalogPrompt',{0:tr('m421',{},language),1:7,2:tr('m439',{},language)},language);
    await browser.until(`document.querySelector('.ai-suggestions button')?.textContent===${JSON.stringify(suggestion)}`);
    await browser.button(suggestion);
    assert.equal(await browser.evaluate("document.querySelector('.ai-composer textarea').value"),suggestion);
    aiState='followUp';
    await browser.evaluate("document.querySelector('.ai-consent input').click()");
    await browser.evaluate("document.querySelector('form.ai-composer').requestSubmit()");
    await browser.until("!!document.querySelector('.ai-turn .ai-intent')");
    const expectedContext={category:'clubs',age:7,region:'astana',need:null};
    assert.deepEqual(aiRequests.at(-1).input.context,expectedContext);
    await browser.setValue('.ai-composer textarea','8');
    await browser.evaluate("document.querySelector('form.ai-composer').requestSubmit()");
    await browser.until("document.querySelectorAll('.ai-turn .ai-intent').length===2");
    assert.deepEqual(aiRequests.at(-1).input.context,expectedContext);
    await browser.navigate(origin+'/program/'+id+'?lang='+language);
    await expectPage(language==='ru'?'Название программы RU':'SOURCE original title',language);
    const description=language==='ru'?'Описание программы RU':'SOURCE original description';
    assert.ok((await browser.evaluate("document.querySelector('.details-content').innerText")).includes(description));
    assert.equal(await browser.evaluate("document.querySelector('.details-content a').getAttribute('href')"),program.sourceUrl);
    count++;console.log('PASS '+count+': '+language+' catalog-derived suggestion and localized program details');
  }
  catalogSuggestions=false;
  delete program.translationRu;
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
    await browser.setValue('#child-full-name','TEST Private Name');
    await browser.setValue('#child-gender','female');
    await browser.evaluate("document.querySelector('#child-interest-education').click(); document.querySelector('#child-interest-sports').click()");
    assert.equal(await browser.evaluate("document.querySelector('#child-age').getAttribute('aria-describedby')"),'child-age-hint');
    assert.equal(await browser.evaluate("document.querySelector('.child-private-fields').open"),false);
    await browser.evaluate("document.querySelector('.child-private-fields summary').click()");
    await browser.setValue('#child-disabilitySupportEligible','true');
    await choose(language==='kk'?'ru':'kk');await expectPage('m335',language==='kk'?'ru':'kk');
    assert.equal(await browser.evaluate("document.querySelector('#child-nickname').value"),'TEST nickname');await choose(language);
    await browser.evaluate("document.querySelector('.child-editor form').requestSubmit()");await browser.until("document.querySelectorAll('.child-card').length===1&&!document.querySelector('.child-editor')");
    await browser.button(tr('m337',{},language));await browser.until("!!document.querySelector('#child-age')");await browser.setValue('#child-age','0');await browser.setValue('#child-region','test-region');
    await browser.evaluate("document.querySelector('.child-editor form').requestSubmit()");await browser.until("document.querySelectorAll('.child-card').length===2&&!document.querySelector('.child-editor')");
    count++;console.log('PASS '+count+': '+language+' child loading, empty, validation, multiple profiles and locale-preserved draft');
    assert.equal(children[0].familyContext.disabilitySupportEligible,true);
    const cardText=await browser.evaluate("document.querySelector('.child-card').innerText");
    assert.ok(cardText.includes('TEST Private Name'));
    assert.ok(!cardText.includes(tr('m483',{},language)));
    for(const [width,columns] of [[375,1],[1024,2]]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.child-card-grid')).gridTemplateColumns.split(' ').length"),columns);
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.child-facts')).gridTemplateColumns.split(' ').length"),columns);
      assert.equal(await browser.evaluate("document.querySelector('#child-add').getBoundingClientRect().width<document.querySelector('.child-toolbar').getBoundingClientRect().width"),true);
    }
    await browser.send('Emulation.clearDeviceMetricsOverride');
    const previousAIRequests=aiRequests.length;
    await browser.setValue('.child-card .child-interest-picker select','sports');
    await browser.evaluate("document.querySelector('.child-card .child-find').click()");
    await expectPage('m178',language);
    await browser.until("document.querySelector('select[name=need]')?.value==='sports-activities'");
    assert.equal(await browser.evaluate("document.querySelector('input[name=age]').value"),'6');
    assert.equal(await browser.evaluate("document.querySelector('select[name=region]').value"),'test-region');
    const safeSearch=new URLSearchParams(await browser.evaluate('location.search'));
    assert.deepEqual(Object.fromEntries(safeSearch),{age:'6',region:'test-region',lang:language,need:'sports-activities'});
    assert.equal(aiRequests.length,previousAIRequests);
    await browser.navigate(origin+'/profile/children?lang='+language);
    await expectPage('m335',language);
    await browser.until("document.querySelectorAll('.child-card').length===2");
    count++;console.log('PASS '+count+': '+language+' compact profiles and allowlisted catalog handoff');
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
  for(const language of ['kk','ru']){
    user=false;admin=false;await browser.navigate(origin+'/program/'+id+'?lang='+language);await expectPage('SOURCE original title',language);
    await browser.evaluate("document.querySelector('.program-report').open=true");await browser.setValue('#public-report-reason','outdated');await browser.setValue('#public-report-explanation','TEST report only');
    await browser.evaluate("document.querySelector('.program-report form').requestSubmit()");await browser.until(`document.body.innerText.includes(${JSON.stringify(tr('m405',{},language))})`);
    await choose(language==='kk'?'ru':'kk');await expectPage('SOURCE original title',language==='kk'?'ru':'kk');
    count++;console.log('PASS '+count+': '+language+' anonymous report submission and localized acceptance');
    admin=true;reportState='open';reportVersion=1;await browser.navigate(origin+'/admin/reports?lang='+language);await expectPage('m392',language);await browser.until("!!document.querySelector('.report-list li')");
    assert.equal(await browser.evaluate("!!document.querySelector('.report-list img')"),false,'untrusted report text is escaped');
    await browser.button(tr('m409',{},language));await browser.until(`document.querySelector('.report-list')?.innerText.includes(${JSON.stringify(tr('m395',{},language))})`);
    await browser.button(tr('m410',{},language));await browser.until(`document.querySelector('.report-list')?.innerText.includes(${JSON.stringify(tr('m396',{},language))})`);
    count++;console.log('PASS '+count+': '+language+' report moderation, escaped explanation and state refresh');
    await browser.navigate(origin+'/admin/programs?lang='+language);await expectPage('m012',language);await browser.until("!!document.querySelector('#admin-region option[value=\"test-region\"]')");
    await browser.setValue('#admin-region','test-region');await browser.setValue('#admin-category','test-support');await browser.setValue('#admin-expiration','expired');
    await browser.evaluate("document.querySelector('.admin-filters').requestSubmit()");await browser.until("new URLSearchParams(location.search).get('expiration')==='expired'");
    for(let attempt=0;attempt<100&&!adminQueries.some(q=>new URLSearchParams(q).get('region')==='test-region'&&new URLSearchParams(q).get('category')==='test-support'&&new URLSearchParams(q).get('expiration')==='expired');attempt++)await new Promise(resolve=>setTimeout(resolve,50));
    assert.ok(adminQueries.some(q=>new URLSearchParams(q).get('region')==='test-region'&&new URLSearchParams(q).get('category')==='test-support'&&new URLSearchParams(q).get('expiration')==='expired'));
    count++;console.log('PASS '+count+': '+language+' combined admin taxonomy and expiration filters use API query contract');
  }
  assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);
  // Empty API results must still offer all categories and stable, localized navigation.
  for(const language of ['kk','ru']){
    user=false;admin=false;empty=true;
    await browser.navigate(origin+'/?lang='+language);await expectPage('m267',language);
    for(const [index,slug] of ['benefits','free-courses','grants','clubs'].entries()){
      const label=tr('m'+(418+index),{},language);
      await browser.until(`!!document.querySelector('.service-directions a[href="/results?category=${slug}"]')`);
      await browser.evaluate(`document.querySelector('.service-directions a[href="/results?category=${slug}"]').click()`);
      await expectPage('m195',language);await browser.until("!!document.querySelector('.empty-results')");
      assert.equal(await browser.evaluate("document.querySelector('.discovery-term input').value"),'');
      assert.equal(await browser.evaluate("document.querySelectorAll('.filter-chips button').length"),5);
      assert.equal(await browser.evaluate("document.querySelector('.filter-chips [aria-pressed=true]').textContent"),label);
      assert.ok(publicQueries.some(q=>new URLSearchParams(q).get('category')===slug&&!new URLSearchParams(q).has('q')));
      await browser.evaluate('history.back()');await expectPage('m267',language);
      await browser.evaluate('history.forward()');await expectPage('m195',language);
      assert.equal(await browser.evaluate("new URLSearchParams(location.search).get('category')"),slug);
      await browser.evaluate('history.back()');await expectPage('m267',language);
    }
    count++;console.log('PASS '+count+': '+language+' all category links, empty catalog, actual filter requests and Back/Forward');
    await browser.navigate(origin+'/results?category=benefits&region=test-region&age=7&need=test-need&matching=1&q=manual&lang='+language);
    await expectPage('m195',language);await browser.until("document.querySelector('.discovery-term input')?.value==='manual'");
    await browser.button(tr('m420',{},language));
    for(const [key,value]of Object.entries({category:'grants',region:'test-region',age:'7',need:'test-need',matching:'1',q:'manual'}))assert.equal(await browser.evaluate(`new URLSearchParams(location.search).get(${JSON.stringify(key)})`),value);
    await browser.setValue('.discovery-term input','not submitted');await choose(language==='kk'?'ru':'kk');
    assert.equal(await browser.evaluate("document.querySelector('.discovery-term input').value"),'not submitted');
    assert.equal(await browser.evaluate("document.querySelector('.filter-chips [aria-pressed=true]').textContent"),tr('m420',{},language==='kk'?'ru':'kk'));
    count++;console.log('PASS '+count+': '+language+' direct category URL, combined filters and typed query survive locale switch');
    for(const path of ['/register','/login','/reset-password']){
      await browser.navigate(origin+path+'?lang='+language+(path==='/reset-password'?'#token='+'c'.repeat(64):''));
      await expectPage(path==='/register'?'register':path==='/login'?'login':'reset',language);
      await browser.until("!!document.querySelector('#user-password:not(:disabled)')");
      if(path!=='/reset-password')await browser.setValue('#user-email','test@example.com');
      for(const [password,key]of [['short','passwordShort'],['😀'.repeat(65),'passwordLong']]){
        await browser.setValue('#user-password',password);
        await browser.evaluate("document.querySelector('.account-panel form').requestSubmit()");
        await browser.until(`document.body.innerText.includes(${JSON.stringify(authText[language][key])})`);
        assert.equal(await browser.evaluate("/UTF-8|256/.test(document.querySelector('.account-feedback').innerText)"),false);
      }
    }
    count++;console.log('PASS '+count+': '+language+' friendly password boundaries on login, registration and reset');
  }
  empty=false;
  for(const width of [320,375,768,1024,1440]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await browser.navigate(origin+'/results?lang=ru');await expectPage('m195','ru');
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  }
  await browser.evaluate("document.querySelector('.discovery-term input').focus()");
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await browser.evaluate("document.activeElement.name"),'region');
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.discovery-region')).outlineWidth"),'2px');
  assert.equal(await browser.evaluate("getComputedStyle(document.activeElement).outlineStyle"),'none');
  const rect=await browser.evaluate("(()=>{const r=document.querySelector('.discovery-term input').getBoundingClientRect();return {x:r.x+20,y:r.y+20};})()");
  await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',clickCount:1});
  await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',clickCount:1});
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.discovery-term input')).outlineStyle"),'none');
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.discovery-term')).outlineWidth"),'2px');
  count++;console.log('PASS '+count+': 320-1440px category navigation, keyboard and mouse single-boundary focus');
  assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);
  for(const language of ['kk','ru'])for(const path of ['/admin/programs/new','/admin/programs/'+id+'/edit']){
    admin=true;programStatus='draft';await browser.navigate(origin+path+'?lang='+language);
    await expectPage(path.endsWith('/new')?'m015':'m117',language);await browser.until("!!document.querySelector('#program-regions input[value=astana]')");
    for(let i=0;i<20;i++)assert.equal(await browser.evaluate(`document.querySelector('#program-regions .admin-checks').innerText.includes(${JSON.stringify(tr('m'+(422+i),{},language))})`),true);
    await browser.evaluate("document.querySelector('#program-regions input[value=astana]').click();document.querySelector('#program-familyCategories input[value=\"education-support\"]').click()");
    await browser.setValue('#program-category','benefits');await browser.setValue('#program-title','SOURCE unchanged title');
    await choose(language==='kk'?'ru':'kk');
    assert.equal(await browser.evaluate("document.querySelector('#program-regions input[value=astana]').checked"),true);
    assert.equal(await browser.evaluate("document.querySelector('#program-familyCategories input[value=\"education-support\"]').checked"),true);
    assert.equal(await browser.evaluate("document.querySelector('#program-category').value"),'benefits');
    assert.equal(await browser.evaluate("document.querySelector('#program-title').value"),'SOURCE unchanged title');
    assert.equal(await browser.evaluate("document.querySelector('#program-category option[value=benefits]').textContent"),tr('m418',{},language==='kk'?'ru':'kk'));
    await browser.evaluate("document.querySelector('#program-nationwide').click()");
    assert.equal(await browser.evaluate(`Array.from(document.querySelectorAll('#program-regions .admin-checks input:checked')).filter(el=>${JSON.stringify(regionSlugs)}.includes(el.value)).length`),20);
    await browser.setValue('#program-region-search',tr('m439',{},language==='kk'?'ru':'kk'));
    assert.equal(await browser.evaluate("document.querySelectorAll('#program-regions .admin-checks input').length"),1);
    count++;console.log('PASS '+count+': '+language+' '+path+' all regions, nationwide, search, localized labels and preserved values');
  }
  assert.deepEqual(failures,[]);assert.deepEqual(browser.errors,[]);
  console.log('Localization browser: '+count+'/'+count+' PASS; API fixtures only, no database access.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
