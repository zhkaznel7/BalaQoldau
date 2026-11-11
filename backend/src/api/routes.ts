import { Router } from 'express';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Database } from './repository.ts';
import { createRepository } from './repository.ts';
import { contactBody, emptyInput, paginationQuery, programParams, programQuery, validate } from './schemas.ts';
import { HttpError } from '../middleware/errors.ts';

export function apiRouter(database?: Database) {
  const router = Router();
  const repository = () => {
    if (!database) throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Database service is unavailable.');
    return createRepository(database);
  };
  const methods = (allow: string): RequestHandler => (_request, response, next) => {
    response.setHeader('Allow', allow);
    next(new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method is not allowed.'));
  };
  router.route('/programs').get(async (request, response) => {
    const filters = validate(programQuery, request.query);
    response.json(await repository().programs(filters));
  }).all(methods('GET, HEAD, OPTIONS'));
  router.route('/programs/:id').get(async (request, response) => {
    const { id } = validate(programParams, request.params);
    validate(emptyInput, request.query);
    const program = await repository().program(id);
    if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
    response.json({ data: program });
  }).all(methods('GET, HEAD, OPTIONS'));
  for (const path of ['categories', 'regions'] as const) {
    router.route(`/${path}`).get(async (request, response) => {
      const pagination = validate(paginationQuery, request.query);
      response.json(await repository()[path](pagination));
    }).all(methods('GET, HEAD, OPTIONS'));
  }
  const contactLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'RATE_LIMITED', 'Too many requests.')),
  });
  router.route('/contact-messages').post(contactLimit, async (request, response) => {
    validate(emptyInput, request.query);
    if (!request.is('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected application/json.');
    const input = validate(contactBody, request.body);
    response.status(201).json({ data: await repository().contact(input) });
  }).all(methods('POST, OPTIONS'));
  return router;
}
