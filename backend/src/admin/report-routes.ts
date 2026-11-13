import type {Request,Response} from 'express';
import {z} from 'zod';
import type {Database} from '../api/repository.ts';
import {validate,programParams,paginationQuery} from '../api/schemas.ts';
import {HttpError} from '../middleware/errors.ts';
import {programTransaction} from './program-transaction.ts';
import {programActor} from './program-repository.ts';
export const reportListQuery=paginationQuery.extend({status:z.enum(['open','reviewed','resolved','dismissed']).optional(),programId:z.uuid().optional()});
const change=z.strictObject({version:z.number().int().min(1).max(2147483646),status:z.enum(['reviewed','resolved','dismissed'])});
export async function handleReports(req:Request,res:Response,db:Database,token:string,csrf:()=>Promise<void>){
 if(req.method!=='GET')await csrf();
 const result=await programTransaction(db,async client=>{
   const actor=await programActor(client,token,'programs:review');
   if(req.method==='GET'&&req.path==='/reports'){
     const p=validate(reportListQuery,req.query);
     const row=(await client.query<{total:number;data:unknown[]}>(`WITH entries AS(SELECT r.id,r.program_id AS "programId",p.title AS "programTitle",r.reason,r.explanation,r.status,r.version,
       r.created_at AS "createdAt",r.updated_at AS "updatedAt" FROM balaqoldau.program_reports r JOIN balaqoldau.programs p ON p.id=r.program_id
       WHERE ($1::text IS NULL OR r.status=$1) AND ($2::uuid IS NULL OR r.program_id=$2))
       SELECT (SELECT count(*)::int FROM entries) AS total,COALESCE((SELECT json_agg(items) FROM
         (SELECT * FROM entries ORDER BY "createdAt" DESC,id LIMIT $3 OFFSET $4)items),'[]') AS data`,[p.status??null,p.programId??null,p.limit,(p.page-1)*p.limit])).rows[0]!;
     return {data:row.data,pagination:{...p,total:row.total,totalPages:Math.ceil(row.total/p.limit)}};
   }
   const match=/^\/reports\/([^/]+)$/.exec(req.path);
   if(req.method!=='POST'||!match)throw new HttpError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
   const {id}=validate(programParams,{id:match[1]}),input=validate(change,req.body);
   const current=(await client.query<{status:string;version:number}>('SELECT status,version FROM balaqoldau.program_reports WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!current)throw new HttpError(404,'NOT_FOUND','Report unavailable.');
   if(current.version!==input.version||!(current.status==='open'&&input.status==='reviewed'||current.status==='reviewed'&&['resolved','dismissed'].includes(input.status)||actor.role==='admin'&&['resolved','dismissed'].includes(current.status)&&input.status==='reviewed'))throw new HttpError(409,'PROGRAM_CONFLICT','Report changed or transition invalid.');
   await client.query('UPDATE balaqoldau.program_reports SET status=$2,version=version+1,moderated_by=$3,updated_at=clock_timestamp() WHERE id=$1',[id,input.status,actor.id]);
   await client.query("INSERT INTO balaqoldau.admin_audit_log(event,actor_id,target_id,permission) VALUES($1,$2,$3,'programs:review')",['report.'+input.status,actor.id,id]);
   return {data:{id,status:input.status,version:input.version+1}};
 });res.json(result);
}
