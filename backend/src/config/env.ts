import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { databaseUrlSchema } from '../db/config.ts';

const integer = (fallback: string, maximum: number) => z.string().regex(/^\d+$/)
  .default(fallback).transform(Number).pipe(z.number().int().min(1).max(maximum));

const origin = z.string().refine(value => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && url.origin === value;
  } catch {
    return false;
  }
}, 'Expected an exact HTTP(S) origin without credentials, path, or wildcard');

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1').refine(value => isIP(value) !== 0),
  PORT: integer('3001', 65535),
  TRUST_PROXY_LOOPBACK: z.enum(['false', 'true']).default('false').transform(value => value === 'true'),
  CORS_ALLOWED_ORIGINS: z.string().transform(value => value.split(',').map(item => item.trim()))
    .pipe(z.array(origin).min(1)).transform(values => [...new Set(values)]),
  RATE_LIMIT_WINDOW_MS: integer('60000', 2147483647),
  RATE_LIMIT_MAX: integer('100', 100000),
  PROGRAM_REVIEW_DAYS: integer('180',730).refine(value=>value>=7),
  OPENAI_API_KEY: z.string().trim().max(512).transform(value => value || undefined).optional(),
  OPENAI_MODEL: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/).default('gpt-5.4-nano'),
  DATABASE_URL: databaseUrlSchema.optional(),
  ADMIN_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  ADMIN_ORIGIN: origin.optional(),
  ADMIN_SESSION_SECONDS: integer('3600', 28800).refine(value => value >= 300),
  USER_AUTH_ENABLED: z.enum(['true','false']).default('false').transform(value => value === 'true'),
  USER_ORIGIN: origin.optional(),
  USER_SESSION_SECONDS: integer('3600', 86400).refine(value => value >= 300),
  USER_RESET_SECONDS: integer('1800', 3600).refine(value => value >= 300),
  USER_MAIL_COMMAND: z.string().refine(value => isAbsolute(value)).optional(),
  USER_MAIL_FROM: z.email().max(254).optional(),
}).superRefine((value, context) => {
  if (value.USER_AUTH_ENABLED && (!value.DATABASE_URL || !value.USER_ORIGIN)) {
    context.addIssue({ code: 'custom', path: ['USER_AUTH_ENABLED'], message: 'Database and user origin required' });
  }
  if (value.USER_AUTH_ENABLED && value.NODE_ENV === 'production' && !value.USER_ORIGIN?.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['USER_ORIGIN'], message: 'HTTPS required' });
  }
  if (Boolean(value.USER_MAIL_COMMAND) !== Boolean(value.USER_MAIL_FROM)) {
    context.addIssue({ code: 'custom', path: ['USER_MAIL_COMMAND'], message: 'Mail command and from address required together' });
  }
  if (value.ADMIN_ENABLED && (!value.DATABASE_URL || !value.ADMIN_ORIGIN)) {
    context.addIssue({ code: 'custom', path: ['ADMIN_ENABLED'], message: 'Database and admin origin required' });
  }
  if (value.ADMIN_ENABLED && value.NODE_ENV === 'production' && !value.ADMIN_ORIGIN?.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['ADMIN_ORIGIN'], message: 'HTTPS required' });
  }
  if (value.NODE_ENV !== 'production') return;
  if (!value.DATABASE_URL) context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required in production' });
  if (value.CORS_ALLOWED_ORIGINS.some(item => !item.startsWith('https://'))) {
    context.addIssue({ code: 'custom', path: ['CORS_ALLOWED_ORIGINS'], message: 'HTTPS required in production' });
  }
});

export type Config = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Config {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map(issue => String(issue.path[0])))];
    // Never include environment values or Zod's full error in logs.
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return result.data;
}
