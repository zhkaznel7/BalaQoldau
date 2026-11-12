import { createServer } from 'node:http';
import type { Pool } from 'pg';
import type { Config } from './config/env.ts';
import { createApp } from './app.ts';
import { createReadinessCheck } from './db/readiness.ts';
import { adminDatabaseSafe } from './admin/database-security.ts';

type BackendPool = Pick<Pool, 'query' | 'connect' | 'end'>;

export async function startServer(config: Config, pool?: BackendPool) {
  const check = createReadinessCheck(pool);
  let stopping = false;
  const server = createServer(createApp(config, pool, async () => {
    if (stopping) return false;
    const ready = await check();
    return !stopping && ready;
  }));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  try {
    if (config.NODE_ENV === 'production' && !await check()) throw new Error('Database is not ready');
    if (config.NODE_ENV === 'production' && config.ADMIN_ENABLED && !await adminDatabaseSafe(pool)) throw new Error('Unsafe admin database permissions');
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.PORT, config.HOST, () => { server.removeListener('error', reject); resolve(); });
    });
  } catch {
    await pool?.end().catch(() => {});
    throw new Error('Backend startup failed');
  }
  let closing: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    if (closing) return closing;
    stopping = true;
    closing = new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => {
        server.closeAllConnections();
        reject(new Error('Backend shutdown timed out'));
      }, 10000);
      deadline.unref();
      server.close(async error => {
        try {
          await pool?.end();
          if (error) throw error;
          resolve();
        } catch { reject(new Error('Backend shutdown failed')); }
        finally { clearTimeout(deadline); }
      });
    });
    return closing;
  };
  return { server, shutdown };
}
