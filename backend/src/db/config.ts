import { z } from 'zod';

export const databaseUrlSchema = z.string().refine(value => {
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname)
      && Boolean(url.username) && /^\/[^/]+$/.test(url.pathname)
      && !url.search && !url.hash;
  } catch { return false; }
});

const schema = z.object({
  DATABASE_URL: databaseUrlSchema,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DB_SSL_MODE: z.enum(['disable', 'verify-full']).optional(),
}).transform(value => ({ ...value, DB_SSL_MODE: value.DB_SSL_MODE ?? (value.NODE_ENV === 'production' ? 'verify-full' : 'disable') }))
  .refine(value => value.NODE_ENV !== 'production' || value.DB_SSL_MODE === 'verify-full');

export type DatabaseConfig = z.infer<typeof schema>;

export function parseDatabaseEnvironment(input: NodeJS.ProcessEnv): DatabaseConfig {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('Invalid database configuration');
  return result.data;
}

export function parseTestDatabaseEnvironment(input: NodeJS.ProcessEnv): DatabaseConfig {
  if (input.DATABASE_URL !== undefined && !databaseUrlSchema.safeParse(input.DATABASE_URL).success) {
    throw new Error('Invalid database configuration');
  }
  const config = parseDatabaseEnvironment({ ...input, NODE_ENV: 'test', DATABASE_URL: input.TEST_DATABASE_URL });
  const testUrl = new URL(config.DATABASE_URL);
  if (!/^\/[a-z0-9_]+_test$/.test(decodeURIComponent(testUrl.pathname))
    // Reject the same database name even via a hostname alias or different credentials.
    || (input.DATABASE_URL && decodeURIComponent(testUrl.pathname) === decodeURIComponent(new URL(input.DATABASE_URL).pathname))) {
    throw new Error('Dedicated TEST_DATABASE_URL ending in _test is required');
  }
  return config;
}
