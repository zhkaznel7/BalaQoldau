import test from 'node:test';
import assert from 'node:assert/strict';
import {carryLanguage,withoutLanguage} from '../src/components/language.ts';

test('locale changes do not change resource/form identity or discard query filters',()=>{
  assert.equal(withoutLanguage('?lang=ru&q=test&page=2'),withoutLanguage('?lang=kk&q=test&page=2'));
  assert.equal(withoutLanguage('?lang=ru&q=test&page=2'),'q=test&page=2');
});
test('URL language is preserved on navigation without resetting filters or overriding explicit choice',()=>{
  assert.equal(carryLanguage('?lang=ru','?q=test&page=2'),'?q=test&page=2&lang=ru');
  assert.equal(carryLanguage('?lang=ru','?lang=kk&q=test'),'?lang=kk&q=test');
  assert.equal(carryLanguage('?lang=kk',''),'?lang=kk');
  assert.equal(carryLanguage('?q=old','?q=new'),'?q=new');
  assert.equal(carryLanguage('?lang=unsupported',''),'');
});
