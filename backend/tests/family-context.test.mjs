import test from 'node:test';
import assert from 'node:assert/strict';
import {profileInput} from '../dist/users/dashboard-schemas.js';
import {childInput} from '../dist/users/children-schemas.js';
import {selectedSupportNeed} from '../dist/users/family-context.js';
test('private optional family context rejects unsafe fields, invalid counts and unsupported needs',()=>{
 const base={fullName:null,location:null};
 assert.equal(profileInput.safeParse({...base,familyContext:{childrenCount:3,singleParent:null,largeFamily:false,disabilitySupportEligible:true,supportNeeds:['education-support']}}).success,true);
 for(const familyContext of [{childrenCount:-1},{childrenCount:31},{childrenCount:1.5},{singleParent:'yes'},{diagnosis:'private'},{iin:'private'},{supportNeeds:['unknown']},{supportNeeds:['education-support','education-support']}])assert.equal(profileInput.safeParse({...base,familyContext}).success,false);
 assert.equal(childInput.safeParse({age:6,region:'astana',familyContext:{childrenCount:3}}).success,false);
 assert.equal(childInput.safeParse({age:6,region:'astana',familyContext:{disabilitySupportEligible:null,supportNeeds:['sports-activities']}}).success,true);
 assert.equal(selectedSupportNeed({supportNeeds:['sports-activities'],disabilitySupportEligible:true}),'sports-activities');
 assert.equal(selectedSupportNeed({supportNeeds:['sports-activities','education-support']}),undefined);
 assert.equal(selectedSupportNeed({disabilitySupportEligible:true}),undefined);
});
