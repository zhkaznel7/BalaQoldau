import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,safeReturnTo,createUserApi} from '../src/account/api.ts';
const id='11111111-1111-4111-8111-111111111111',csrf='a'.repeat(64);
test('optional profile normalization is bounded and keeps client/server ownership out of payloads',()=>{
  assert.deepEqual(normalizeProfile({fullName:' TEST   Parent ',location:' '}),{fullName:'TEST Parent',location:null});
  assert.equal(normalizeProfile({fullName:'a'.repeat(101),location:''}),null);
  assert.equal(normalizeProfile({fullName:'TEST',location:'bad\u0000'}),null);
});
test('login return routes preserve filters but reject external, ambiguous and privileged targets',()=>{
  assert.equal(safeReturnTo('/results?category=test&page=2'),'/results?category=test&page=2');
  assert.equal(safeReturnTo('/profile/saved?lang=ru'),'/profile/saved?lang=ru');
  for(const path of ['//evil.example','https://evil.example','/admin/programs','/results/../admin','/\\evil','/results\n'])assert.equal(safeReturnTo(path),'/profile');
});
test('profile/save/remove/status transport uses CSRF, same-origin and no user ID',async()=>{
  const calls=[],api=createUserApi(async(url,init)=>{
    calls.push({url,init});if(url.endsWith('/session'))return Response.json({data:{authenticated:true,user:{id,email:'test@example.com',language:'kk'},csrfToken:csrf,resetAvailable:false}});
    if(url.endsWith('/profile'))return Response.json({data:{id,email:'test@example.com',language:'kk',fullName:null,location:null,savedCount:0}});
    if(url.includes('/status?'))return Response.json({data:[id]});return new Response(null,{status:204});
  });
  await api.session();await api.updateProfile({fullName:null,location:null});await api.saveProgram(id);await api.removeProgram(id);
  assert.deepEqual(await api.savedStatus([id]),[id]);
  for(const call of calls.slice(1,4)){assert.equal(call.init.headers['X-CSRF-Token'],csrf);assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.cache,'no-store');assert.equal(call.init.body.includes('userId'),false);}
  assert.equal(calls[1].init.method,'PATCH');assert.equal(calls[3].init.method,'DELETE');
});
