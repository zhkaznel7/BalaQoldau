import {writeFileSync} from 'node:fs';
import {categoryFeatures, dimensions, labels, modelVersion, probabilities} from '../src/ai/category-features.ts';
import {loadDataset} from '../tests/ai-dataset.mjs';

const examples = loadDataset().filter(row => row.split === 'train')
  .map(row => ({features: categoryFeatures(row.query), target: labels.indexOf(row.label)}));
const weights = labels.map(() => Array(dimensions).fill(0));
const bias = labels.map(() => 0);
const epochs = 480;
const learningRate = 2;
const regularization = 0.002;

// Full-batch gradient descent on multiclass cross-entropy with an L2 weight penalty.
for (let epoch = 0; epoch < epochs; epoch++) {
  const gradient = labels.map(() => new Float64Array(dimensions));
  const biasGradient = labels.map(() => 0);
  for (const {features, target} of examples) {
    const scores = probabilities(features, weights, bias);
    const scale = 1 / Math.sqrt(features.length);
    for (let label = 0; label < labels.length; label++) {
      const error = scores[label] - Number(label === target);
      biasGradient[label] += error;
      for (const feature of features) gradient[label][feature] += error * scale;
    }
  }
  for (let label = 0; label < labels.length; label++) {
    bias[label] -= learningRate * biasGradient[label] / examples.length;
    for (let feature = 0; feature < dimensions; feature++) {
      weights[label][feature] -= learningRate * (gradient[label][feature] / examples.length +
        regularization * weights[label][feature]);
    }
  }
}

const round = value => Number(value.toFixed(5));
const artifact = {version: modelVersion, labels, bias: bias.map(round), weights: weights.map(row => row.map(round))};
writeFileSync(new URL('../src/ai/category-model.json', import.meta.url), JSON.stringify(artifact) + '\n');
console.log('Trained model v' + modelVersion + ' on ' + examples.length + ' queries.');
