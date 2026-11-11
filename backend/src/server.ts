import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { parseEnvironment } from './config/env.ts';
import { parseDatabaseEnvironment } from './db/config.ts';
import { createDatabasePool } from './db/pool.ts';

try {
  const config = parseEnvironment(process.env);
  const pool = config.DATABASE_URL ? createDatabasePool(parseDatabaseEnvironment(process.env)) : undefined;
  const server = createServer(createApp(config, pool));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.listen(config.PORT, config.HOST, () => console.info('Backend listening'));
  server.on('error', () => {
    console.error('Backend server failed');
    process.exitCode = 1;
    void pool?.end().catch(() => console.error('Database shutdown failed'));
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      console.error('Backend shutdown timed out');
      server.closeAllConnections();
      process.exitCode = 1;
    }, 10000);
    deadline.unref();
    server.close(async error => {
      try {
        await pool?.end();
        process.exitCode = error ? 1 : (process.exitCode ?? 0);
      } catch {
        console.error('Database shutdown failed');
        process.exitCode = 1;
      } finally { clearTimeout(deadline); }
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch {
  console.error('Backend startup failed: check environment configuration');
  process.exitCode = 1;
}
