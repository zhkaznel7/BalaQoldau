import { Router } from 'express';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Database } from './repository.ts';
import { createRepository } from './repository.ts';
import { contactBody, emptyInput, paginationQuery, programParams, programQuery, validate } from './schemas.ts';
import { HttpError } from '../middleware/errors.ts';
import {matchingQuery,matchingDetailsQuery} from './schemas.ts';
import {findMatches} from '../matching/repository.ts';
import {reportBody} from './schemas.ts';

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
  router.route('/program-matches').get(async(request,response)=>{
    const filters=validate(matchingQuery,request.query);repository();
    response.setHeader('Cache-Control','no-store');response.json(await findMatches(database!,filters));
  }).all(methods('GET, HEAD, OPTIONS'));
  router.route('/program-matches/:id').get(async(request,response)=>{
    const {id}=validate(programParams,request.params),input=validate(matchingDetailsQuery,request.query);repository();
    const result=await findMatches(database!,{...input,page:1,limit:1},id);
    if(!result.data[0])throw new HttpError(404,'NOT_FOUND','Program not found.');
    response.setHeader('Cache-Control','no-store');response.json({data:result.data[0]});
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
  router.route('/family-categories').get(async(request,response)=>{
    const pagination=validate(paginationQuery,request.query);response.json(await repository().familyCategories(pagination));
  }).all(methods('GET, HEAD, OPTIONS'));
  const contactLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'RATE_LIMITED', 'Too many requests.')),
  });
  const reportLimit=rateLimit({windowMs:900000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,
    handler:(_req,_res,next)=>next(new HttpError(429,'RATE_LIMITED','Too many requests.'))});
  router.route('/programs/:id/reports').post(reportLimit,async(req,res)=>{
    const {id}=validate(programParams,req.params);validate(emptyInput,req.query);
    if(!req.is('application/json'))throw new HttpError(415,'UNSUPPORTED_MEDIA_TYPE','Expected application/json.');
    const input=validate(reportBody,req.body);repository();
    const result=await database!.query(`INSERT INTO balaqoldau.program_reports(program_id,reason,explanation)
      SELECT id,$2,$3 FROM balaqoldau.published_programs WHERE id=$1 RETURNING 1 AS accepted`,[id,input.reason,input.explanation??null]);
    if(!result.rows.length)throw new HttpError(404,'NOT_FOUND','Program not found.');
    res.status(202).json({data:{accepted:true}});
  }).all(methods('POST, OPTIONS'));
  router.route('/contact-messages').post(contactLimit, async (request, response) => {
    validate(emptyInput, request.query);
    if (!request.is('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected application/json.');
    const input = validate(contactBody, request.body);
    response.status(201).json({ data: await repository().contact(input) });
  }).all(methods('POST, OPTIONS'));
  return router;
}
