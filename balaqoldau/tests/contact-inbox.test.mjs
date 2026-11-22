import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminApi} from '../src/admin/api.ts';
import {createApi} from '../src/api/client.ts';
import {tr} from '../src/i18n/ui.ts';
const id='11111111-1111-4111-8111-111111111111',csrf='b'.repeat(64),message={id,senderName:'TEST',email:'test@example.com',message:'TEST',status:'read',version:2,createdAt:'2026-11-13T00:00:00Z',updatedAt:'2026-11-13T00:00:00Z'};
test('public contact preserves its idempotency key and has no automatic write retry',async()=>{
 const calls=[],api=createApi('/api',async(url,init)=>{calls.push({url,init});return Response.json({data:{id}},{status:201});});
 const input={senderName:'TEST',email:'test@example.com',message:'TEST',submissionId:id};
 await api.contact(input);assert.deepEqual(JSON.parse(calls[0].init.body),input);assert.equal(calls[0].init.credentials,'omit');
 let attempts=0;const fail=createApi('/api',async()=>{attempts++;throw new Error('private network detail');});await assert.rejects(fail.contact(input));assert.equal(attempts,1);
});
test('inbox transport preserves CSRF/credentials, strips locale and validates mutations',async()=>{
 const calls=[],api=createAdminApi('/api/admin',async(url,init)=>{calls.push({url,init});return Response.json({data:url.endsWith('/session')?{authenticated:true,admin:{id},csrfToken:csrf}:message});});
 await api.session();await api.changeContact(id,1,'read');assert.equal(calls[1].init.headers['X-CSRF-Token'],csrf);assert.equal(calls[1].init.credentials,'same-origin');
 const bad=createAdminApi('/api/admin',async()=>Response.json({data:{...message,version:7}}));await assert.rejects(bad.changeContact(id,1,'read'));
 const list=createAdminApi('/api/admin',async(url)=>{assert.ok(!url.includes('lang='));return Response.json({data:[{...message,preview:'TEST'}],unreadCount:3,pagination:{page:1,limit:20,total:1,totalPages:1}});});assert.equal((await list.contacts('lang=ru&status=read')).unreadCount,3);
});
test('contact labels and states have distinct KZ/RU translations',()=>{
 for(let i=460;i<=471;i++)for(const lang of ['kk','ru'])assert.notEqual(tr('m'+i,{},lang),'m'+i);
});
