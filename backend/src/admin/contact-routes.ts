import type {Request,Response} from 'express';
import {z} from 'zod';
import type {Database} from '../api/repository.ts';
import {paginationQuery,programParams,validate} from '../api/schemas.ts';
import {HttpError} from '../middleware/errors.ts';
import {programTransaction} from './program-transaction.ts';
import {programActor} from './program-repository.ts';
export const contactListQuery=paginationQuery.extend({status:z.enum(['unread','read','resolved']).optional()});
export const contactChange=z.strictObject({version:z.number().int().min(1).max(2147483646),status:z.enum(['unread','read','resolved'])});
const fields=`EXISTS(SELECT 1 FROM balaqoldau.inbox_replies r WHERE r.contact_id=contact_messages.id) AS replied,id,sender_name AS "senderName",email,status,version,created_at AS "createdAt",updated_at AS "updatedAt"`;
export async function handleContacts(req:Request,res:Response,db:Database,token:string,csrf:()=>Promise<void>){
 if(req.method!=='GET')await csrf();
 const result=await programTransaction(db,async client=>{
  const actor=await programActor(client,token,'contacts:manage');
  const log=async(event:string,id:string|null)=>{await client.query("INSERT INTO balaqoldau.admin_audit_log(event,actor_id,target_id,permission) VALUES($1,$2,$3,'contacts:manage')",[event,actor.id,id]);};
  if(req.path==='/contact-messages'&&req.method==='GET'){
   const p=validate(contactListQuery,req.query);
   const row=(await client.query<{data:unknown[];total:number;unreadCount:number}>(`WITH entries AS(SELECT ${fields},left(message,160) AS preview FROM balaqoldau.contact_messages WHERE ($1::text IS NULL OR status=$1))
    SELECT (SELECT count(*)::int FROM entries) AS total,(SELECT count(*)::int FROM balaqoldau.contact_messages WHERE status='unread') AS "unreadCount",
    COALESCE((SELECT json_agg(items) FROM (SELECT * FROM entries ORDER BY "createdAt" DESC,id LIMIT $2 OFFSET $3)items),'[]') AS data`,[p.status??null,p.limit,(p.page-1)*p.limit])).rows[0]!;
   await log('contact.inbox_viewed',null);return {data:row.data,unreadCount:row.unreadCount,pagination:{page:p.page,limit:p.limit,total:row.total,totalPages:Math.ceil(row.total/p.limit)}};
  }
  const match=/^\/contact-messages\/([^/]+)$/.exec(req.path);
  if(!match)throw new HttpError(404,'NOT_FOUND','Message not found.');
  const {id}=validate(programParams,{id:match[1]});
  const row=(await client.query<{id:string;status:string;version:number}>(`SELECT ${fields},message FROM balaqoldau.contact_messages WHERE id=$1${req.method==='POST'?' FOR UPDATE':''}`,[id])).rows[0];
  if(!row)throw new HttpError(404,'NOT_FOUND','Message not found.');
  if(req.method==='GET'){await log('contact.viewed',id);return {data:row};}
  if(req.method!=='POST')throw new HttpError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
  const input=validate(contactChange,req.body);
  const allowed=row.status==='unread'?input.status==='read':row.status==='read'?['unread','resolved'].includes(input.status):input.status==='read';
  if(row.version!==input.version||!allowed)throw new HttpError(409,'CONTACT_CONFLICT','Message changed or transition invalid.');
  const updated=(await client.query(`UPDATE balaqoldau.contact_messages SET status=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${fields},message`,[id,input.status])).rows[0];
  await log(input.status==='resolved'?'contact.resolved':input.status==='read'&&row.status==='unread'?'contact.read':'contact.reopened',id);
  return {data:updated};
 });res.json(result);
}
