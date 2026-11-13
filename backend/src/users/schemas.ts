import { z } from 'zod';

export const emailInput = z.email().max(254).transform(value => value.toLowerCase());
export const passwordInput = z.string().refine(value => [...value].length >= 8 && Buffer.byteLength(value) <= 256,
  'Invalid password length.');
export const loginInput = z.strictObject({ email: emailInput, password: passwordInput });
export const registerInput = z.strictObject({ email: emailInput, password: passwordInput, language: z.enum(['kk','ru']).default('kk') });
export const tokenInput = z.string().regex(/^[a-f0-9]{64}$/);
export const resetInput = z.strictObject({ token: tokenInput, password: passwordInput });
export const resetRequestInput = z.strictObject({ email: emailInput });
export const emptyInput = z.strictObject({});
