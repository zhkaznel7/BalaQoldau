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
  const indirect = 'Государство перечисляет деньги семье новорождённого?';
  assert.equal(resolveRecommendationIntent(indirect, () => null).mode, 'clarification');
  for (const infer of [() => ({label: 'invalid', confidence: 1, margin: 1}), () => {throw new Error();}]) {
    const {intent, mode} = resolveRecommendationIntent(query, infer);
    assert.equal(mode, 'rules-fallback');
    assert.equal(intent.category, 'benefits');
  }
  assert.equal(resolveRecommendationIntent(indirect, () => ({label:'benefits', confidence:0.4, margin:0.01})).mode, 'clarification');
  assert.equal(resolveRecommendationIntent(query, () => ({label:'grants', confidence:0.95, margin:0.9})).intent.category, 'benefits');
});

test('an explicit activity constrains the category even when the model disagrees', () => {
  for (const query of ['Алматыда 7 жастағы балама спорт секциясы керек', 'Алматыда 7 жастағы балаға сурет керек']) {
    assert.equal(resolveRecommendationIntent(query, () => ({label:'benefits', confidence:0.99, margin:0.9})).intent.category, 'clubs');
  }
});

test('funding a creative initiative is a grant search', () => {
  for (const query of ['Шығармашылық жобаны байқау арқылы қаржыландыруға бола ма?',
    'Где найти конкурс, финансирование которого доступно творческим коллективам?']) {
    assert.equal(resolveRecommendationIntent(query, () => null).intent.category, 'grants');
  }
});

