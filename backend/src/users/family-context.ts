import {z} from 'zod';
const supportNeeds=z.array(z.enum(['education-support','creative-development','sports-activities'])).max(3).refine(v=>new Set(v).size===v.length);
const childFields={disabilitySupportEligible:z.boolean().nullable().optional(),supportNeeds:supportNeeds.optional()};
export const childFamilyContext=z.strictObject(childFields).nullable().optional();
export const parentFamilyContext=z.strictObject({...childFields,childrenCount:z.number().int().min(0).max(30).nullable().optional(),singleParent:z.boolean().nullable().optional(),largeFamily:z.boolean().nullable().optional()}).nullable().optional();
// Reuse the existing single-need matcher only for an explicit, unambiguous choice.
// Household flags never establish a source-verified legal rule.
export function selectedSupportNeed(context:unknown):string|undefined {
 const result=childFamilyContext.safeParse(context);
 const needs=result.success?result.data?.supportNeeds:undefined;
 return needs?.length===1?needs[0]:undefined;
}
