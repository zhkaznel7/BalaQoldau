import type { PoolClient } from 'pg';
import type { RetentionMode, RetentionOptions } from './config.ts';
import { retentionOptionsSchema } from './config.ts';

export interface RetentionSummary {
  mode: RetentionMode; retentionDays: number; batchSize: number;
  eligible: number; wouldDelete: number; deleted: number;
}

// Caller supplies one transaction-scoped client; the CLI commits only after success.
export async function cleanupContactBatch(client: Pick<PoolClient, 'query'>, input: RetentionOptions, mode: RetentionMode): Promise<RetentionSummary> {
  const parsed = retentionOptionsSchema.safeParse(input);
  if (!parsed.success || !['dry-run', 'execute'].includes(mode)) throw new Error('Invalid retention configuration');
  const options = parsed.data;
  const identity = await client.query<{ database: string; cutoff: string }>(`SELECT current_database() AS database,
    to_char((CURRENT_TIMESTAMP - ($1::integer * INTERVAL '24 hours')) AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cutoff`, [options.days]);
  const context = identity.rows[0];
  if (context?.database !== options.expectedDatabase || typeof context.cutoff !== 'string' || !Number.isFinite(Date.parse(context.cutoff))) {
    throw new Error('Retention database identity check failed');
  }
  if (mode === 'execute') {
    const lock = await client.query<{ acquired: boolean }>('SELECT pg_try_advisory_xact_lock($1) AS acquired', [73402832]);
    if (lock.rows[0]?.acquired !== true) throw new Error('Retention cleanup is already running');
  }
  // Preserve full PostgreSQL microsecond precision; never round the boundary in JS.
  const counted = await client.query<{ count: string }>(`SELECT count(*)::text AS count
    FROM balaqoldau.contact_messages WHERE created_at < $1::timestamptz`, [context.cutoff]);
  const eligible = Number(counted.rows[0]?.count);
  if (!Number.isSafeInteger(eligible) || eligible < 0) throw new Error('Invalid retention count');
  let deleted = 0;
  if (mode === 'execute') {
    const result = await client.query(`WITH candidates AS (
      SELECT id FROM balaqoldau.contact_messages WHERE created_at < $1::timestamptz
      ORDER BY created_at, id LIMIT $2::integer
    ) DELETE FROM balaqoldau.contact_messages AS target USING candidates
      WHERE target.id = candidates.id AND target.created_at < $1::timestamptz`, [context.cutoff, options.batchSize]);
    const count = result.rowCount;
    if (count === null || !Number.isSafeInteger(count) || count < 0 || count > options.batchSize) throw new Error('Retention batch limit exceeded');
    deleted = count;
  }
  return { mode, retentionDays: options.days, batchSize: options.batchSize,
    eligible, wouldDelete: Math.min(eligible, options.batchSize), deleted };
}
