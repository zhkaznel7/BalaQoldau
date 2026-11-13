import express, { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Config } from '../config/env.ts';
import type { Database } from '../api/repository.ts';
import { HttpError } from '../middleware/errors.ts';
import { adminRepository, randomToken } from './repository.ts';
import { verifyPassword } from './password.ts';
import { hasPermission, permissionsFor } from './authorization.ts';
import type { Permission } from './authorization.ts';
import { paginationQuery } from '../api/schemas.ts';
import { programListInput } from './program-schemas.ts';
import { handlePrograms } from './program-routes.ts';
import {handleReports,reportListQuery} from './report-routes.ts';
import {handleReplies} from './reply-routes.ts';
import {replyDelivery} from '../users/mail.ts';
import type {ReplyDelivery} from '../users/mail.ts';
import {handleContacts,contactListQuery} from './contact-routes.ts';

const empty = z.strictObject({});
export const loginInput = z.strictObject({ email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).refine(value => Buffer.byteLength(value) <= 256) });
const denied = () => new HttpError(401, 'UNAUTHENTICATED', 'Authentication required.');
export function adminRouter(config: Config, database?: Database, deliver:ReplyDelivery|undefined=replyDelivery(config)) {
  const router = Router();
  const production = config.NODE_ENV === 'production';
  const name = production ? '__Host-balaqoldau_admin' : 'balaqoldau_admin';
  const cookie = { httpOnly: true, secure: production, sameSite: 'strict' as const, path: production ? '/' : '/api/admin' };
  router.use((request, _response, next) => {
    if (!config.ADMIN_ENABLED) throw new HttpError(404, 'NOT_FOUND', 'Route not found.');
    if (production && !request.secure) throw new HttpError(403, 'HTTPS_REQUIRED', 'HTTPS required.');
    const origin = request.get('Origin');
    if ((origin !== undefined && origin !== config.ADMIN_ORIGIN) || request.get('Sec-Fetch-Site') === 'cross-site'
      || (['POST','PATCH'].includes(request.method) && origin !== config.ADMIN_ORIGIN)) throw new HttpError(403, 'CSRF_FORBIDDEN', 'Request is not allowed.');
    const query = request.method === 'GET' && (request.path === '/audit-log'||/^\/programs\/[^/]+\/history$/.test(request.path)) ? paginationQuery
      : request.method==='GET'&&request.path==='/contact-messages'?contactListQuery:request.method==='GET'&&request.path==='/reports'?reportListQuery:request.method === 'GET' && request.path === '/programs' ? programListInput : empty;
    if (!query.safeParse(request.query).success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request input.');
    next();
  });
  // Reading a session/list must not consume the sensitive-write/login budget.
  // Both remain IP bounded, in addition to the existing global /api limiter.
  const reads=rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false,
    handler:(_req,_res,next)=>next(new HttpError(429,'RATE_LIMITED','Too many requests.'))});
  const writes=rateLimit({ windowMs: 900000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'RATE_LIMITED', 'Too many requests.')) });
  router.use((req,res,next)=>(req.method==='GET'?reads:writes)(req,res,next));
  router.use('/programs', express.json({ limit: '64kb', strict: true, inflate: false }));
  router.use(['/contact-messages','/reports'], express.json({limit:'16kb',strict:true,inflate:false}));
  router.use(express.json({ limit: '2kb', strict: true, inflate: false }));
  const loginLimit = rateLimit({ windowMs: 900000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'RATE_LIMITED', 'Too many requests.')) });
  router.use(async (request, response, next) => {
    if (!['GET', 'POST'].includes(request.method) && !(request.method === 'PATCH' && request.path.startsWith('/programs/'))) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method is not allowed.');
    if (!database) throw new HttpError(503, 'ADMIN_UNAVAILABLE', 'Authentication temporarily unavailable.');
    try {
      const repository = adminRepository(database);
      const values = (request.get('Cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='));
      if (values.length > 1) throw denied();
      const token = values[0]?.slice(name.length + 1);
      if (token !== undefined && !/^[a-f0-9]{64}$/.test(token)) throw denied();
      const session = token ? await repository.session(token) : undefined;
      const authorize = async (permission: Permission) => {
        if (!session?.adminId) {
          await repository.audit('rbac.denied', null, permission);
          throw denied();
        }
        if (!hasPermission(session.role, permission)) {
          await repository.audit('rbac.denied', session.adminId, permission);
          throw new HttpError(403, 'FORBIDDEN', 'Permission denied.');
        }
        return { id: session.adminId, role: session.role };
      };
      const checkCsrf = async () => {
        if (!session || !token) throw denied();
        const csrf = request.get('X-CSRF-Token');
        if (!csrf || !/^[a-f0-9]{64}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))) {
          await repository.audit('security.csrf_denied', session.adminId);
          throw new HttpError(403, 'CSRF_FORBIDDEN', 'Request is not allowed.');
        }
        if (!request.is('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON required.');
      };
      if(request.path==='/contact-messages'||request.path.startsWith('/contact-messages/')){
        const principal=await authorize('contacts:manage');
        try{if(request.path.endsWith('/replies'))await handleReplies(request,response,database,token!,checkCsrf,deliver);else await handleContacts(request,response,database,token!,checkCsrf);}catch(error){
          if(error instanceof HttpError&&[401,403].includes(error.status))await repository.audit('rbac.denied',principal.id,'contacts:manage');throw error;
        }return;
      }
      if(request.path==='/reports'||request.path.startsWith('/reports/')){
        const principal=await authorize('programs:review');
        try{if(request.path.endsWith('/replies'))await handleReplies(request,response,database,token!,checkCsrf,deliver);else await handleReports(request,response,database,token!,checkCsrf);}catch(error){
          if(error instanceof HttpError&&[401,403].includes(error.status))await repository.audit('rbac.denied',principal.id,'programs:review');throw error;
        }return;
      }
      if (request.path === '/programs' || request.path.startsWith('/programs/')) {
        await handlePrograms(request, response, database, token, authorize, checkCsrf,config.PROGRAM_REVIEW_DAYS);
        return;
      }
      if (request.path === '/session' && request.method === 'GET') {
        if (session) response.json({ data: { authenticated: session.adminId !== null, admin: session.adminId ? { id: session.adminId } : null, csrfToken: session.csrf } });
        else {
          const fresh = randomToken(), csrf = randomToken();
          await repository.create(fresh, csrf);
          response.cookie(name, fresh, { ...cookie, maxAge: 600000 });
          response.json({ data: { authenticated: false, admin: null, csrfToken: csrf } });
        }
        return;
      }
      if (request.method === 'GET' && request.path === '/access') {
        const principal = await authorize('programs:read');
        response.json({ data: { ...principal, permissions: permissionsFor(principal.role) } });
        return;
      }
      if (request.method === 'GET' && request.path === '/audit-log') {
        await authorize('audit:read');
        const { page, limit } = paginationQuery.parse(request.query);
        const result = await repository.auditLog(token!, limit, (page - 1) * limit);
        if (!result?.authorized) throw new HttpError(403, 'FORBIDDEN', 'Permission denied.');
        response.json({ data: result.data, pagination: { page, limit } });
        return;
      }
      const roleRoute = /^\/users\/([^/]+)\/role$/.exec(request.path);
      if (request.method !== 'POST' || (!['/login', '/logout'].includes(request.path) && !roleRoute)) throw new HttpError(404, 'NOT_FOUND', 'Route not found.');
      if (!session || !token) {
        if (roleRoute) await repository.audit('rbac.denied', null, 'users:roles:manage');
        throw denied();
      }
      await checkCsrf();
      if (roleRoute) {
        const principal = await authorize('users:roles:manage');
        const target = z.uuid().safeParse(roleRoute[1]);
        const body = z.strictObject({ role: z.enum(['editor', 'reviewer', 'admin']) }).safeParse(request.body);
        if (!target.success || !body.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request input.');
        if (!await repository.changeRole(principal.id, target.data, body.data.role, token)) {
          await repository.audit('rbac.denied', session.adminId, 'users:roles:manage');
          throw new HttpError(403, 'FORBIDDEN', 'Role change is not allowed.');
        }
        response.status(204).end();
        return;
      }
      if (request.path === '/logout') {
        if (!empty.safeParse(request.body).success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request input.');
        await repository.remove(token);
        response.clearCookie(name, cookie).status(204).end();
        return;
      }
      // Apply login limiter before KDF, including successful attempts.
      loginLimit(request, response, async error => {
        if (error) { next(error); return; }
        try {
          const parsed = loginInput.safeParse(request.body);
          if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request input.');
          if (session.adminId) throw new HttpError(409, 'ALREADY_AUTHENTICATED', 'Session already authenticated.');
          const user = await repository.user(parsed.data.email);
          const valid = await verifyPassword(user && !user.disabled ? user.hash : undefined, parsed.data.password);
          if (!valid || !user || user.disabled) {
            await repository.audit('auth.login_failed', null);
            throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
          }
          const fresh = randomToken(), freshCsrf = randomToken();
          if (!await repository.authenticate(token, fresh, freshCsrf, user.id, config.ADMIN_SESSION_SECONDS, user.hash)) throw denied();
          response.cookie(name, fresh, { ...cookie, maxAge: config.ADMIN_SESSION_SECONDS * 1000 });
          response.json({ data: { authenticated: true, admin: { id: user.id }, csrfToken: freshCsrf } });
        } catch (failure) { next(failure instanceof HttpError ? failure : new HttpError(503, 'ADMIN_UNAVAILABLE', 'Authentication temporarily unavailable.')); }
      });
    } catch (error) { next(error instanceof HttpError ? error : new HttpError(503, 'ADMIN_UNAVAILABLE', 'Authentication temporarily unavailable.')); }
  });
  return router;
}
