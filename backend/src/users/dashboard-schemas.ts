import { z } from 'zod';
const optionalText = z.string().refine(value => [...value].every(character=>{const code=character.charCodeAt(0);return code>=32&&(code<127||code>159);}))
  .transform(value => value.normalize('NFC').trim().replace(/\s+/gu,' '))
  .refine(value => [...value].length <= 100).transform(value => value || null).nullable();
export const profileInput = z.strictObject({fullName:optionalText,location:optionalText});
export const savedStatusQuery = z.strictObject({ids:z.string().max(1849).transform(value=>value.split(','))
  .pipe(z.array(z.uuid()).min(1).max(50)).transform(values=>[...new Set(values)])});
export type ProfileInput = z.infer<typeof profileInput>;
