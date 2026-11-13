import express, { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import type { Config } from '../config/env.ts';
import type { Database } from '../api/repository.ts';
import { HttpError } from '../middleware/errors.ts';
import { hashUserPassword, verifyPassword } from '../admin/password.ts';
import { userRepository, userToken } from './repository.ts';
import { emptyInput, loginInput, registerInput, resetInput, resetRequestInput } from './schemas.ts';
import { resetDelivery } from './mail.ts';
import type { ResetDelivery } from './mail.ts';
import { paginationQuery } from '../api/schemas.ts';
import { savedStatusQuery } from './dashboard-schemas.ts';
import { handleDashboard } from './dashboard-routes.ts';
import {handleUserInbox} from './inbox-routes.ts';
import {handleChildren} from './children-routes.ts';

const denied = () => new HttpError(401, 'UNAUTHENTICATED', 'Authentication required.');
export function userRouter(config: Config, database?: Database, delivery: ResetDelivery | undefined = resetDelivery(config)) {
  const router = Router(), production = config.NODE_ENV === 'production';
  let resetting = 0;
  const name = production ? '__Host-balaqoldau_user' : 'balaqoldau_user';
  const cookie = { httpOnly: true, secure: production, sameSite: 'strict' as const, path: production ? '/' : '/api/auth' };
  router.use((request, _response, next) => {
    if (!config.USER_AUTH_ENABLED) throw new HttpError(404, request.method==='GET'&&request.path==='/session'?'AUTH_DISABLED':'NOT_FOUND', 'Route not found.');
    if (production && !request.secure) throw new HttpError(403, 'HTTPS_REQUIRED', 'HTTPS required.');
    const origin = request.get('Origin');
    if ((origin !== undefined && origin !== config.USER_ORIGIN) || request.get('Sec-Fetch-Site') === 'cross-site'
      || (['POST','PATCH','DELETE'].includes(request.method) && origin !== config.USER_ORIGIN)) throw new HttpError(403, 'CSRF_FORBIDDEN', 'Request is not allowed.');
    const query=request.method==='GET'&&(request.path==='/saved-programs'||request.path==='/messages'||/^\/children\/[^/]+\/recommendations$/.test(request.path))?paginationQuery:request.method==='GET'&&request.path==='/saved-programs/status'?savedStatusQuery:emptyInput;
    if (!query.safeParse(request.query).success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request input.');
    next();
  });
  const limiter = (limit: number) => rateLimit({ windowMs: 900000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'RATE_LIMITED', 'Too many requests.')) });
  router.use(limiter(120));
  router.post('/login', limiter(5));
  router.post('/register', limiter(5));
  router.post('/password-reset/request', limiter(5));
  router.post('/password-reset/confirm', limiter(5));
  router.post(['/contact-messages','/programs/:id/reports'],limiter(5),express.json({limit:'16kb',strict:true,inflate:false}));
  router.use(express.json({ limit: '2kb', strict: true, inflate: false }));
  router.use(async (request, response, next) => {
    try {
      if (!['GET','POST','PATCH','DELETE'].includes(request.method)) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      if (!database) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication temporarily unavailable.');
      const repository = userRepository(database);
      const cookies = (request.get('Cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='));
      if (cookies.length > 1) throw denied();
      const token = cookies[0]?.slice(name.length + 1);
      if (token !== undefined && !/^[a-f0-9]{64}$/.test(token)) throw denied();
      const session = token ? await repository.session(token) : undefined;
      const profile = session?.userId ? { id: session.userId, email: session.email, language: session.language } : null;
      if (request.method === 'GET' && request.path === '/session') {
        let csrf = session?.csrf;
        if (!session) {
          const fresh = userToken(); csrf = userToken(); await repository.anonymous(fresh, csrf);
          response.cookie(name, fresh, { ...cookie, maxAge: 600000 });
        }
        response.json({ data: { authenticated: !!profile, user: profile, csrfToken: csrf, resetAvailable: !!delivery } });
        return;
      }
      if(request.path==='/messages'||request.path==='/contact-messages'||/^\/programs\/[^/]+\/reports$/.test(request.path)||request.path==='/profile'||request.path==='/saved-programs'||request.path.startsWith('/saved-programs/')||request.path==='/children'||request.path.startsWith('/children/')) {
        if(!profile)throw denied();
        const handle=request.path==='/messages'||request.path==='/contact-messages'||request.path.startsWith('/programs/')?handleUserInbox:request.path==='/children'||request.path.startsWith('/children/')?handleChildren:handleDashboard;
        await handle(request,response,database,token!,()=>{
          const csrf=request.get('X-CSRF-Token');
          if(!csrf||!/^[a-f0-9]{64}$/.test(csrf)||!session||!timingSafeEqual(Buffer.from(csrf),Buffer.from(session.csrf)))throw new HttpError(403,'CSRF_FORBIDDEN','Request is not allowed.');
          if(!request.is('application/json'))throw new HttpError(415,'UNSUPPORTED_MEDIA_TYPE','JSON required.');
        });return;
      }
      if (request.method !== 'POST' || !['/register','/login','/logout','/password-reset/request','/password-reset/confirm'].includes(request.path)) {
        throw new HttpError(404, 'NOT_FOUND', 'Route not found.');
      }
      if (!session || !token) throw denied();
      const csrf = request.get('X-CSRF-Token');
      if (!csrf || !/^[a-f0-9]{64}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))) {
        throw new HttpError(403, 'CSRF_FORBIDDEN', 'Request is not allowed.');
      }
      if (!request.is('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON required.');
      const invalid = (passwordProblem = false) => {
        const password:unknown=request.body?.password;
        if(passwordProblem&&typeof password==='string') {
          if([...password].length<8)return new HttpError(400,'PASSWORD_TOO_SHORT','Password must contain at least 8 characters.');
          if(Buffer.byteLength(password)>256)return new HttpError(400,'PASSWORD_TOO_LONG','Password is too long. Please enter a shorter password.');
        }
        return new HttpError(400,passwordProblem?'PASSWORD_POLICY':'VALIDATION_ERROR','Invalid request input.');
      };
      if (request.path === '/logout') {
        if (!emptyInput.safeParse(request.body).success) throw invalid();
        await repository.logout(token); response.clearCookie(name, cookie).status(204).end(); return;
      }
      if (session.userId) throw new HttpError(409, 'ALREADY_AUTHENTICATED', 'Session already authenticated.');
      if (request.path === '/register') {
        const input = registerInput.safeParse(request.body); if (!input.success) throw invalid(input.error.issues.some(issue => issue.path[0] === 'password'));
        const { email, password, language } = input.data;
        await repository.register(email, await hashUserPassword(password), language);
        // Same outcome for duplicates; never overwrite or disclose an existing account.
        response.status(202).json({ data: { accepted: true } }); return;
      }
      if (request.path === '/login') {
        const input = loginInput.safeParse(request.body); if (!input.success) throw invalid(input.error.issues.some(issue => issue.path[0] === 'password'));
        const candidate = await repository.loginCandidate(input.data.email);
        const valid = await verifyPassword(candidate?.hash, input.data.password);
        if (!candidate || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
        const fresh = userToken(), freshCsrf = userToken();
        if (!await repository.authenticate(token, fresh, freshCsrf, candidate.id, candidate.hash, config.USER_SESSION_SECONDS)) throw denied();
        response.cookie(name, fresh, { ...cookie, maxAge: config.USER_SESSION_SECONDS * 1000 });
        const authenticated = await repository.session(fresh);
        if (!authenticated?.userId) throw denied();
        response.json({ data: { authenticated: true, user: { id: authenticated.userId, email: authenticated.email, language: authenticated.language }, csrfToken: freshCsrf, resetAvailable: !!delivery } }); return;
      }
      if (request.path === '/password-reset/request') {
        const input = resetRequestInput.safeParse(request.body); if (!input.success) throw invalid();
        if (!delivery) throw new HttpError(503, 'RESET_UNAVAILABLE', 'Password reset delivery is not configured.');
        if (resetting >= 2) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests.');
        // Do not make HTTP timing depend on account existence or the local MTA.
        // Bounded best-effort dispatch; acceptance does not promise delivery or durable queueing.
        resetting++;
        void (async () => {
          try {
            const reset = userToken(), recipient = await repository.issueReset(input.data.email, reset, config.USER_RESET_SECONDS);
            if (recipient) await delivery(recipient.email, config.USER_ORIGIN + '/reset-password#token=' + reset);
          } catch { console.error('Password reset delivery failed'); }
          finally { resetting--; }
        })();
        // Accepted is not a delivery assertion, including unknown/limited accounts or MTA failure.
        response.status(202).json({ data: { accepted: true } }); return;
      }
      const input = resetInput.safeParse(request.body); if (!input.success) throw invalid(input.error.issues.some(issue => issue.path[0] === 'password'));
      if (!await repository.reset(input.data.token, await hashUserPassword(input.data.password))) {
        throw new HttpError(400, 'INVALID_RESET', 'Reset link is invalid or expired.');
      }
      await repository.logout(token);
      response.clearCookie(name, cookie).status(204).end();
    } catch (error) { next(error instanceof HttpError ? error : new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication temporarily unavailable.')); }
  });
  return router;
}
