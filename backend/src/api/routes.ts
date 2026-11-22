import { Router } from 'express';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Database } from './repository.ts';
import { createRepository, publicProgramIds } from './repository.ts';
import { contactBody, emptyInput, paginationQuery, programParams, programQuery, validate } from './schemas.ts';
import { HttpError } from '../middleware/errors.ts';
import {matchingQuery,matchingDetailsQuery} from './schemas.ts';
import {findMatches} from '../matching/repository.ts';
import {reportBody} from './schemas.ts';
import {z} from 'zod';
import {conversationContext, conversationIntent, nextQuestion} from '../ai/conversation.ts';
import {clarification, providerCues} from '../ai/intent.ts';
import type {OpenAIInterpreter} from '../ai/openai.ts';
import {recommendationSuggestions} from '../matching/repository.ts';

const recommendationBody = z.strictObject({query: z.string().trim().min(1).max(400), consent: z.literal(true),
  context: conversationContext.nullable().optional(), openAIConsent: z.boolean().optional()});

export function apiRouter(reviewDays: number, database?: Database, interpreter?: OpenAIInterpreter, developmentDiagnostics = false) {
  const router = Router();
  const repository = () => {
    if (!database) throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Database service is unavailable.');
    return createRepository(database);
  };
  const methods = (allow: string): RequestHandler => (_request, response, next) => {
    response.setHeader('Allow', allow);
    next(new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method is not allowed.'));
  };
  const aiLimit = rateLimit({
    windowMs: 60_000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'RATE_LIMITED', 'Too many requests.')),
  });
  router.route('/ai/suggestions').get(async (request, response) => {
    validate(emptyInput, request.query);
    response.json({data: database ? await recommendationSuggestions(database, reviewDays) : []});
  }).all(methods('GET, HEAD, OPTIONS'));
  router.route('/ai/recommendations').post(aiLimit, async (request, response) => {
    validate(emptyInput, request.query);
    if (!request.is('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected application/json.');
    const {query, context, openAIConsent} = validate(recommendationBody, request.body);
    const local = conversationIntent(query, context);
    let {intent} = local;
    let followUp: typeof local.followUp | 'need' = local.followUp;
    let provider: 'openai' | 'unavailable' | undefined;
    let style: 'direct' | 'warm' | undefined;
    let diagnostic = openAIConsent ? 'skipped-deterministic' : 'skipped-no-consent';
    if (openAIConsent && !interpreter) {
      provider = 'unavailable';
      diagnostic = 'fallback-unconfigured';
    }
    const askAboutClub = intent.category === 'clubs' && !intent.need && !context;
    if (openAIConsent && interpreter && (followUp || askAboutClub || local.mode === 'clarification')) {
      const cues = providerCues(query);
      diagnostic = 'skipped-no-cues';
      if (cues.some(cue => cue.field !== 'relation')) {
        const controller = new AbortController();
        const cancel = () => controller.abort();
        response.once('close', cancel);
        try {
          const reply = await interpreter(cues, controller.signal);
          const current = local.followUp === 'clarify' ? clarification : intent;
          const updated = {
            age: current.age ?? reply.intent.age ?? context?.age ?? null,
            region: current.region ?? reply.intent.region ?? context?.region ?? null,
            category: current.category ?? reply.intent.category ?? context?.category ?? null,
            need: current.need ?? reply.intent.need ?? context?.need ?? null,
          };
          // Keep ambiguous local turns in clarification when the model found no usable cues.
          if (local.followUp !== 'clarify' || Object.values(reply.intent).some(value => value !== null)) {
            intent = updated;
            followUp = context === undefined ? undefined : nextQuestion(intent);
            if (context === null && !followUp && intent.category === 'clubs' && !intent.need && reply.askActivity) followUp = 'need';
          }
          provider = 'openai';
          diagnostic = 'openai';
          style = reply.style;
        } catch (error) {
          provider = 'unavailable';
          const status = error instanceof Error && 'status' in error ? error.status : undefined;
          diagnostic = status === 401 || status === 403 ? 'fallback-auth'
            : status === 429 ? 'fallback-quota-or-rate-limit' : 'fallback-error';
        } finally {
          response.off('close', cancel);
        }
        if (response.destroyed) return;
      }
    }
    response.setHeader('X-Recommendation-Mode', provider === 'openai' ? 'openai' : local.mode);
    if (developmentDiagnostics) response.setHeader('X-Recommendation-Provider', diagnostic);
    if (followUp || Object.values(intent).every(value => value === null)) {
      response.json({intent, data: [], followUp, provider, style});
      return;
    }
    if (!database) throw new HttpError(503, 'AI_UNAVAILABLE', 'Catalog search is unavailable.');
    const {data} = await findMatches(database, {
      age: intent.age ?? undefined, region: intent.region ?? undefined, need: intent.need ?? undefined,
      category: intent.category ?? undefined, page: 1, limit: 5, recommendationReviewDays: reviewDays,
    });
    response.json({intent, data, followUp, provider, style});
  }).all(methods('POST, OPTIONS'));
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
      SELECT id,$2,$3 FROM (${publicProgramIds}) available WHERE id=$1 RETURNING 1 AS accepted`,[id,input.reason,input.explanation??null]);
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
