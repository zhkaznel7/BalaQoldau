import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeChild,parseChild} from '../src/account/children.ts';import {tr} from '../src/i18n/ui.ts';
const input={nickname:'TEST',age:'7',region:'astana',preferences:[],fullName:' TEST Child ',gender:'male',interests:['sports','education']};
test('child UI normalizes optional details, supports clearing and reads legacy profiles',()=>{
 const normalized=normalizeChild(input);assert.equal(normalized.fullName,'TEST Child');assert.deepEqual(normalized.interests,['education','sports']);
 const child={...normalized,id:'11111111-1111-4111-8111-111111111111',version:1};assert.deepEqual(parseChild(child),child);
 assert.equal(normalizeChild({...input,fullName:'',gender:null,interests:[]}).fullName,null);
 const {fullName,gender,interests,...legacy}=child;assert.equal(parseChild(legacy).fullName,undefined);
 for(const patch of [{fullName:'name\nname'},{fullName:'1'.repeat(12)},{fullName:'a'.repeat(101)},{gender:'unknown'},{interests:['sports','sports']},{interests:['diagnosis']}]){assert.equal(normalizeChild({...input,...patch}),null);assert.throws(()=>parseChild({...child,...patch}));}
});
test('enhanced child labels immediately resolve in both existing dictionaries',()=>{
 for(let n=495;n<=503;n++)for(const language of ['kk','ru'])assert.notEqual(tr('m'+n,{},language),'m'+n);
 assert.notEqual(tr('m495',{},'kk'),tr('m495',{},'ru'));
});
