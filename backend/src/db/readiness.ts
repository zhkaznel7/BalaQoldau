import type { Pool, PoolClient } from 'pg';

export type ReadinessCheck = () => Promise<boolean>;
export const READINESS_TIMEOUT_MS = 2000;
// A connection alone is insufficient when migrations/view permissions are missing.
const probeSql = 'SELECT id FROM balaqoldau.published_programs LIMIT 0';

export function createReadinessCheck(pool?: Pick<Pool, 'connect'>, timeoutMs = READINESS_TIMEOUT_MS): ReadinessCheck {
  let pending: Promise<boolean> | undefined;
  return () => {
    if (!pool) return Promise.resolve(false);
    if (pending) return pending;
    // Promise's executor assigns synchronously, before any timer/async work starts.
    let settle!: (ready: boolean) => void;
    const result = new Promise<boolean>(resolve => { settle = resolve; });
    pending = result;
    let expired = false;
    let client: PoolClient | undefined;
    const release = (destroy: boolean) => {
      const acquired = client;
      client = undefined;
      acquired?.release(destroy);
    };
    const deadline = setTimeout(() => {
      expired = true;
      release(true);
      settle(false);
    }, timeoutMs);
    void (async () => {
      try {
        const acquired = await pool.connect();
        if (expired) { acquired.release(true); return; }
        client = acquired;
        await client.query(probeSql);
        if (!expired) { release(false); settle(true); }
      } catch {
        release(true);
        settle(false);
      } finally {
        clearTimeout(deadline);
        // Retain the failed shared result until a timed-out checkout/query settles.
        pending = undefined;
      }
    })();
    return result;
  };
}
