import { z } from 'zod';
import { databaseUrlSchema, parseDatabaseEnvironment } from '../db/config.ts';

const databaseName = z.string().min(1).max(63).regex(/^[a-z][a-z0-9_]*$/)
  .refine(value => !['balaqoldau_db', 'postgres', 'template0', 'template1'].includes(value));
export const retentionOptionsSchema = z.object({
  expectedDatabase: databaseName,
  days: z.number().int().min(30).max(365),
  batchSize: z.number().int().min(1).max(1000),
});
export type RetentionOptions = z.infer<typeof retentionOptionsSchema>;
export type RetentionMode = 'dry-run' | 'execute';
const integer = (fallback: string) => z.string().regex(/^[1-9]\d*$/).default(fallback).transform(Number);
const environment = z.object({
  RETENTION_DATABASE_URL: databaseUrlSchema,
  RETENTION_EXPECTED_DATABASE: databaseName,
  RETENTION_DAYS: integer('30'),
  RETENTION_BATCH_SIZE: integer('100'),
});

export function parseRetentionEnvironment(input: NodeJS.ProcessEnv) {
  const result = environment.safeParse(input);
  if (!result.success) throw new Error('Invalid retention configuration');
  const value = result.data;
  const options = retentionOptionsSchema.safeParse({ expectedDatabase: value.RETENTION_EXPECTED_DATABASE,
    days: value.RETENTION_DAYS, batchSize: value.RETENTION_BATCH_SIZE });
  if (!options.success || decodeURIComponent(new URL(value.RETENTION_DATABASE_URL).pathname.slice(1)) !== options.data.expectedDatabase) {
    throw new Error('Invalid retention configuration');
  }
  return { ...options.data, database: parseDatabaseEnvironment({ ...input, DATABASE_URL: value.RETENTION_DATABASE_URL }) };
}

export function parseRetentionMode(args: string[]): RetentionMode {
  if (args.length === 1 && args[0] === '--dry-run') return 'dry-run';
  if (args.length === 1 && args[0] === '--execute') return 'execute';
  throw new Error('Choose exactly one retention mode');
}
