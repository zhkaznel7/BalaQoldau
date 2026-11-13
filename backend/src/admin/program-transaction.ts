import { Pool } from 'pg';
import type { Database } from '../api/repository.ts';
import { transaction } from '../db/pool.ts';
import { randomUUID } from 'node:crypto';

const queues = new WeakMap<Database, Promise<void>>();
// Production owns a pool transaction. Integration tests already own a rollback transaction.
export async function programTransaction<T>(db: Database, work: (client: Database) => Promise<T>): Promise<T> {
  if (db instanceof Pool) return transaction(db, work);
  if (!('release' in db) || typeof db.release !== 'function') throw new Error('Transaction connection required');
  const previous = queues.get(db) ?? Promise.resolve();
  let unlock!: () => void;
  const pending = new Promise<void>(resolve => { unlock = resolve; });
  queues.set(db, pending);
  await previous;
  const point = 'program_' + randomUUID().replaceAll('-', '');
  try {
    await db.query('SAVEPOINT ' + point);
    try { const result = await work(db); await db.query('RELEASE SAVEPOINT ' + point); return result; }
    catch (error) { await db.query('ROLLBACK TO SAVEPOINT ' + point); await db.query('RELEASE SAVEPOINT ' + point); throw error; }
  } finally { unlock(); if (queues.get(db) === pending) queues.delete(db); }
}
