import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Database } from '../api/repository.ts';
import {verificationDashboard,verificationHistory} from './verification-repository.ts';
import {verificationFlags} from './verification-policy.ts';
import {matchingToday} from '../matching/engine.ts';
import {validate,programParams,paginationQuery} from '../api/schemas.ts';
import { HttpError } from '../middleware/errors.ts';
import type { Permission } from './authorization.ts';
import { adminRepository } from './repository.ts';
import { programTransaction } from './program-transaction.ts';
import { createProgramInput, updateProgramInput, transitionInput, programListInput,reviewInput,decisionInput,confirmationInput } from './program-schemas.ts';
import type { Action } from './program-schemas.ts';
import { programActor, getAdminProgram, listAdminPrograms, createAdminProgram, updateAdminProgram, transitionAdminProgram, adminProgramTaxonomy } from './program-repository.ts';

export async function handlePrograms(request: Request, response: Response, db: Database, token: string | undefined,
  authorize: (permission: Permission) => Promise<{ id: string; role: unknown }>, csrf: () => Promise<void>,reviewDays=180) {
  const dashboard=request.method==='GET'&&request.path==='/programs/dashboard';
  const history=request.method==='GET'?/^\/programs\/([^/]+)\/history$/.exec(request.path):null;
  const taxonomy = request.method === 'GET' && request.path === '/programs/taxonomy';
  const match = taxonomy||dashboard||history ? null : /^\/programs\/([^/]+)(?:\/(submit|approve|reject|publish|unpublish|archive|reopen|request-recheck))?$/.exec(request.path);
  const action = match?.[2] as Action | undefined;
  if (request.path !== '/programs' && !match && !taxonomy&&!dashboard&&!history) throw new HttpError(404, 'NOT_FOUND', 'Route not found.');
  const permission: Permission = request.method === 'GET' ? 'programs:read'
    : action === 'approve' || action === 'reject' ? 'programs:review'
      : action === 'publish' || action === 'unpublish'||action==='archive'||action==='request-recheck' ? 'programs:publish' : 'programs:draft:write';
  const principal = await authorize(permission);
  if (request.method !== 'GET') await csrf();
  const id = match ? z.uuid().safeParse(match[1]) : undefined;
  if (id && !id.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid program ID.');
  try {
    const result = await programTransaction(db, async client => {
      const actor = await programActor(client, token!, permission);
      if(dashboard)return {data:await verificationDashboard(client,reviewDays)};
      if(history){const {id}=validate(programParams,{id:history[1]});await getAdminProgram(client,id);const p=paginationQuery.parse(request.query);return verificationHistory(client,id,p.page,p.limit);}
      if (taxonomy) return { data: await adminProgramTaxonomy(client) };
      if (request.method === 'GET' && !action) {
        if (id?.success){const p=await getAdminProgram(client,id.data),flags=verificationFlags(p,reviewDays,matchingToday());return {data:{...p,...flags,needsReverification:!!p.sourceNeedsRecheck||(['verified','published'].includes(p.status)&&flags.needsReverification)}};}
        const query = programListInput.parse(request.query);
        return listAdminPrograms(client,query,reviewDays);
      }
      if (request.method === 'POST' && request.path === '/programs') {
        const input = createProgramInput.safeParse(request.body);
        if (!input.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid program input.');
        return { data: await createAdminProgram(client, actor.id, input.data) };
      }
      if (request.method === 'PATCH' && id?.success && !action) {
        const input = updateProgramInput.safeParse(request.body);
        if (!input.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid program input.');
        return { data: await updateAdminProgram(client, actor, id.data, input.data) };
      }
      if (request.method === 'POST' && id?.success && action) {
        const input = (action==='approve'?reviewInput:action==='reject'||action==='request-recheck'?decisionInput:action==='publish'||action==='archive'?confirmationInput:transitionInput).safeParse(request.body);
        if (!input.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid transition input.');
        return { data: await transitionAdminProgram(client, actor, id.data, action, input.data.version,input.data,reviewDays) };
      }
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method is not allowed.');
    });
    response.status(request.method === 'POST' && request.path === '/programs' ? 201 : 200).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) await adminRepository(db).audit('rbac.denied', principal.id, permission);
      throw error;
    }
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (['23505','40001','40P01','55P03'].includes(String(code))) throw new HttpError(409, 'PROGRAM_CONFLICT', 'Program conflict; reload before retry.');
    if (['23503','23514','22007','22008','22001'].includes(String(code))) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid program input or taxonomy.');
    throw error;
  }
}
