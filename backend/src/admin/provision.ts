import { z } from 'zod';
import { parseDatabaseEnvironment } from '../db/config.ts';
import { createDatabasePool } from '../db/pool.ts';
import { hashPassword } from './password.ts';
import { loginInput } from './routes.ts';

// Offline operator command only: no registration API, default account or password arguments.
let pool: ReturnType<typeof createDatabasePool> | undefined;
try {
  if (process.argv.length !== 3 || process.argv[2] !== '--create' || process.stdin.isTTY) throw new Error('Invalid invocation');
  const expected = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/).parse(process.env.ADMIN_PROVISION_DATABASE);
  if (expected === 'balaqoldau_db') throw new Error('Forbidden target');
  const config = parseDatabaseEnvironment(process.env);
  if (decodeURIComponent(new URL(config.DATABASE_URL).pathname.slice(1)) !== expected) throw new Error('Target mismatch');
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (Buffer.byteLength(input) > 2048) throw new Error('Input too large');
  }
  const credentials = loginInput.parse(JSON.parse(input));
  const role = z.enum(['editor', 'reviewer', 'admin']).default('editor').parse(process.env.ADMIN_PROVISION_ROLE);
  if ([...credentials.password].length < 15) throw new Error('Invalid password');
  pool = createDatabasePool(config);
  const identity = await pool.query<{ name: string }>('SELECT current_database() AS name');
  if (identity.rows[0]?.name !== expected) throw new Error('Target mismatch');
  const hash = await hashPassword(credentials.password);
  await pool.query(`WITH created AS (INSERT INTO balaqoldau.admin_users(email,password_hash,role)
    VALUES($1,$2,$3) RETURNING id,role)
    INSERT INTO balaqoldau.admin_audit_log(event,target_id,new_role) SELECT 'admin.created',id,role FROM created`,
  [credentials.email, hash, role]);
  console.info('Administrator created.');
} catch {
  console.error('Administrator creation failed: check invocation, configuration and database permissions.');
  process.exitCode = 1;
} finally {
  await pool?.end().catch(() => { process.exitCode = 1; });
}
