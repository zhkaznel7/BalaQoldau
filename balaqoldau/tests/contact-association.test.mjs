import test from 'node:test';import assert from 'node:assert/strict';
import {sendContact} from '../src/api/contact.ts';import {UserAuthError,createUserApi} from '../src/account/api.ts';
const input={senderName:'TEST',email:'editable@example.com',message:'TEST',submissionId:'11111111-1111-4111-8111-111111111111'};
test('submission waits for server session, not initial provider state, and never downgrades on temporary failure',async()=>{
 const calls=[];let resolve;const wait=new Promise(done=>resolve=done);
 const account={session:()=>wait,contact:async value=>calls.push(['account',value])},anonymous={contact:async value=>calls.push(['anonymous',value])};
 const pending=sendContact(account,anonymous,input);assert.deepEqual(calls,[]);resolve({authenticated:true});await pending;assert.deepEqual(calls,[['account',input]]);
 for(const status of [0,401,403,404,429,503]){calls.length=0;await assert.rejects(sendContact({...account,session:async()=>{throw new UserAuthError(status,'unavailable');}},anonymous,input));assert.deepEqual(calls,[]);}
});
test('only the dedicated server marker classifies authentication as disabled',async()=>{
 for(const code of ['AUTH_DISABLED','NOT_FOUND']){const api=createUserApi(async()=>Response.json({error:{code}},{status:404}));await assert.rejects(api.session(),e=>e.authDisabled===(code==='AUTH_DISABLED'));}
});
test('only confirmed anonymous or explicitly disabled authentication uses the public endpoint',async()=>{
 let calls=0;const anonymous={contact:async()=>{calls++;}},account={session:async()=>({authenticated:false}),contact:async()=>assert.fail('not authenticated')};
 await sendContact(account,anonymous,input);assert.equal(calls,1);
 await sendContact({...account,session:async()=>{throw new UserAuthError(404,'unavailable',true);}},anonymous,input);assert.equal(calls,2);
});
