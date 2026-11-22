import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errors.ts';

const healthQuery = z.strictObject({});
interface HealthResponse { status: 'ok' }

export const healthRouter = Router();
healthRouter.get('/health', (request, response) => {
  if (!healthQuery.safeParse(request.query).success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request input.');
  }
  const body: HealthResponse = { status: 'ok' };
  response.json(body);
});
