import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCategory, resolveRecommendationIntent} from '../dist/ai/classifier.js';

test('the trained classifier supplies categories for indirect Kazakh and Russian requests', () => {
  for (const query of ['Сәби келген отбасыға мемлекет ақша төлей ме?', 'Государство перечисляет деньги семье новорождённого?']) {
    assert.equal(classifyCategory(query)?.label, 'benefits');
    assert.equal(resolveRecommendationIntent(query).intent.category, 'benefits');
  }
});

test('conflicting locations and excluded categories bypass the model', () => {
  for (const query of ['Алматы или Астана, 7 лет', 'Не кружок, ребенку 7 лет', 'Не нужны занятия в группе после школы']) {
    assert.equal(resolveRecommendationIntent(query, () => {
      assert.fail('The classifier must not be called');
    }).mode, 'clarification');
  }
});

test('uncertainty clarifies, while invalid or unavailable inference falls back to rules', () => {
  const query = 'Какие пособия есть для ребенка?';
  assert.equal(resolveRecommendationIntent(query, () => null).mode, 'clarification');
  for (const infer of [() => ({label: 'invalid', confidence: 1, margin: 1}), () => {throw new Error();}]) {
    const {intent, mode} = resolveRecommendationIntent(query, infer);
    assert.equal(mode, 'rules-fallback');
    assert.equal(intent.category, 'benefits');
  }
  assert.equal(resolveRecommendationIntent(query, () => ({label:'benefits', confidence:0.4, margin:0.01})).mode, 'clarification');
  assert.equal(resolveRecommendationIntent(query, () => ({label:'grants', confidence:0.95, margin:0.9})).mode, 'clarification');
});

