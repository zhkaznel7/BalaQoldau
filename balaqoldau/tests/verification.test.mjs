import test from'node:test';import assert from'node:assert/strict';
import{createAdminApi}from'../src/admin/api.ts';import{createApi}from'../src/api/client.ts';
import{permittedActions}from'../src/admin/types.ts';import{tr}from'../src/i18n/ui.ts';
const id='11111111-1111-4111-8111-111111111111';
const p={id,slug:'test',category:'test',title:'SOURCE title',description:'SOURCE only',isDemo:false,sourceUrl:'https://example.com/test',sourceName:'TEST source',applyUrl:null,deadline:null,verifiedAt:null,ageMin:0,ageMax:17,regions:['test'],familyCategories:[],status:'draft',version:1,createdBy:id,submittedBy:null,reviewedBy:null};
test('anonymous report transport omits credentials and sends only reason/explanation; no automatic retry',async()=>{
 let calls=0;const api=createApi('/api',async(url,options)=>{calls++;assert.equal(url,'/api/programs/'+id+'/reports');assert.equal(options.credentials,'omit');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{reason:'outdated',explanation:null});return new Response(JSON.stringify({data:{accepted:true}}),{status:202});});
 assert.deepEqual(await api.report(id,{reason:'outdated',explanation:null}),{accepted:true});assert.equal(calls,1);
});
test('verification action transports all attestations and report moderation shares admin CSRF',async()=>{
 const requests=[],api=createAdminApi('/api/admin',async(url,options)=>{requests.push({url,options});if(url.endsWith('/session'))return new Response(JSON.stringify({data:{authenticated:true,admin:{id},csrfToken:'a'.repeat(64)}}));if(url.includes('/reports/'))return new Response(JSON.stringify({data:{id,status:'reviewed',version:2}}));return new Response(JSON.stringify({data:{...p,status:'verified'}}));});
 await api.session();await api.action(id,'approve',1,{sourceReviewed:true,informationReviewed:true,eligibilityReviewed:true,notes:'TEST review'});await api.moderateReport(id,1,'reviewed');
 const body=JSON.parse(requests[1].options.body);assert.equal(body.sourceReviewed,true);assert.equal(body.informationReviewed,true);assert.equal(body.eligibilityReviewed,true);assert.equal(requests[2].options.headers['X-CSRF-Token'],'a'.repeat(64));
});
test('archive and reopening controls are role aware, while decisions stay backend enforced',()=>{
 const editor={id,role:'editor',permissions:['programs:read','programs:draft:write']},admin={id,role:'admin',permissions:['programs:draft:write','programs:review','programs:publish']};
 assert.ok(permittedActions(editor,{...p,status:'rejected'}).includes('reopen'));assert.ok(!permittedActions(editor,{...p,status:'archived'}).includes('reopen'));
 assert.ok(permittedActions(admin,{...p,status:'published'}).includes('archive'));assert.ok(!permittedActions(editor,{...p,status:'published'}).includes('archive'));
 assert.ok(!permittedActions({id,role:'reviewer',permissions:['programs:review']},{...p,status:'published'}).includes('request-recheck'),'visibility control remains Admin-only');
  assert.ok(permittedActions(admin,{...p,status:'review',submittedBy:id}).includes('approve'));
  assert.ok(!permittedActions({id,role:'reviewer',permissions:['programs:read','programs:review']},{...p,status:'review',submittedBy:id}).includes('approve'));
});
test('all verification/report UI labels have Kazakh/Russian translations',()=>{for(let i=363;i<=417;i++){assert.notEqual(tr('m'+i,{},'kk'),tr('m'+i,{},'ru'));assert.notEqual(tr('m'+i,{},'ru'),'m'+i);}});
