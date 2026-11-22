import test from 'node:test';
import assert from 'node:assert/strict';
import {categorySlugs,catalogCategories,categoryName} from '../src/api/categories.ts';
import {resultsUrl,updateFilters} from '../src/api/navigation.ts';
import {tr} from '../src/i18n/ui.ts';

test('four stable category identifiers never become translated search keywords',()=>{
  assert.deepEqual(categorySlugs,['benefits','free-courses','grants','clubs']);
  assert.equal(catalogCategories().length,4);
  for(const category of categorySlugs){
    const direct=new URL(resultsUrl({category}),'https://local.invalid');
    assert.equal(direct.searchParams.get('category'),category);assert.equal(direct.searchParams.has('q'),false);
    const query=updateFilters(new URLSearchParams('region=test&age=7&need=test&matching=1&q=manual&page=2'),{category});
    assert.equal(query.get('q'),'manual');assert.equal(query.get('region'),'test');assert.equal(query.get('age'),'7');
    assert.equal(query.get('need'),'test');assert.equal(query.get('matching'),'1');assert.equal(query.has('page'),false);
  }
  assert.equal(categoryName('operator-category','Original source name'),'Original source name');
  for(let key=418;key<=421;key++)for(const lang of ['kk','ru'])assert.notEqual(tr('m'+key,{},lang),'m'+key);
});
