import test from 'node:test';import assert from 'node:assert/strict';
import {tr} from '../src/i18n/ui.ts';
test('about and inbox editorial content is complete in KZ/RU, with no untranslated keys',()=>{
 for(let n=504;n<=522;n++){for(const lang of ['kk','ru']){const text=tr('m'+n,{},lang);assert.notEqual(text,'m'+n);assert.ok(text.trim());}assert.notEqual(tr('m'+n,{},'kk'),tr('m'+n,{},'ru'));}
});
