import type { Request,Response } from 'express';
import type { Database } from '../api/repository.ts';
import { HttpError } from '../middleware/errors.ts';
import { paginationQuery,programParams,validate } from '../api/schemas.ts';
import { emptyInput } from './schemas.ts';
import { profileInput,savedStatusQuery } from './dashboard-schemas.ts';
import { dashboardRepository } from './dashboard-repository.ts';

export async function handleDashboard(request:Request,response:Response,db:Database,token:string|undefined,checkCsrf:()=>void) {
  if(!token)throw new HttpError(401,'UNAUTHENTICATED','Authentication required.');
  const repo=dashboardRepository(db),unauthorized=()=>new HttpError(401,'UNAUTHENTICATED','Authentication required.');
  if(request.path==='/profile') {
    if(request.method==='GET') {const result=await repo.profile(token);if(!result)throw unauthorized();response.json({data:result});return;}
    if(request.method==='PATCH') {checkCsrf();const result=await repo.update(token,validate(profileInput,request.body));if(!result)throw unauthorized();response.json({data:result});return;}
  }
  if(request.path==='/saved-programs'&&request.method==='GET') {
    const pagination=validate(paginationQuery,request.query),result=await repo.saved(token,pagination);
    if(!result?.authorized)throw unauthorized();
    response.json({data:result.data,pagination:{...pagination,total:result.total,totalPages:Math.ceil(result.total/pagination.limit)}});return;
  }
  if(request.path==='/saved-programs/status'&&request.method==='GET') {
    const {ids}=validate(savedStatusQuery,request.query),result=await repo.status(token,ids);
    if(!result?.authorized)throw unauthorized();response.json({data:result.ids});return;
  }
  const match=/^\/saved-programs\/([^/]+)$/.exec(request.path);
  if(match&&['POST','DELETE'].includes(request.method)) {
    const {id}=validate(programParams,{id:match[1]});checkCsrf();validate(emptyInput,request.body);
    const result=request.method==='POST'?await repo.save(token,id):await repo.remove(token,id);
    if(!result?.authorized)throw unauthorized();
    if('available' in result&&!result.available)throw new HttpError(404,'PROGRAM_UNAVAILABLE','Program unavailable.');
    response.status(204).end();return;
  }
  throw new HttpError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
}
