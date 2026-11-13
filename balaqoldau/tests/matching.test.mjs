import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingContext,matchCodes} from '../src/api/matching.ts';
import {createApi,parseProgram} from '../src/api/client.ts';
import {updateFilters,resultsUrl} from '../src/api/navigation.ts';
import {tr} from '../src/i18n/ui.ts';
const id='11111111-1111-4111-8111-111111111111';
const program={id,slug:'test',category:'test',title:'SOURCE original',description:'SOURCE original requirements',sourceName:'SOURCE',sourceUrl:'https://example.com/test',verifiedAt:'2026-11-13T00:00:00Z',ageMin:0,ageMax:17,deadline:null,applyUrl:null,isDemo:false,regions:['test-region'],familyCategories:[]};
test('matching transport remains anonymous, bounded by API validation and never sends locale/profile data',async()=>{
  const requests=[],client=createApi('/api',async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(url.includes('/'+id)?{data:program}:{data:[program],pagination:{page:1,limit:20,total:1,totalPages:1}}));});
  await client.matches('matching=1&age=0&region=test-region&need=test-need&category=test&q=TEST&lang=ru&userId=secret&page=1');
  await client.match(id,'age=0&region=test-region&need=test-need&lang=ru&returnTo=private');
  for(const {url,options}of requests){assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.ok(!url.includes('secret'));assert.ok(!url.includes('lang='));assert.ok(url.includes('age=0'));assert.ok(url.includes('need=test-need'));}
  assert.equal(matchingContext(new URLSearchParams('lang=ru&age=0&region=test-region&need=test-need')),'age=0&region=test-region&need=test-need');
});
test('matching filters survive pagination; reset is explicit and details context contains no free text',()=>{
  const url=resultsUrl({matching:'1',need:'test',age:'0',q:'TEST'});assert.ok(url.includes('matching=1'));assert.ok(url.includes('age=0'));
  const params=updateFilters(new URLSearchParams(url.split('?')[1]),{page:'2'});assert.equal(params.get('need'),'test');assert.equal(params.get('page'),'2');
  assert.equal(matchingContext(new URLSearchParams('q=private&age=0')),'age=0');
});
test('matching payload rejects unknown codes, contradictory classifications, duplicate checks and private records',()=>{
  const matching={status:'POSSIBLE',checks:[{code:'RULES_UNVERIFIED',result:'missing'}]};assert.deepEqual(parseProgram({...program,matching}).matching,matching);
  for(const value of [{status:'MATCH',checks:matching.checks},{status:'POSSIBLE',checks:[]},{status:'POSSIBLE',checks:[{code:'raw server message',result:'missing'}]},{...matching,checks:[...matching.checks,...matching.checks]}])assert.throws(()=>parseProgram({...program,matching:value}));
  assert.throws(()=>parseProgram({...program,isDemo:true,matching}));
});
test('all matching explanation codes and status labels have distinct KZ/RU text without translating source data',()=>{
  assert.equal(matchCodes.length,13);
  for(let i=306;i<=334;i++){assert.notEqual(tr('m'+i,{},'kk'),tr('m'+i,{},'ru'));assert.ok(!tr('m'+i,{},'ru').startsWith('m'+i));}
  assert.equal(parseProgram(program).description,'SOURCE original requirements');
});
