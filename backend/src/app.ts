import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { Config } from './config/env.ts';
import { errorHandler, HttpError } from './middleware/errors.ts';
import { healthRouter } from './routes/health.ts';
import { apiRouter } from './api/routes.ts';
import type { Database } from './api/repository.ts';

export function createApp(config: Config, database?: Database) {
  const app = express();
  app.disable('x-powered-by');
  app.set('env', config.NODE_ENV);
  // Enable only behind a same-host proxy that overwrites forwarding headers.
  app.set('trust proxy', config.TRUST_PROXY_LOOPBACK ? 'loopback' : false);
  app.use(helmet());
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cors({
    origin(value, callback) {
      // Origin-less clients (health probes, curl) are allowed; CORS is not authentication.
      if (value === undefined || config.CORS_ALLOWED_ORIGINS.includes(value)) {
        callback(null, true);
      } else {
        callback(new HttpError(403, 'CORS_FORBIDDEN', 'Origin is not allowed.'));
      }
    },
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    preflightContinue: true,
  }));
  app.use('/api', rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'RATE_LIMITED', 'Too many requests.')),
  }));
  app.use('/api', (request, response, next) => {
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true, inflate: false }));
  app.use('/api', healthRouter);
  app.use('/api', apiRouter(database));
  app.use((_request, _response, next) => next(new HttpError(404, 'NOT_FOUND', 'Route not found.')));
  app.use(errorHandler);
  return app;
}
