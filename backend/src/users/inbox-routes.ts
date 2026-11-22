import type {Request,Response} from 'express';
import type {Database} from '../api/repository.ts';
import {createRepository,publicProgramIds} from '../api/repository.ts';
import {contactBody,reportBody,programParams,paginationQuery,validate} from '../api/schemas.ts';
import {HttpError} from '../middleware/errors.ts';
import {programTransaction} from '../admin/program-transaction.ts';
import {userRepository} from './repository.ts';

export async function handleUserInbox(req:Request,res:Response,db:Database,token:string,csrf:()=>void){
 const result=await programTransaction(db,async client=>{
  const session=await userRepository(client).session(token);
  if(!session?.userId)throw new HttpError(401,'UNAUTHENTICATED','Authentication required.');
  if(req.path==='/messages'&&req.method==='GET'){
   const p=validate(paginationQuery,req.query);
   const row=(await client.query<{data:unknown[];total:number}>(`WITH owned AS(
    SELECT r.id,r.body AS text,r.created_at AS "createdAt",'contact' AS kind FROM balaqoldau.inbox_replies r
     JOIN balaqoldau.contact_messages c ON c.id=r.contact_id WHERE c.user_id=$1
    UNION ALL SELECT r.id,r.body,r.created_at,'report' FROM balaqoldau.inbox_replies r
     JOIN balaqoldau.program_reports p ON p.id=r.report_id WHERE p.user_id=$1)
    SELECT (SELECT count(*)::int FROM owned) AS total,COALESCE((SELECT json_agg(page) FROM
     (SELECT * FROM owned ORDER BY "createdAt" DESC,id LIMIT $2 OFFSET $3)page),'[]') AS data`,[session.userId,p.limit,(p.page-1)*p.limit])).rows[0]!;
   return {status:200,payload:{data:row.data,pagination:{...p,total:row.total,totalPages:Math.ceil(row.total/p.limit)}}};
  }
  if(req.method!=='POST')throw new HttpError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
  csrf();
  if(req.path==='/contact-messages')return {status:201,payload:{data:await createRepository(client).contact(validate(contactBody,req.body),session.userId)}};
  const match=/^\/programs\/([^/]+)\/reports$/.exec(req.path);
  if(!match)throw new HttpError(404,'NOT_FOUND','Not found.');
  const {id}=validate(programParams,{id:match[1]}),input=validate(reportBody,req.body);
  const inserted=await client.query(`INSERT INTO balaqoldau.program_reports(program_id,reason,explanation,user_id)
   SELECT id,$2,$3,$4 FROM (${publicProgramIds}) available WHERE id=$1 RETURNING id`,[id,input.reason,input.explanation??null,session.userId]);
  if(!inserted.rows.length)throw new HttpError(404,'NOT_FOUND','Program not found.');
  return {status:202,payload:{data:{accepted:true}}};
 });
 res.status(result.status).json(result.payload);
}
