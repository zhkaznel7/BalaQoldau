import test from 'node:test';
import assert from 'node:assert/strict';
import {contactListQuery,contactChange} from '../dist/admin/contact-routes.js';
import {contactBody} from '../dist/api/schemas.js';
import {hasPermission} from '../dist/admin/authorization.js';
test('contact inbox denies non-Admin roles and validates strict status/pagination bodies',()=>{
  assert.equal(hasPermission('admin','contacts:manage'),true);
  for(const role of ['editor','reviewer',null,'unknown'])assert.equal(hasPermission(role,'contacts:manage'),false);
  assert.equal(contactListQuery.safeParse({status:'unread',page:'1',limit:'20'}).success,true);
  for(const value of [{limit:'51'},{status:'draft'},{q:'private email'}])assert.equal(contactListQuery.safeParse(value).success,false);
  for(const value of [{version:0,status:'read'},{version:1,status:'deleted'},{version:1,status:'read',message:'overwrite'}])assert.equal(contactChange.safeParse(value).success,false);
  assert.equal(contactBody.safeParse({senderName:'TEST',email:'test@example.com',message:'TEST',submissionId:'bad'}).success,false);
});
