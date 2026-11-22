import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { DatabaseConfig } from './config.ts';

export function createDatabasePool(config: DatabaseConfig): Pool {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.DB_SSL_MODE === 'verify-full' ? { rejectUnauthorized: true } : false,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 12000,
    lock_timeout: 5000,
    application_name: 'balaqoldau',
  });
  pool.on('error', () => console.error('Database pool error'));
  return pool;
}

export async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path = pg_catalog');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally { client.release(discard); }
}
