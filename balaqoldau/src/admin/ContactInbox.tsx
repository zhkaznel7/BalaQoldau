import ReplyPanel from './ReplyPanel';
import {useCallback,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {tr,dateLocale} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import {useResource} from '../hooks/useResource';
import {useAdmin} from './context';
import {AdminError} from './api';
import type {ContactStatus} from './types';
const labels={unread:'m461',read:'m462',resolved:'m396'};
function Failure({error,retry}:{error:Error;retry:()=>void}){return <div role="alert" className="admin-error"><p>{tr(error.message)}</p><button onClick={retry}>{tr('m019')}</button></div>;}
export default function ContactInbox(){
 useUi();const {access}=useAdmin();
 if(!access.permissions.includes('contacts:manage'))return <><h1>{tr('m460')}</h1><p role="alert">{tr('m035')}</p></>;
 return <Inbox/>;
}
function Inbox(){
 const {id}=useParams();return id?<Message key={id} id={id}/>:<MessageList/>;
}
function MessageList(){
 useUi();const {api}=useAdmin(),[params,setParams]=useSearchParams();
 const query=params.toString(),loader=useCallback((q:string,signal:AbortSignal)=>api.contacts(q,signal),[api]),state=useResource(query,loader);
 return <section><h1>{tr('m460')}</h1><p>{tr('m463')}</p>
  <label htmlFor="contact-status">{tr('m068')}</label><select id="contact-status" value={params.get('status')??''} onChange={event=>{const p=new URLSearchParams(params);p.delete('page');if(event.target.value)p.set('status',event.target.value);else p.delete('status');setParams(p);}}><option value="">{tr('m379')}</option>{Object.entries(labels).map(([value,key])=><option key={value} value={value}>{tr(key)}</option>)}</select>
  {state.loading?<p role="status">{tr('m280')}</p>:state.error?<Failure error={state.error} retry={state.retry}/>:state.data&&<>
   <p role="status">{tr('m464',{'0':state.data.unreadCount})}</p>
   {!state.data.data.length?<p>{tr('m465')}</p>:<ul className="contact-inbox-list">{state.data.data.map(item=><li key={item.id}><h2><Link to={'/admin/messages/'+item.id}>{item.senderName}</Link></h2><p>{item.email}</p>{item.replied&&<p>{tr('m488')}</p>}<p className="contact-message-text">{item.preview}</p><p>{tr(labels[item.status])} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(dateLocale())}</time></p></li>)}</ul>}
   {state.data.pagination.totalPages>1&&<nav aria-label={tr('m460')}><button disabled={state.data.pagination.page<=1} onClick={()=>{const p=new URLSearchParams(params);p.set('page',String(state.data!.pagination.page-1));setParams(p);}}>{tr('m072')}</button><span>{state.data.pagination.page} / {state.data.pagination.totalPages}</span><button disabled={state.data.pagination.page>=state.data.pagination.totalPages} onClick={()=>{const p=new URLSearchParams(params);p.set('page',String(state.data!.pagination.page+1));setParams(p);}}>{tr('m073')}</button></nav>}
  </>}
 </section>;
}
function Message({id}:{id:string}){
 useUi();const {api}=useAdmin(),loader=useCallback((_key:string,signal:AbortSignal)=>api.contact(id,signal),[api,id]),state=useResource(id,loader);
 const [changed,setChanged]=useState<Awaited<ReturnType<typeof api.contact>>|null>(null),[error,setError]=useState<Error|null>(null),[pending,setPending]=useState(false),[notice,setNotice]=useState(false);
 const data=changed??state.data;
 async function change(status:ContactStatus){if(!data||pending||error)return;setPending(true);setNotice(false);try{setChanged(await api.changeContact(id,data.version,status));setNotice(true);}catch(e){setError(e instanceof Error?e:new AdminError(503));}finally{setPending(false);}}
 return <section className="message-detail"><Link to="/admin/messages">{tr('m078')}</Link><h1>{tr('m466')}</h1>
  {state.loading?<p role="status">{tr('m280')}</p>:state.error?<Failure error={state.error} retry={state.retry}/>:data&&<>
   {notice&&<p role="status" className="admin-success">{tr('m467')}</p>}
   {error&&<Failure error={error} retry={()=>{setChanged(null);setError(null);setNotice(false);state.retry();}}/>}
   <div className="message-detail-grid">
    <section className="inbox-card sender-card" aria-labelledby="sender-heading"><h2 id="sender-heading">{tr('m504')}</h2>
     <dl className="admin-facts"><dt>{tr('m239')}</dt><dd>{data.senderName}</dd><dt>{tr('m027')}</dt><dd>{data.email}</dd><dt>{tr('m068')}</dt><dd><span className="message-status">{tr(labels[data.status])}</span></dd><dt>{tr('m468')}</dt><dd><time dateTime={data.createdAt}>{new Date(data.createdAt).toLocaleString(dateLocale())}</time></dd></dl>
    </section>
    <section className="inbox-card original-message" aria-labelledby="original-heading"><h2 id="original-heading">{tr('m505')}</h2><p className="contact-message-text">{data.message}</p></section>
   </div>
   <div className="admin-actions">{(data.status==='unread'?['read']:data.status==='read'?['resolved','unread']:['read']).map(status=><button key={status} disabled={pending||!!error} onClick={()=>void change(status as ContactStatus)}>{tr(status==='resolved'?'m410':status==='unread'?'m470':data.status==='resolved'?'m471':'m469')}</button>)}</div>
   <ReplyPanel kind="contact-messages" id={id} replied={data.replied} defaultOpen/>
  </>}
 </section>;
}
