import { Router } from 'express';
import type { ReadinessCheck } from '../db/readiness.ts';
import { emptyInput, validate } from '../api/schemas.ts';
import { HttpError } from '../middleware/errors.ts';

export function readinessRouter(check: ReadinessCheck) {
  const router = Router();
  router.get('/ready', async (request, response) => {
    validate(emptyInput, request.query);
    let ready = false;
    try { ready = await check(); } catch { /* Fail closed without logging connection details. */ }
    if (!ready) throw new HttpError(503, 'NOT_READY', 'Service is not ready.');
    response.json({ status: 'ready' });
  });
  return router;
}
