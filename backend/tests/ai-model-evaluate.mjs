import {loadDataset} from './ai-dataset.mjs';
import {extractIntent} from '../dist/ai/intent.js';
import {resolveRecommendationIntent} from '../dist/ai/classifier.js';
import {labels} from '../dist/ai/category-features.js';

const dataset = loadDataset();
const heldOut = dataset.filter(row => row.split === 'eval');
const categories = labels.filter(label => label !== 'general');
const percent = fraction => (100 * fraction).toFixed(1) + '%';
const toLabel = intent => intent.category ?? 'general';

function macroF1(rows, predict) {
  return categories.reduce((sum, category) => {
    const expected = rows.filter(row => row.label === category);
    const predicted = rows.filter(row => predict(row) === category);
    const correct = expected.filter(row => predict(row) === category).length;
    return sum + 2 * correct / (expected.length + predicted.length);
  }, 0) / categories.length;
}

function evaluation(rows) {
  const indirect = rows.filter(row => row.style === 'indirect' && categories.includes(row.label));
  const baseline = indirect.filter(row => row.baseline === row.label).length;
  const model = indirect.filter(row => row.prediction === row.label).length;
  const fallbacks = rows.filter(row => row.mode === 'rules-fallback').length;
  const clarified = rows.filter(row => row.mode === 'clarification').length;
  return {
    cases: rows.length,
    baselineMacroF1: percent(macroF1(rows, row => row.baseline)),
    modelMacroF1: percent(macroF1(rows, row => row.prediction)),
    indirectBaseline: baseline + '/' + indirect.length,
    indirectModel: model + '/' + indirect.length,
    indirectLiftPoints: (100 * (model - baseline) / indirect.length).toFixed(1),
    fallbacks: fallbacks + '/' + rows.length,
    clarifications: clarified + '/' + rows.length,
    incorrectCategory: rows.filter(row => row.prediction !== 'general' && row.prediction !== row.label).length,
  };
}

const predictions = heldOut.map(row => {
  const {intent, mode} = resolveRecommendationIntent(row.query);
  return {...row, baseline: toLabel(extractIntent(row.query)), prediction: toLabel(intent), mode};
});

const percentile = (values, fraction) => values[Math.ceil(values.length * fraction) - 1].toFixed(3);
function time(extract) {
  for (let i = 0; i < 10; i++) for (const row of heldOut) extract(row.query);
  const samples = [];
  for (let i = 0; i < 25; i++) {
    for (const row of heldOut) {
      const start = performance.now();
      extract(row.query);
      samples.push(performance.now() - start);
    }
  }
  samples.sort((a, b) => a - b);
  return {samples: samples.length, p50Ms: percentile(samples, 0.50), p95Ms: percentile(samples, 0.95)};
}

const injectedFailure = predictions.filter(row => resolveRecommendationIntent(row.query, () => {
  throw new Error('Benchmark simulated missing model');
}).mode === 'rules-fallback').length;

console.log(JSON.stringify({
  training: dataset.length - heldOut.length,
  trainingFamilies: new Set(dataset.filter(row => row.split === 'train').map(row => row.family)).size,
  evaluationFamilies: new Set(heldOut.map(row => row.family)).size,
  kk: evaluation(predictions.filter(row => row.language === 'kk')),
  ru: evaluation(predictions.filter(row => row.language === 'ru')),
  total: evaluation(predictions),
  forcedFallback: injectedFailure + '/' + heldOut.length,
  platform: process.platform,
  node: process.version,
  rulesLatency: time(extractIntent),
  modelLatency: time(resolveRecommendationIntent),
}, null, 2));

