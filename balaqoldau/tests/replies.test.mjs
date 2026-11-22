import test from 'node:test';import assert from 'node:assert/strict';
import {createAdminApi} from '../src/admin/api.ts';import {createUserApi} from '../src/account/api.ts';
import {parseReply} from '../src/admin/replies.ts';import {tr} from '../src/i18n/ui.ts';
const id='11111111-1111-4111-8111-111111111111',csrf='a'.repeat(64);
const reply={id,adminId:id,text:'TEST <script>text</script>',createdAt:'2026-11-14T00:00:00Z',deliveredAt:null,deliveryStatus:'saved_not_delivered'};
test('both admin reply endpoints preserve CSRF, credentials and replay identifier',async()=>{
 const calls=[],api=createAdminApi('/api/admin',async(url,init)=>{calls.push({url,init});return Response.json({data:url.endsWith('/session')?{authenticated:true,admin:{id},csrfToken:csrf}:url.endsWith('/replies')&&init.method==='GET'?[reply]:reply});});
 await api.session();
 for(const kind of ['contact-messages','reports']){
  assert.deepEqual(await api.replies(kind,id),[reply]);assert.deepEqual(await api.reply(kind,id,reply.text,id),reply);
  const call=calls.at(-1);assert.equal(call.url,'/api/admin/'+kind+'/'+id+'/replies');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.headers['X-CSRF-Token'],csrf);assert.deepEqual(JSON.parse(call.init.body),{text:reply.text,submissionId:id});
 }
});
test('reply failures never trigger automatic POST retries or false success',async()=>{
 let attempts=0;const api=createAdminApi('/api/admin',async()=>{attempts++;return Response.json({error:{code:'SERVICE_UNAVAILABLE',message:'PRIVATE'}},{status:503});});
 await assert.rejects(api.reply('reports',id,'TEST',id),error=>error.status===503&&!error.message.includes('PRIVATE'));assert.equal(attempts,1);
 for(const value of [{...reply,deliveryStatus:'sent'}, {...reply,adminId:'invalid'}, {...reply,text:null}])assert.throws(()=>parseReply(value));
});
test('authenticated submissions use the existing user cookie and CSRF; account messages are parsed',async()=>{
 const calls=[],api=createUserApi(async(url,init)=>{calls.push({url,init});
  if(url.endsWith('/session'))return Response.json({data:{authenticated:true,user:{id,email:'test@example.com',language:'kk'},csrfToken:csrf,resetAvailable:false}});
  if(url.includes('/messages?'))return Response.json({data:[{id,text:'TEST',kind:'report',createdAt:reply.createdAt}],pagination:{page:1,limit:20,total:1,totalPages:1}});
  return Response.json({data:url.endsWith('/reports')?{accepted:true}:{id}});
 });
 await api.session();await api.contact({senderName:'TEST',email:'test@example.com',message:'TEST'});await api.report(id,{reason:'incorrect',explanation:null});
 for(const call of calls.slice(1)){assert.ok(call.url.startsWith('/api/auth/'));assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.headers['X-CSRF-Token'],csrf);assert.equal(JSON.parse(call.init.body).userId,undefined);}
 assert.equal((await api.messages()).data[0].kind,'report');
});
test('account inbox rejects malformed responses and keeps temporary failures separate from expiry',async()=>{
 let expired=0;const api=createUserApi(async()=>Response.json({error:{code:'RATE_LIMITED'}},{status:429}),()=>expired++);
 await assert.rejects(api.messages(),error=>error.status===429);assert.equal(expired,0);
 const malformed=createUserApi(async()=>Response.json({data:[{id,text:'TEST',kind:'unknown',createdAt:reply.createdAt}],pagination:{page:1,limit:20,total:1,totalPages:1}}));await assert.rejects(malformed.messages());
});
test('reply and truthful delivery states are localized in KZ/RU',()=>{
 for(let n=484;n<=494;n++){const key='m'+n;for(const language of ['kk','ru'])assert.notEqual(tr(key,{},language),key);assert.notEqual(tr(key,{},'kk'),tr(key,{},'ru'));}
});
