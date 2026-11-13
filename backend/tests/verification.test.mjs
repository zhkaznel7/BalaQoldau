import test from 'node:test';import assert from 'node:assert/strict';
import {verificationFlags}from '../dist/admin/verification-policy.js';
import{reviewInput,decisionInput,programListInput,confirmationInput}from'../dist/admin/program-schemas.js';
import{reportBody}from'../dist/api/schemas.js';
import{parseEnvironment}from'../dist/config/env.js';
test('expiration is date inclusive and stale source checks use a configurable bounded period',()=>{
 const p={verifiedAt:'2026-11-01T00:00:00Z',deadline:'2026-11-13',expiresOn:null};
 assert.deepEqual(verificationFlags(p,180,'2026-11-13',Date.parse('2026-11-13')), {expired:false,needsReverification:false});
 assert.equal(verificationFlags({...p,expiresOn:'2026-11-12'},180,'2026-11-13').expired,true);
 assert.equal(verificationFlags({...p,sourceNeedsRecheck:true},180,'2026-11-13').needsReverification,true);
 assert.equal(verificationFlags(p,7,'2026-11-13',Date.parse('2026-11-13')).needsReverification,true);
});
test('approval requires all explicit checks; rejections require bounded internal notes',()=>{
 const input={version:1,sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true};assert.equal(reviewInput.safeParse(input).success,true);
 for(const extra of [{sourceReviewed:false},{informationReviewed:false},{eligibilityReviewed:false},{status:'published'},{notes:'x'.repeat(1001)}])assert.equal(reviewInput.safeParse({...input,...extra}).success,false);
 assert.equal(reviewInput.safeParse({version:1}).success,false);assert.equal(decisionInput.safeParse({version:1,notes:' '}).success,false);
 assert.equal(confirmationInput.safeParse({version:1}).success,false);assert.equal(confirmationInput.safeParse({version:1,confirm:true}).success,true);
});
test('verification filters and configurable review period reject unsafe values',()=>{
 assert.equal(programListInput.parse({status:'pending'}).status,'review');
 for(const input of [{category:"' OR true--"},{region:['x','y']},{verifiedFrom:'bad'},{verifiedFrom:'2026-12-01',verifiedTo:'2026-01-01'},{expiration:'anything'}])assert.equal(programListInput.safeParse(input).success,false);
 for(const value of ['0','6','731','-1','1.5'])assert.throws(()=>parseEnvironment({CORS_ALLOWED_ORIGINS:'https://example.com',PROGRAM_REVIEW_DAYS:value}));
});
test('anonymous reports accept no contact/account/child fields or uncontrolled text size',()=>{
 assert.deepEqual(reportBody.parse({reason:'outdated'}),{reason:'outdated'});
 for(const extra of [{reason:'unknown'},{explanation:'x'.repeat(1001)},{explanation:'\u0000'},{email:'x@example.com'},{childId:'x'},{iin:'x'}])assert.equal(reportBody.safeParse({reason:'other',...extra}).success,false);
});
