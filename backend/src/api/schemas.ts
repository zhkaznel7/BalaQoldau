import { z } from 'zod';
import { HttpError } from '../middleware/errors.ts';

const integer = (minimum: number, maximum: number) => z.string().regex(/^(0|[1-9]\d*)$/)
  .transform(Number).pipe(z.number().int().min(minimum).max(maximum));
const slug = z.string().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const emptyInput = z.strictObject({});
export const paginationQuery = z.strictObject({
  page: integer(1, 10000).default(1),
  limit: integer(1, 50).default(20),
});
export const programQuery = paginationQuery.extend({
  category: slug.optional(),
  region: slug.optional(),
  age: integer(0, 17).optional(),
  q: z.string().trim().max(200).regex(/^[^\u0000-\u001f\u007f]*$/).optional(),
});
export const programParams = z.strictObject({ id: z.uuid() });
export const contactBody = z.strictObject({
  senderName: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f]+$/),
  email: z.email().max(254),
  message: z.string().trim().min(1).max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/),
});
export type Pagination = z.infer<typeof paginationQuery>;
export type ProgramFilters = z.infer<typeof programQuery>;
export type ContactInput = z.infer<typeof contactBody>;

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request input.');
  return result.data;
}
