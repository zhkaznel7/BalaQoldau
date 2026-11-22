import test from 'node:test';
import assert from 'node:assert/strict';
import {replyInput} from '../dist/admin/reply-routes.js';
import {replyDelivery,resetDelivery} from '../dist/users/mail.js';
test('reply input is bounded, strict, and requires a replay-safe identifier',()=>{
 const valid={submissionId:'11111111-1111-4111-8111-111111111111',text:'  Reply\ntext  '};
 assert.equal(replyInput.parse(valid).text,'Reply\ntext');
 for(const value of [{...valid,text:' '},{...valid,text:'x'.repeat(2001)},{...valid,text:'bad\u0000text'},{...valid,userId:valid.submissionId},{text:'Reply'}])assert.equal(replyInput.safeParse(value).success,false);
});
test('mail remains opt-in and rejects recipient header injection before starting a process',async()=>{
 assert.equal(replyDelivery({}),undefined);assert.equal(resetDelivery({}),undefined);
 const send=replyDelivery({USER_MAIL_COMMAND:process.execPath,USER_MAIL_FROM:'test@example.com'});
 await assert.rejects(send('test@example.com\r\nBcc: private@example.com','TEST body'),/Mail delivery unavailable/);
});
