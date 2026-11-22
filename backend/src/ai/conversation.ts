import {z} from 'zod';
import {resolveRecommendationIntent} from './classifier.ts';
import {clarification, hasUnresolvedCategoryConstraint, intentRegions, parseIntentRules} from './intent.ts';
import type {Intent} from './intent.ts';
import {publicCategorySlugs} from '../api/public-categories.ts';

export const activityNeeds = ['education-support', 'creative-development', 'sports-activities'] as const;
export const conversationContext = z.strictObject({
  age: z.number().int().min(0).max(17).nullable(),
  region: z.enum(intentRegions).nullable(),
  category: z.enum(publicCategorySlugs).nullable(),
  need: z.enum(activityNeeds).nullable(),
});

export function nextQuestion(intent: Intent) {
  if (!intent.category) return 'category';
  if (!intent.region) return 'region';
  return intent.age === null ? 'age' : null;
}

export function conversationIntent(query: string, context: Intent | null | undefined) {
  const result = resolveRecommendationIntent(query);
  if (context === undefined) return {...result, followUp: undefined};
  const parsed = parseIntentRules(query);
  if (!parsed || (!parsed.category && hasUnresolvedCategoryConstraint(query))) {
    return {...result, intent: context ?? clarification, followUp: 'clarify' as const};
  }
  const ageAnswer = /^(?:[0-9]|1[0-7])$/u.test(query) ? Number(query) : null;
  const age = parsed.age ?? ageAnswer ?? context?.age ?? null;
  const region = parsed.region ?? context?.region ?? null;
  const category = result.intent.category ?? context?.category ?? null;
  const need = parsed.need ?? (category === context?.category ? context.need : null);
  const intent = {age, region, category, need};
  if (!Object.values(intent).some(value => value !== null)) return {...result, intent, followUp: 'clarify' as const};
  if (context && !result.intent.category && parsed.age === null && parsed.region === null && parsed.need === null && ageAnswer === null) {
    return {...result, intent: context, followUp: 'clarify' as const};
  }
  return {...result, intent, followUp: nextQuestion(intent)};
}
