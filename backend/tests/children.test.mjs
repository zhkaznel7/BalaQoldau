import test from 'node:test';
import assert from 'node:assert/strict';
import {childInput,childUpdate,childDelete} from '../dist/users/children-schemas.js';
import {normalizeChild} from '../../balaqoldau/src/account/children.ts';
const value={nickname:null,age:0,region:'test-region',preferences:[]};
test('child profiles accept only bounded minimal fields, never sensitive or ownership fields',()=>{
  assert.deepEqual(childInput.parse(value),value);
  for(const extra of [{age:-1},{age:18},{age:1.5},{age:'6'},{region:"' OR true--"},{preferences:['a','a']},{preferences:Array.from({length:11},(_,i)=>'c-'+i)},{nickname:'123456789012'},{nickname:'x\nsecret'},{nickname:'x'.repeat(31)},{userId:'x'},{iin:'x'},{birthDate:'2020-01-01'},{disability:true},{medicalDiagnosis:'x'},{fullName:'x'}])assert.equal(childInput.safeParse({...value,...extra}).success,false);
});
test('child edits require a revision; deletion requires explicit confirmation',()=>{
  assert.equal(childUpdate.safeParse({...value,version:1}).success,true);
  assert.equal(childUpdate.safeParse(value).success,false);
  assert.equal(childUpdate.safeParse({age:6,region:'test-region',version:1}).success,false,'omission must not erase stored nickname/preferences');
  for(const body of [{},{version:1},{version:1,confirm:false},{version:0,confirm:true},{version:1,confirm:true,userId:'x'}])assert.equal(childDelete.safeParse(body).success,false);
  assert.deepEqual(childDelete.parse({version:1,confirm:true}),{version:1,confirm:true});
  assert.equal(childDelete.safeParse({version:2147483647,confirm:true}).success,true,'a terminal revision remains deletable');
});
test('frontend and backend child input normalization agree on accepted values and unsafe input',()=>{
  const values=[{nickname:' TEST  nickname ',age:'0',region:'test-region',preferences:[]},{nickname:'',age:'17',region:'test-region',preferences:['test-category']}];
  for(const v of values)assert.deepEqual(normalizeChild(v),childInput.parse({...v,age:Number(v.age)}));
  for(const extra of [{nickname:'123456789012'},{nickname:'x\ny'},{nickname:'a'.repeat(31)},{age:'18'},{age:'-1'},{region:'bad slug'},{preferences:['a','a']}]){
    const v={...values[0],...extra};assert.equal(normalizeChild(v),null);assert.equal(childInput.safeParse({...v,age:Number(v.age)}).success,false);
  }
});
