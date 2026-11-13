import { z } from 'zod';
import { paginationQuery } from '../api/schemas.ts';

const text = (max: number) => z.string().trim().min(1).max(max).refine(value => [...value].every(char => {
  const code = char.charCodeAt(0);
  return code !== 127 && (code >= 32 || [9, 10, 13].includes(code));
}));
const slug = z.string().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const slugs = z.array(slug).max(50).refine(values => new Set(values).size === values.length);
const url = z.string().max(2048).refine(value => {
  try { const parsed = new URL(value); return parsed.protocol === 'https:' && !!parsed.hostname && !parsed.username && !parsed.password && !/\s/.test(value); }
  catch { return false; }
}).nullable();
const fields = z.strictObject({
  slug: z.string().max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), category: slug,
  title: text(240), description: text(10000), sourceUrl: url, sourceName: text(200).nullable(),
  applyUrl: url, ageMin: z.number().int().min(0).max(17), ageMax: z.number().int().min(0).max(17),
  expiresOn:z.iso.date().nullable().optional(),deadline: z.iso.date().nullable(), regions: slugs, familyCategories: slugs, eligibilityComplete:z.boolean().optional(),
});
export const createProgramInput = fields.extend({ isDemo: z.boolean().default(false),
  sourceUrl: url.default(null), sourceName: text(200).nullable().default(null), applyUrl: url.default(null),
  ageMin: z.number().int().min(0).max(17).default(0), ageMax: z.number().int().min(0).max(17).default(17),
  deadline: z.iso.date().nullable().default(null), regions: slugs.default([]), familyCategories: slugs.default([]),
}).refine(value => value.ageMin <= value.ageMax);
export const updateProgramInput = fields.partial().extend({ version: z.number().int().min(1).max(2147483646) })
  .refine(value => Object.keys(value).length > 1)
  .refine(value => value.ageMin === undefined || value.ageMax === undefined || value.ageMin <= value.ageMax);
export const transitionInput = z.strictObject({ version: z.number().int().min(1).max(2147483646) });
export const confirmationInput=transitionInput.extend({confirm:z.literal(true)});
export const programListInput = paginationQuery.extend({ status:z.enum(['draft','pending','review','verified','published','rejected','archived']).transform(v=>v==='pending'?'review':v).optional(),q:text(200).optional(),category:slug.optional(),region:slug.optional(),verifiedFrom:z.iso.date().optional(),verifiedTo:z.iso.date().optional(),expiration:z.enum(['active','expired']).optional(),needsReview:z.enum(['true']).optional() }).refine(v=>!v.verifiedFrom||!v.verifiedTo||v.verifiedFrom<=v.verifiedTo);
export type CreateProgram = z.infer<typeof createProgramInput>;
export type UpdateProgram = z.infer<typeof updateProgramInput>;
export const reviewInput=transitionInput.extend({sourceReviewed:z.literal(true),informationReviewed:z.literal(true),eligibilityReviewed:z.literal(true),notes:text(1000).optional()});
export const decisionInput=transitionInput.extend({notes:text(1000)});
export type ReviewDecision={version?:number;sourceReviewed?:boolean;informationReviewed?:boolean;eligibilityReviewed?:boolean;notes?:string};
export type Action = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish' | 'archive' | 'reopen' | 'request-recheck';
