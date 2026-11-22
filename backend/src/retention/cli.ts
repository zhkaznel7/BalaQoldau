import { parseRetentionEnvironment, parseRetentionMode } from './config.ts';
import { cleanupContactBatch } from './cleanup.ts';
import { createDatabasePool, transaction } from '../db/pool.ts';

try {
  const mode = parseRetentionMode(process.argv.slice(2));
  const config = parseRetentionEnvironment(process.env);
  const pool = createDatabasePool(config.database);
  const report = await transaction(pool, async client => {
    if (mode === 'dry-run') await client.query('SET TRANSACTION READ ONLY');
    return cleanupContactBatch(client, config, mode);
  }).finally(() => pool.end());
  // Counts/configuration only; no IDs, timestamps, connection strings or personal data.
  console.info(JSON.stringify(report));
} catch {
  console.error('Contact cleanup failed: check mode, configuration, database identity, permissions and availability');
  process.exitCode = 1;
}
