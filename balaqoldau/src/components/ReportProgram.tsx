import {useUser} from '../account/context';
import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {api} from '../api/service';
import {ApiError} from '../api/client';
import type {ReportInput} from '../api/client';
import {tr} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
const reasons:Record<ReportInput['reason'],string>={incorrect:'m400',outdated:'m401',source_broken:'m402',other:'m403'};
export default function ReportProgram({programId}:{programId:string}){
 useUi();const {session,api:accountApi}=useUser();const [reason,setReason]=useState<ReportInput['reason']>('incorrect'),[explanation,setExplanation]=useState(''),[pending,setPending]=useState(false),[success,setSuccess]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null),feedback=useRef<HTMLParagraphElement>(null);
 useEffect(()=>()=>request.current?.abort(),[]);useEffect(()=>{if(success||error)feedback.current?.focus();},[success,error]);
 async function submit(e:FormEvent){
  e.preventDefault();if(request.current)return;setError('');setSuccess(false);
  const value=explanation.trim();if(value.length>1000||[...value].some(c=>{const n=c.charCodeAt(0);return (n<32&&![9,10,13].includes(n))||n===127;})){setError('m033');return;}
  const controller=new AbortController();request.current=controller;setPending(true);
  try{await (session?.authenticated?accountApi:api).report(programId,{reason,explanation:value||null},controller.signal);if(!controller.signal.aborted){setSuccess(true);setExplanation('');}}
  catch(e){if(!controller.signal.aborted)setError(e instanceof ApiError&&[400,404,429].includes(e.status)?e.message:'m417');}
  finally{if(!controller.signal.aborted)setPending(false);if(request.current===controller)request.current=null;}
 }
 return <details className="program-report"><summary>{tr('m407')}</summary><p id="report-privacy">{tr('m406')}{session?.authenticated&&<> {tr('m494')}</>}</p>
  <form onSubmit={e=>void submit(e)} noValidate aria-describedby="report-privacy" aria-busy={pending}>
   <label htmlFor="public-report-reason">{tr('m398')}</label><select id="public-report-reason" disabled={pending} value={reason} onChange={e=>setReason(e.target.value as ReportInput['reason'])}>{Object.entries(reasons).map(([key,value])=><option value={key} key={key}>{tr(value)}</option>)}</select>
   <label htmlFor="public-report-explanation">{tr('m399')}</label><textarea id="public-report-explanation" rows={4} maxLength={1000} disabled={pending} value={explanation} onChange={e=>setExplanation(e.target.value)}/>
   <button className="button" disabled={pending||success}>{pending?tr('m248'):tr('m404')}</button>
   {(success||error)&&<p ref={feedback} tabIndex={-1} role={success?'status':'alert'}>{success?tr('m405'):tr(error)}</p>}
  </form>
 </details>;
}
