import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from './pool.ts';

// Trusted, reviewed repository SQL only. No HTTP/user-controlled SQL or filenames.
const directory = new URL('../../migrations/', import.meta.url);
export async function runMigrations(pool: Pool): Promise<number> {
  const names = (await readdir(directory)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!names.length || new Set(names.map(name => name.slice(0, 3))).size !== names.length) {
    throw new Error('Invalid migration inventory');
  }
  const files = await Promise.all(names.map(async name => {
    const sql = (await readFile(new URL(name, directory), 'utf8')).replace(/\r\n/g, '\n');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
  return transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [73402831]);
    await client.query('CREATE SCHEMA IF NOT EXISTS balaqoldau');
    await client.query('REVOKE ALL ON SCHEMA balaqoldau FROM PUBLIC');
    await client.query(`CREATE TABLE IF NOT EXISTS balaqoldau.schema_migrations (
      version text PRIMARY KEY, checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ version: string; checksum: string }>('SELECT version, checksum FROM balaqoldau.schema_migrations ORDER BY version');
    for (const row of applied.rows) {
      if (!files.some(file => file.name === row.version && file.checksum === row.checksum)) {
        throw new Error('Migration history mismatch; restore original migration files');
      }
    }
    let count = 0;
    for (const file of files) {
      if (applied.rows.some(row => row.version === file.name)) continue;
      // Static DDL cannot be parameterized; all data values below are parameters.
      await client.query(file.sql);
      await client.query('INSERT INTO balaqoldau.schema_migrations(version, checksum) VALUES ($1, $2)', [file.name, file.checksum]);
      count++;
    }
    return count;
  });
}
