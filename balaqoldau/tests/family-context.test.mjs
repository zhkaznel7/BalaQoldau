import test from 'node:test';import assert from 'node:assert/strict';
import {validFamilyContext} from '../src/account/family.ts';
import {normalizeProfile} from '../src/account/api.ts';
import {normalizeChild} from '../src/account/children.ts';
test('family context is private optional self-declaration, bounded and erasable',()=>{
 const context={childrenCount:4,singleParent:null,largeFamily:true,disabilitySupportEligible:false,supportNeeds:['education-support']};
 assert.equal(validFamilyContext(context),true);assert.equal(validFamilyContext(context,false),false);
 for(const value of [{childrenCount:-1},{childrenCount:31},{medicalDiagnosis:'x'},{iin:'x'},{supportNeeds:['unknown']},{disabilitySupportEligible:'true'}])assert.equal(validFamilyContext(value),false);
 assert.deepEqual(normalizeProfile({fullName:'TEST',location:'',familyContext:context}).familyContext,context);
 assert.equal(normalizeProfile({fullName:'TEST',location:'',familyContext:null}).familyContext,null);
 assert.equal(normalizeChild({nickname:'',age:'5',region:'astana',preferences:[],familyContext:{childrenCount:3}}),null);
});
