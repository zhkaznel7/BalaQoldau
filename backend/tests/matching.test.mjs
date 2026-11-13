import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMatch,compareMatches} from '../dist/matching/engine.js';
import {regionSlugs} from '../../balaqoldau/src/api/reference-data.ts';
const p={id:'b',ageMin:5,ageMax:12,regions:['test-region'],familyCategories:['test-need'],eligibilityComplete:true,verifiedAt:'2026-01-01',sourceUrl:'https://example.com/test',sourceName:'TEST',deadline:'2099-01-01',isDemo:false};
const input={age:8,region:'test-region',need:'test-need'};
test('verified complete requirements produce MATCH, not official approval',()=>{
  const match=evaluateMatch(p,input,'2026-11-13');assert.equal(match.status,'MATCH');assert.ok(match.checks.every(c=>c.result==='satisfied'));
});
test('missing user age/region/need remains POSSIBLE',()=>{assert.equal(evaluateMatch(p,{},'2026-11-13').status,'POSSIBLE');});
test('nationwide uses explicit region membership; neutral needs never certify unknown rules',()=>{
  for(const region of regionSlugs){
    const program={...p,regions:[...regionSlugs],familyCategories:['education-support']};
    assert.equal(evaluateMatch(program,{age:8,region,need:'education-support'}).status,'MATCH');
    assert.equal(evaluateMatch({...program,eligibilityComplete:false},{age:8,region,need:'education-support'}).status,'POSSIBLE');
    assert.equal(evaluateMatch(program,{age:8,region}).status,'POSSIBLE');
  }
});
test('legacy/default/incomplete/unverified requirements never establish eligibility',()=>{
  for(const extra of [{eligibilityComplete:false},{verifiedAt:null},{regions:[]},{ageMin:13,ageMax:5},{sourceUrl:null}])assert.equal(evaluateMatch({...p,...extra},input,'2026-11-13').status,'POSSIBLE');
});
test('inclusive ages and incompatible regions/needs give explicit reasons',()=>{
  for(const age of [5,12])assert.equal(evaluateMatch(p,{...input,age},'2026-11-13').status,'MATCH');
  for(const value of [{age:4},{age:13},{region:'other'},{need:'other'}])assert.equal(evaluateMatch(p,{...input,...value},'2026-11-13').status,'NOT_MATCH');
});
test('missing information never hides a verified mandatory contradiction',()=>{assert.equal(evaluateMatch(p,{age:4},'2026-11-13').status,'NOT_MATCH');});
test('expired deadline does not imply availability; today is inclusive',()=>{
  assert.equal(evaluateMatch({...p,deadline:'2026-11-12'},input,'2026-11-13').status,'NOT_MATCH');
  assert.equal(evaluateMatch({...p,deadline:'2026-11-13'},input,'2026-11-13').status,'MATCH');
});
test('empty family categories are unrestricted only with complete reviewed requirements',()=>{assert.equal(evaluateMatch({...p,familyCategories:[]},{age:8,region:'test-region'},'2026-11-13').status,'MATCH');});
test('ranking is deterministic and uses ID as final tie breaker',()=>{
  const a={...p,id:'a'},b={...p,id:'b'},possible={...p,id:'c',eligibilityComplete:false};
  assert.deepEqual([b,possible,a].sort((x,y)=>compareMatches(x,y,input,'2026-11-13')).map(v=>v.id),['a','b','c']);
});
