import test from 'node:test';
import assert from 'node:assert/strict';
import { profileInput, savedStatusQuery } from '../dist/users/dashboard-schemas.js';
import {dashboardRepository} from '../dist/users/dashboard-repository.js';

test('profile normalization is bounded, optional and cannot modify account identity',()=>{
  assert.deepEqual(profileInput.parse({fullName:'  TEST   Parent  ',location:'  TEST city  '}),{fullName:'TEST Parent',location:'TEST city'});
  assert.deepEqual(profileInput.parse({fullName:' ',location:null}),{fullName:null,location:null});
  for(const value of [{email:'other@example.com'},{fullName:'a'.repeat(101)},{location:'bad\u0000value'},{fullName:'ok',userId:'other'}])assert.equal(profileInput.safeParse(value).success,false);
});
test('dashboard queries recheck session ownership without requiring session UPDATE privileges',async()=>{
  const calls=[],repo=dashboardRepository({query:async(sql,values)=>{calls.push({sql,values});return {rows:[]};}}),token='a'.repeat(64),id='11111111-1111-4111-8111-111111111111';
  await repo.profile(token);await repo.update(token,{fullName:null,location:null});await repo.saved(token,{page:1,limit:20});await repo.status(token,[id]);await repo.save(token,id);await repo.remove(token,id);
  for(const {sql,values}of calls){assert.match(sql,/s\.token_hash=\$1/);assert.match(sql,/s\.credential_version=u\.credential_version/);assert.doesNotMatch(sql,/FOR (?:SHARE|UPDATE) OF s\b/);assert.equal(values.includes(token),false);}
});
test('saved status batch rejects injection, repeated/unknown inputs and oversized batches',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  assert.deepEqual(savedStatusQuery.parse({ids:id+','+id}).ids,[id]);
  for(const value of [{ids:"' OR 1=1--"},{ids:[id]},{ids:id,userId:id},{ids:Array(51).fill(id).join(',')}])assert.equal(savedStatusQuery.safeParse(value).success,false);
});
