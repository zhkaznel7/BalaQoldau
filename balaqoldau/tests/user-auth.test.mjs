import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserApi, UserAuthError, resetTokenFromHash, validNewPassword } from '../src/account/api.ts';
import { authText } from '../src/account/translations.ts';

test('user client keeps credentials and CSRF separate from admin and does not retry writes', async () => {
  const calls=[],csrf='c'.repeat(64),api=createUserApi(async (url,init)=>{calls.push({url,init});
    return Response.json({data:url.endsWith('/register')?{accepted:true}:{authenticated:false,user:null,csrfToken:csrf,resetAvailable:false}});});
  await api.session(); await api.register('test@example.com','Synthetic password!','ru');
  assert.equal(calls[1].url,'/api/auth/register'); assert.equal(calls[1].init.credentials,'same-origin');
  assert.equal(calls[1].init.headers['X-CSRF-Token'],csrf); assert.equal(calls[1].init.cache,'no-store');
  assert.equal(calls[1].url.includes('password'),false);
  let attempts=0; const failed=createUserApi(async()=>{attempts++;return Response.json({error:{message:'private-db-password'}},{status:503});});
  await assert.rejects(failed.login('test@example.com','password'),error=>error instanceof UserAuthError && !error.message.includes('private'));
  assert.equal(attempts,1);
});
test('401 invokes expiry handler; unknown reset errors never echo server contents', async () => {
  let expired=0; const api=createUserApi(async()=>Response.json({error:{code:'INVALID_CREDENTIALS',message:'secret'}},{status:401}),()=>expired++);
  await assert.rejects(api.profile()); assert.equal(expired,1);
  await assert.rejects(api.login('test@example.com','wrong')); assert.equal(expired,1);
});
test('backend password-policy errors map to explicit KZ/RU bounds without raw messages',async()=>{
  const api=createUserApi(async()=>Response.json({error:{code:'PASSWORD_POLICY',message:'private-detail'}},{status:400}));
  await assert.rejects(api.register('test@example.com','short','kk'),error=>error.key==='passwordInvalid');
  for(const language of ['kk','ru']){
    assert.match(authText[language].hint,/8/);assert.match(authText[language].passwordInvalid,/8/);
    assert.match(authText[language].passwordInvalid,/256/);
  }
});
test('reset fragments and password bounds are validated; KZ/RU dictionaries have identical keys',()=>{
  assert.equal(resetTokenFromHash('#token='+'b'.repeat(64)),'b'.repeat(64));
  for(const value of ['#token=short','#token='+ 'a'.repeat(64)+'&token='+'b'.repeat(64),'?token='+'a'.repeat(64)]) assert.equal(resetTokenFromHash(value),'');
  assert.equal(validNewPassword('x'.repeat(8)),true); assert.equal(validNewPassword('x'.repeat(7)),false);
  assert.equal(validNewPassword('x'.repeat(14)),true);
  assert.equal(validNewPassword('x'.repeat(256)),true); assert.equal(validNewPassword('x'.repeat(257)),false);
  assert.equal(validNewPassword('я'.repeat(128)),true);
  assert.equal(validNewPassword('😀'.repeat(7)),false); assert.equal(validNewPassword('😀'.repeat(8)),true);
  assert.equal(validNewPassword('😀'.repeat(64)),true); assert.equal(validNewPassword('😀'.repeat(65)),false);
  assert.equal(validNewPassword('я'.repeat(129)),false);
  assert.deepEqual(Object.keys(authText.kk),Object.keys(authText.ru));
  assert.equal(authText.kk.login,'Кіру'); assert.equal(authText.ru.login,'Войти');
});
