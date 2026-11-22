import test from 'node:test';
import assert from 'node:assert/strict';
import {childOpportunityUrl,normalizeChild,parseChild,parseChildOptions} from '../src/account/children.ts';
import {createUserApi,safeReturnTo,UserAuthError} from '../src/account/api.ts';
import {authText} from '../src/account/translations.ts';
import {tr} from '../src/i18n/ui.ts';
const id='11111111-1111-4111-8111-111111111111',csrf='a'.repeat(64);
const input={nickname:null,age:0,region:'test-region',preferences:['clubs']},child={...input,id,version:1};
test('catalog navigation carries only safe filters and preserves a zero age',()=>{
  const profile={...child,nickname:'Private nickname',fullName:'Private Full Name',gender:'female',
    interests:['sports','creativity'],familyContext:{disabilitySupportEligible:true}};
  const path=new URL(childOpportunityUrl(profile,'ru','creativity'),'https://local.invalid');
  assert.equal(path.pathname,'/find');
  assert.deepEqual(Object.fromEntries(path.searchParams),{
    age:'0',region:'test-region',lang:'ru',need:'creative-development',
  });
  assert.ok(!path.href.includes(id));
  assert.deepEqual(Object.fromEntries(new URL(childOpportunityUrl({...child,preferences:['clubs','benefits']},'kk'),
    'https://local.invalid').searchParams),{age:'0',region:'test-region',lang:'kk'});
});
test('child input minimizes data and enforces completed age, nickname and preference bounds',()=>{
  const value={nickname:'  TEST   nickname ',age:'0',region:'test-region',preferences:['clubs']};assert.deepEqual(normalizeChild(value),{...input,nickname:'TEST nickname'});
  for(const extra of [{age:'18'},{age:'-1'},{age:'1.2'},{age:''},{nickname:'a'.repeat(31)},{nickname:'123456789012'},{nickname:'x\ny'},{region:'unsupported region'},{preferences:['clubs','clubs']},{preferences:Array.from({length:11},(_,i)=>'c-'+i)}])assert.equal(normalizeChild({...value,...extra}),null);
  assert.deepEqual(parseChild({...child,userId:'must not be retained'}),child);
  for(const extra of [{id:'bad'},{age:18},{version:0},{nickname:'a'.repeat(31)},{preferences:['bad slug']}])assert.throws(()=>parseChild({...child,...extra}));
});
test('child taxonomy parsing is bounded and exposes no family-status options',()=>{
  assert.deepEqual(parseChildOptions({regions:[{slug:'test-region',name:'SOURCE region'}],categories:[],familyCategories:['private']}),{regions:[{slug:'test-region',name:'SOURCE region'}],categories:[]});
  assert.throws(()=>parseChildOptions({regions:[{slug:'*',name:'x'}],categories:[]}));
});
test('child CRUD reuses user CSRF/cookies and recommendations never send child facts in URLs',async()=>{
  const requests=[],api=createUserApi(async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/session'))return new Response(JSON.stringify({data:{authenticated:true,user:{id,email:'test@example.com',language:'kk'},csrfToken:csrf,resetAvailable:false}}));
    if(options.method==='DELETE')return new Response(null,{status:204});
    if(url.includes('/recommendations?'))return new Response(JSON.stringify({data:[],pagination:{page:1,limit:20,total:0,totalPages:0}}));
    return new Response(JSON.stringify({data:child}));
  });
  await api.session();await api.createChild(input);await api.updateChild(id,input,1);await api.deleteChild(id,1);const result=await api.childRecommendations(id);assert.deepEqual(result.data,[]);
  for(const {url,options}of requests){assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.ok(!['age','region','nickname','preferences'].some(key=>new URL(url,'https://local.invalid').searchParams.has(key)));assert.ok(!url.includes('clubs'));if(options.method!=='GET')assert.equal(options.headers['X-CSRF-Token'],csrf);if(options.body)assert.equal('userId'in JSON.parse(options.body),false);}
  assert.deepEqual(JSON.parse(requests.find(r=>r.options.method==='DELETE').options.body),{version:1,confirm:true});
  assert.equal(safeReturnTo('/profile/children?lang=ru'),'/profile/children?lang=ru');assert.equal(safeReturnTo('/profile/children/../../admin'),'/profile');
});
test('child errors are localized and never echo server child data; mutations do not retry',async()=>{
  for(const [status,code,key]of [[404,'NOT_FOUND','childMissing'],[409,'CHILD_LIMIT','childLimit'],[409,'CHILD_CONFLICT','childConflict'],[400,'VALIDATION_ERROR','childInvalid']]){
    let calls=0;const api=createUserApi(async()=>{calls++;return new Response(JSON.stringify({error:{code,message:'private nickname'}}),{status});});
    await assert.rejects(api.createChild(input),error=>error instanceof UserAuthError&&error.key===key);assert.equal(calls,1);assert.notEqual(authText.kk[key],authText.ru[key]);
  }
  for(let n=335;n<=362;n++)assert.notEqual(tr('m'+n,{},'kk'),tr('m'+n,{},'ru'));
});
