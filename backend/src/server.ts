import { parseEnvironment } from './config/env.ts';
import { parseDatabaseEnvironment } from './db/config.ts';
import { createDatabasePool } from './db/pool.ts';
import { startServer } from './lifecycle.ts';

try {
  const config = parseEnvironment(process.env);
  const pool = config.DATABASE_URL ? createDatabasePool(parseDatabaseEnvironment(process.env)) : undefined;
  const { server, shutdown } = await startServer(config, pool);
  const stop = () => {
    void shutdown().catch(() => {
      console.error('Backend shutdown failed');
      process.exit(1);
    });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  server.on('error', () => {
    console.error('Backend server failed');
    process.exitCode = 1;
    stop();
  });
  console.info('Backend listening');
} catch {
  console.error('Backend startup failed: check environment configuration or database availability');
  process.exitCode = 1;
}
