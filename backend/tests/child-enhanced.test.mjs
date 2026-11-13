import test from 'node:test';import assert from 'node:assert/strict';
import {childInput} from '../dist/users/children-schemas.js';
import {normalizeChild} from '../../balaqoldau/src/account/children.ts';
test('optional child fields normalize identically and reject private identifiers and uncontrolled interests',()=>{
 const base={nickname:null,age:6,region:'astana',preferences:[]};
 const extra={fullName:'  TEST  Child ',gender:'female',interests:['sports','education']};
 const actual=childInput.parse({...base,...extra});assert.equal(actual.fullName,'TEST Child');
 assert.deepEqual(normalizeChild({...base,nickname:'',age:'6',...extra}),{...actual,interests:['education','sports']});
 for(const patch of [{fullName:'123456789012'},{fullName:'x\nname'},{fullName:'a'.repeat(101)},{gender:'invalid'},{interests:['diagnosis']},{interests:['sports','sports']},{iin:'123'}]){
  assert.equal(childInput.safeParse({...base,...patch}).success,false);
 }
});
