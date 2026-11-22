import type {Request,Response} from 'express';
import {z} from 'zod';
import type {Database} from '../api/repository.ts';
import {programParams,validate} from '../api/schemas.ts';
import {HttpError} from '../middleware/errors.ts';
import {programTransaction} from './program-transaction.ts';
import {programActor} from './program-repository.ts';
import type {ReplyDelivery} from '../users/mail.ts';

export const replyInput=z.strictObject({submissionId:z.uuid(),text:z.string().trim().min(1).max(2000).refine(value=>![...value].some(c=>{const n=c.charCodeAt(0);return(n<32&&![9,10,13].includes(n))||(n>=127&&n<=159);}))});
const fields=`id,admin_id AS "adminId",body AS text,delivery_status AS "deliveryStatus",created_at AS "createdAt",delivered_at AS "deliveredAt"`;
// SQL identifiers below are exclusively selected from these internal constants, never request data.
export async function handleReplies(req:Request,res:Response,db:Database,token:string,csrf:()=>Promise<void>,deliver?:ReplyDelivery){
 const match=/^\/(contact-messages|reports)\/([^/]+)\/replies$/.exec(req.path);
 if(!match)throw new HttpError(404,'NOT_FOUND','Not found.');
 const {id}=validate(programParams,{id:match[2]}),contact=match[1]==='contact-messages';
 const table=contact?'contact_messages':'program_reports',column=contact?'contact_id':'report_id',permission=contact?'contacts:manage':'programs:review';
 if(!['GET','POST'].includes(req.method))throw new HttpError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
 if(req.method==='POST')await csrf();
 const input=req.method==='POST'?validate(replyInput,req.body):null;
 const result=await programTransaction(db,async client=>{
  const actor=await programActor(client,token,permission);
  const parent=(await client.query<{user_id:string|null;email?:string}>(`SELECT user_id${contact?',email':''} FROM balaqoldau.${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
  if(!parent)throw new HttpError(404,'NOT_FOUND','Not found.');
  if(!input)return {data:(await client.query(`SELECT ${fields} FROM balaqoldau.inbox_replies WHERE ${column}=$1 ORDER BY created_at DESC,id LIMIT 50`,[id])).rows};
  const previous=(await client.query<{id:string;body:string;admin_id:string;target:string}>(`SELECT id,body,admin_id,${column} AS target FROM balaqoldau.inbox_replies WHERE submission_id=$1`,[input.submissionId])).rows[0];
  if(previous){
   if(previous.target!==id||previous.body!==input.text||previous.admin_id!==actor.id)throw new HttpError(409,'REPLY_CONFLICT','Reply identifier cannot be reused.');
   return {data:(await client.query(`SELECT ${fields} FROM balaqoldau.inbox_replies WHERE id=$1`,[previous.id])).rows[0]};
  }
  const row=(await client.query<{id:string}>(`INSERT INTO balaqoldau.inbox_replies(${column},admin_id,submission_id,body,delivery_status,delivered_at)
   VALUES($1,$2,$3,$4,$5,CASE WHEN $5='account' THEN clock_timestamp() END) RETURNING ${fields}`,[id,actor.id,input.submissionId,input.text,parent.user_id?'account':'saved_not_delivered'])).rows[0]!;
  await client.query('INSERT INTO balaqoldau.admin_audit_log(event,actor_id,target_id,permission) VALUES($1,$2,$3,$4)',[contact?'contact.replied':'report.replied',actor.id,id,permission]);
  return {data:row,...(!parent.user_id&&contact&&deliver?{dispatch:{email:parent.email!,text:input.text,replyId:row.id,actorId:actor.id}}:{})};
 });
 // Persist first. Replaying a submission never dispatches a second email. No background retries.
 if('dispatch' in result&&result.dispatch){
  const d=result.dispatch;
  try{
   await deliver!(d.email,d.text);
   await programTransaction(db,async client=>{
    await client.query("UPDATE balaqoldau.inbox_replies SET delivery_status='email_accepted',delivered_at=clock_timestamp() WHERE id=$1 AND delivery_status='saved_not_delivered'",[d.replyId]);
    await client.query("INSERT INTO balaqoldau.admin_audit_log(event,actor_id,target_id,permission) VALUES('contact.reply_email_accepted',$1,$2,'contacts:manage')",[d.actorId,id]);
   });
   result.data=(await db.query(`SELECT ${fields} FROM balaqoldau.inbox_replies WHERE id=$1`,[d.replyId])).rows[0];
  }catch{/* Saved, not confirmed delivered; never log recipient, body, or process errors. */}
 }
 res.status(input?201:200).json({data:result.data});
}
