import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {categoryFeatures, dimensions, labels, modelVersion, probabilities} from './category-features.ts';
import {clarification, hasUnresolvedCategoryConstraint, parseIntentRules} from './intent.ts';
import type {Intent} from './intent.ts';

const label = z.enum(labels);
const modelSchema = z.strictObject({
  version: z.literal(modelVersion),
  labels: z.tuple([z.literal('benefits'), z.literal('free-courses'), z.literal('grants'), z.literal('clubs'), z.literal('general')]),
  bias: z.array(z.number()).length(labels.length),
  weights: z.array(z.array(z.number()).length(dimensions)).length(labels.length),
});
const predictionSchema = z.strictObject({
  label,
  confidence: z.number().min(0).max(1),
  margin: z.number().min(0).max(1),
});
const minimumConfidence = 0.45;
const minimumMargin = 0.12;

function loadModel(): z.infer<typeof modelSchema> | undefined {
  try {
    return modelSchema.parse(JSON.parse(readFileSync(new URL('./category-model.json', import.meta.url), 'utf8')));
  } catch {
    return undefined;
  }
}

const model = loadModel();

export function classifyCategory(query: string): z.infer<typeof predictionSchema> | null {
  if (!model) throw new Error('Category model unavailable');
  const features = categoryFeatures(query);
  if (!features.length) return null;
  const ranked = probabilities(features, model.weights, model.bias)
    .map((confidence, index) => ({label: labels[index]!, confidence}))
    .sort((a, b) => b.confidence - a.confidence);
  const [first, second] = ranked;
  return {...first!, margin: first!.confidence - second!.confidence};
}

type Mode = 'model' | 'explicit' | 'clarification' | 'rules-fallback';

export function resolveRecommendationIntent(query: string, infer: (query: string) => unknown = classifyCategory): {intent: Intent; mode: Mode} {
  const rules = parseIntentRules(query);
  const clarify = {intent: clarification, mode: 'clarification'} as const;
  if (!rules || (!rules.category && hasUnresolvedCategoryConstraint(query))) return clarify;
  const categoryFromRules = rules.category ??
    (rules.need === 'sports-activities' || rules.need === 'creative-development' ? 'clubs' : null);

  let prediction: z.infer<typeof predictionSchema> | null;
  try {
    const result = infer(query);
    prediction = result === null ? null : predictionSchema.parse(result);
  } catch {
    return {intent: {...rules, category: categoryFromRules}, mode: 'rules-fallback'};
  }

  if (categoryFromRules) return {intent: {...rules, category: categoryFromRules}, mode: 'explicit'};
  if (!prediction || prediction.confidence < minimumConfidence || prediction.margin < minimumMargin) return clarify;
  const category = prediction.label === 'general' ? null : prediction.label;
  const intent = {...rules, category};
  if (Object.values(intent).every(value => value === null)) return clarify;
  return {intent, mode: 'model'};
}
