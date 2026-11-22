import ReplyPanel from './ReplyPanel';
import {useCallback,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useAdmin} from './context';
import {AdminError} from './api';
import {statuses} from './types';
import type {ReportStatus} from './types';
import {tr,dateLocale} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import {useResource} from '../hooks/useResource';
import {withoutLanguage} from '../components/language';

function ErrorPanel({error,retry}:{error:Error;retry:()=>void}){useUi();return <div role="alert" className="admin-error"><p>{tr(error.message)}</p><button type="button" onClick={retry}>{tr('m053')}</button></div>;}
export function AdminOverview(){
 useUi();const {api}=useAdmin(),loader=useCallback((_key:string,signal:AbortSignal)=>api.dashboard(signal),[api]),state=useResource('overview',loader);
 return <section><h1>{tr('m368')}</h1>{state.loading?<p role="status">{tr('m280')}</p>:state.error?<ErrorPanel error={state.error} retry={state.retry}/>:state.data&&<>
   <p>{tr('m373',{0:state.data.reviewPeriodDays})}</p><dl className="verification-counts">{Object.entries(state.data.counts).map(([key,value])=><div key={key}><dt><Link to={'/admin/programs'+(key==='total'?'':key==='expired'?'?expiration=expired':key==='needsReverification'?'?needsReview=true':'?status='+key)}>{key==='total'?tr('m369'):key==='expired'?tr('m371'):key==='needsReverification'?tr('m370'):tr(statuses[key as keyof typeof statuses])}</Link></dt><dd>{value}</dd></div>)}</dl>
   <h2>{tr('m372')}</h2>{!state.data.recent.length?<p>{tr('m063')}</p>:<ul>{state.data.recent.map(p=><li key={p.id}><Link to={'/admin/programs/'+p.id}>{p.title}</Link> — {tr(statuses[p.status])} <time dateTime={p.updatedAt}>{new Date(p.updatedAt).toLocaleString(dateLocale())}</time></li>)}</ul>}
 </>}</section>;
}
export function VerificationHistory({id,version}:{id:string;version:number}){
 useUi();const {api}=useAdmin(),[page,setPage]=useState(1),loader=useCallback((_key:string,signal:AbortSignal)=>api.history(id,page,signal),[api,id,page]),state=useResource(id+':'+version+':'+page,loader);
 const decisions={approve:'m141',reject:'m142',recheck:'m367'};
 return <section className="verification-history"><h2>{tr('m387')}</h2>{state.loading?<p role="status">{tr('m280')}</p>:state.error?<ErrorPanel error={state.error} retry={state.retry}/>:!state.data?.data.length?<p>{tr('m388')}</p>:<>
  <ol>{state.data.data.map(e=><li key={e.id}><p><strong>{tr(decisions[e.decision])}</strong> · {tr('m079')} {e.programVersion} · <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString(dateLocale())}</time></p><p>{tr('m389')}: <span className="verification-id">{e.actorId}</span></p><p className="verification-notes">{e.notes}</p></li>)}</ol>
  {state.data.pagination.totalPages>1&&<nav aria-label={tr('m387')}><button disabled={page<=1} onClick={()=>setPage(page-1)}>{tr('m072')}</button><span>{page} / {state.data.pagination.totalPages}</span><button disabled={page>=state.data.pagination.totalPages} onClick={()=>setPage(page+1)}>{tr('m073')}</button></nav>}
 </>}</section>;
}
export function AdditionalFilters(){
 useUi();const {api}=useAdmin(),[params]=useSearchParams(),loader=useCallback((_key:string,signal:AbortSignal)=>api.taxonomy(signal),[api]),state=useResource('filter-taxonomy',loader);
 return <>{state.error&&<ErrorPanel error={state.error} retry={state.retry}/>}<div><label htmlFor="admin-region">{tr('m181')}</label><select id="admin-region" name="region" defaultValue={params.get('region')??''} disabled={state.loading||!!state.error}><option value="">{tr('m379')}</option>{state.data?.regions.map(r=><option key={r.slug} value={r.slug}>{r.name}</option>)}</select></div>
  <div><label htmlFor="admin-category">{tr('m082')}</label><select id="admin-category" name="category" defaultValue={params.get('category')??''} disabled={state.loading||!!state.error}><option value="">{tr('m379')}</option>{state.data?.categories.map(r=><option key={r.slug} value={r.slug}>{r.name}</option>)}</select></div>
  <div><label htmlFor="admin-verified-from">{tr('m375')}</label><input id="admin-verified-from" name="verifiedFrom" type="date" defaultValue={params.get('verifiedFrom')??''}/></div>
  <div><label htmlFor="admin-verified-to">{tr('m376')}</label><input id="admin-verified-to" name="verifiedTo" type="date" defaultValue={params.get('verifiedTo')??''}/></div>
  <div><label htmlFor="admin-expiration">{tr('m377')}</label><select id="admin-expiration" name="expiration" defaultValue={params.get('expiration')??''}><option value="">{tr('m379')}</option><option value="active">{tr('m378')}</option><option value="expired">{tr('m371')}</option></select></div>
  <label className="admin-check"><input type="checkbox" name="needsReview" value="true" defaultChecked={params.get('needsReview')==='true'}/>{tr('m370')}</label>
 </>;
}
export function AdminReports(){useUi();const {access}=useAdmin();return access.permissions.includes('programs:review')?<ReportList/>:<><h1>{tr('m392')}</h1><p role="alert">{tr('m105')}</p></>;}
const reportStates:Record<ReportStatus,string>={open:'m394',reviewed:'m395',resolved:'m396',dismissed:'m397'};
const reasons={incorrect:'m400',outdated:'m401',source_broken:'m402',other:'m403'};
function ReportList(){
 useUi();const {api,access}=useAdmin(),[params,setParams]=useSearchParams(),query=withoutLanguage(params.toString()),loader=useCallback((key:string,signal:AbortSignal)=>api.reports(key,signal),[api]),state=useResource(query,loader);
 const [pending,setPending]=useState(false),[error,setError]=useState<Error|null>(null),[stale,setStale]=useState(false),[success,setSuccess]=useState(false);
 async function moderate(id:string,version:number,status:ReportStatus){if(pending||stale||api.busy())return;setPending(true);setError(null);setSuccess(false);
  try{await api.moderateReport(id,version,status);setSuccess(true);state.retry();}catch(e){const error=e instanceof Error?e:new AdminError(503);setError(error);setStale(error instanceof AdminError&&[0,409].includes(error.status));}finally{setPending(false);}}
 return <section><h1>{tr('m392')}</h1><p>{tr('m384')}</p><form className="admin-filters" onSubmit={e=>{e.preventDefault();const values=new FormData(e.currentTarget);const next=new URLSearchParams();const status=String(values.get('status')||'');if(status)next.set('status',status);setParams(next);setError(null);setStale(false);}}><div><label htmlFor="report-status">{tr('m393')}</label><select id="report-status" name="status" defaultValue={params.get('status')??''}><option value="">{tr('m379')}</option>{Object.entries(reportStates).map(([k,v])=><option value={k} key={k}>{tr(v)}</option>)}</select></div><button>{tr('m059')}</button></form>
 {success&&<p role="status">{tr('m076')}</p>}{error&&<ErrorPanel error={error} retry={()=>{setError(null);setStale(false);state.retry();}}/>}
 {state.loading?<p role="status">{tr('m280')}</p>:state.error?<ErrorPanel error={state.error} retry={state.retry}/>:!state.data?.data.length?<p>{tr('m408')}</p>:<><ol className="report-list">{state.data.data.map(r=><li key={r.id}><h2><Link to={'/admin/programs/'+r.programId}>{r.programTitle}</Link></h2><p>{tr(reasons[r.reason])} · {tr(reportStates[r.status])}</p><p className="verification-notes">{r.explanation}</p><ReplyPanel kind="reports" id={r.id} replied={r.replied}/>
 <div className="admin-actions">{r.status==='open'||access.role==='admin'&&['resolved','dismissed'].includes(r.status)?<button disabled={pending||stale} onClick={()=>void moderate(r.id,r.version,'reviewed')}>{tr('m409')}</button>:r.status==='reviewed'?<><button disabled={pending||stale} onClick={()=>void moderate(r.id,r.version,'resolved')}>{tr('m410')}</button><button disabled={pending||stale} onClick={()=>void moderate(r.id,r.version,'dismissed')}>{tr('m411')}</button></>:null}</div></li>)}</ol>
 {state.data.pagination.totalPages>1&&<nav aria-label={tr('m392')}><button disabled={state.data.pagination.page<=1} onClick={()=>{const n=new URLSearchParams(params);n.set('page',String(state.data!.pagination.page-1));setParams(n);}}>{tr('m072')}</button><span>{state.data.pagination.page} / {state.data.pagination.totalPages}</span><button disabled={state.data.pagination.page>=state.data.pagination.totalPages} onClick={()=>{const n=new URLSearchParams(params);n.set('page',String(state.data!.pagination.page+1));setParams(n);}}>{tr('m073')}</button></nav>}
 </>}</section>;
}
