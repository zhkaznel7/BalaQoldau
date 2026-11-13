import test from 'node:test';
import assert from 'node:assert/strict';
import {regionSlugs,referenceName,isDemoReference,nationwideRegions} from '../src/api/reference-data.ts';
import {categoryName} from '../src/api/categories.ts';
import {initialForm,validateProgramForm} from '../src/admin/form.ts';
test('20 administrative regions have distinct localized labels and stable identifiers',()=>{
  assert.equal(regionSlugs.length,20);assert.equal(new Set(regionSlugs).size,20);
  for(const slug of regionSlugs)for(const lang of ['kk','ru'])assert.notEqual(referenceName('regions',slug,slug,lang),slug);
  assert.equal(referenceName('regions','almaty-region','','ru'),'Алматинская область');
  assert.equal(referenceName('regions','almaty-city','','ru'),'город Алматы');
});
test('nationwide means the 20 real regions only; DEMO is not a real reference',()=>{
  const options=regionSlugs.map(slug=>({slug,name:slug}));
  assert.deepEqual(nationwideRegions(options),regionSlugs);
  assert.deepEqual(nationwideRegions(options.slice(1)),[]);
  assert.equal(isDemoReference({slug:'demo-example',name:'DEMO fixture'}),true);
  assert.equal(isDemoReference({slug:'legacy',name:'DEMO — legacy'}),true);
  assert.equal(isDemoReference({slug:'astana',name:'Astana'}),false);
});
test('support needs are neutral labels, separate from program categories and legal eligibility',()=>{
  for(const slug of ['education-support','creative-development','sports-activities']){
    assert.notEqual(referenceName('familyCategories',slug,slug,'kk'),slug);
    assert.notEqual(referenceName('familyCategories',slug,slug,'ru'),slug);
  }
  assert.equal(referenceName('regions','legacy','Source original','ru'),'Source original');
  assert.equal(referenceName('regions','constructor','Source original','ru'),'Source original');
  assert.equal(categoryName('benefits','','ru'),'Пособия');
});
test('admin reference validation rejects unknown categories and DEMO assignments without changing input',()=>{
  const taxonomy={categories:[{slug:'benefits',name:'source'}],regions:[{slug:'astana',name:'source'},{slug:'demo-example',name:'DEMO'}],familyCategories:[]};
  const form={...initialForm(),slug:'test',title:'TEST',description:'TEST',category:'benefits',regions:['astana']};
  assert.deepEqual(validateProgramForm(form,taxonomy),{});
  assert.ok(validateProgramForm({...form,category:'unknown'},taxonomy).category);
  assert.ok(validateProgramForm({...form,regions:['demo-example']},taxonomy).regions);
  assert.deepEqual(form.regions,['astana']);
});
