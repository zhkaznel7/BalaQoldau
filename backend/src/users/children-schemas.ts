import {z} from 'zod';
import {childFamilyContext} from './family-context.ts';
const slug=z.string().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const fields={
  fullName:z.string().max(200).refine(v=>!/\p{Cc}/u.test(v)).transform(v=>v.normalize('NFC').trim().replace(/\s+/gu,' '))
    .refine(v=>[...v].length<=100&&(!v||/^[\p{L}\p{M} .’'-]+$/u.test(v))).transform(v=>v||null).nullable().optional(),
  gender:z.enum(['female','male']).nullable().optional(),
  interests:z.array(z.enum(['education','creativity','sports'])).max(3).refine(v=>new Set(v).size===v.length).transform(v=>v.sort()).optional(),
  familyContext:childFamilyContext,
  nickname:z.string().max(100).refine(v=>[...v].every(c=>{const n=c.charCodeAt(0);return n>=32&&(n<127||n>159);}))
    .transform(v=>v.normalize('NFC').trim().replace(/\s+/gu,' '))
    .refine(v=>[...v].length<=30&&(!v||/^[\p{L}\p{M}\p{N} ._-]+$/u.test(v))&&!/\d{8}/u.test(v))
    .transform(v=>v||null).nullable(),
  age:z.number().int().min(0).max(17),region:slug,
  preferences:z.array(slug).max(10).refine(v=>new Set(v).size===v.length),
};
export const childInput=z.strictObject({...fields,nickname:fields.nickname.default(null),preferences:fields.preferences.default([])});
export const childUpdate=z.strictObject({...fields,version:z.number().int().min(1).max(2147483646)});
export const childDelete=z.strictObject({version:z.number().int().min(1).max(2147483647),confirm:z.literal(true)});
export type ChildInput=z.infer<typeof childInput>;
