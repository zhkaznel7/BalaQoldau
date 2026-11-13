import test from 'node:test';
import assert from 'node:assert/strict';
import {kk} from '../src/i18n/kk.ts';
import {ru} from '../src/i18n/ru.ts';
import {tr} from '../src/i18n/ui.ts';
import {readdir,readFile} from 'node:fs/promises';
import {AdminError} from '../src/admin/api.ts';
import {ApiError} from '../src/api/client.ts';
import ts from 'typescript';
test('all public/admin dictionary entries have both translations and identical interpolation slots',()=>{
  assert.deepEqual(Object.keys(kk).sort(),Object.keys(ru).sort());
  for(const key of Object.keys(kk)){assert.ok(kk[key].trim());assert.ok(ru[key].trim());assert.deepEqual(kk[key].match(/\{\d+\}/g)??[],ru[key].match(/\{\d+\}/g)??[]);}
  assert.equal(tr('m201',{0:4},'ru'),'Найдено программ: 4');
  assert.equal(tr('Бағдарламалар',{},'ru'),'Программы');
  assert.equal(tr('Программы',{},'kk'),'Бағдарламалар');
});

test('every shared translation reference resolves to an existing dictionary key',async()=>{
  const root=new URL('../src/',import.meta.url);
  for(const entry of await readdir(root,{recursive:true})){
    if(!/\.[jt]sx?$/.test(entry))continue;
    const source=await readFile(new URL(entry.replaceAll('\\','/'),root),'utf8');
    for(const match of source.matchAll(/tr\(["'](m\d+)["']/g))assert.ok(Object.hasOwn(kk,match[1]),entry+': '+match[1]);
  }
});

test('stored backend error status messages can be relocalized without showing raw server text',()=>{
  for(const status of [0,400,401,403,404,409,413,429,500]){
    const error=new AdminError(status);
    assert.notEqual(tr(error.message,{},'ru'),error.message);
    assert.equal(tr(tr(error.message,{},'ru'),{},'kk'),error.message);
  }
  for(const status of [400,404,429,503])assert.notEqual(tr(new ApiError(status).message,{},'ru'),new ApiError(status).message);
});

test('active frontend has no hardcoded Cyrillic UI outside dictionaries and native language names',async()=>{
  const root=new URL('../src/',import.meta.url),remaining=[];
  const nativeNames=new Set(['Қазақша','Русский','ҚАЗ','РУС']);
  // Stable search values are data: translating them would change current catalog search behavior.
  const searchValues=new Set(['жәрдемақы','тегін курс','үйірме','грант']);
  for(const entry of await readdir(root,{recursive:true})){
    const filename=entry.replaceAll('\\','/');
    if(!/\.tsx?$/.test(filename)||filename.startsWith('i18n/')||['account/translations.ts','data/programs.ts'].includes(filename))continue;
    const source=await readFile(new URL(filename,root),'utf8');
    const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,filename.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    function visit(node){
      if(ts.isStringLiteralLike(node)||ts.isJsxText(node)){
        const value=node.text.trim();
        if(/\p{Script=Cyrillic}/u.test(value)&&!(filename==='components/LanguageSwitcher.tsx'&&nativeNames.has(value))&&!(filename==='components/Home.tsx'&&searchValues.has(value)))remaining.push(filename+': '+value);
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);
  }
  assert.deepEqual(remaining,[]);
});
