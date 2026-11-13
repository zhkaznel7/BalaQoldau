import {useCallback,useRef,useState} from 'react';
import {useAdmin} from './context';
import {useResource} from '../hooks/useResource';
import {tr,dateLocale} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import {deliveryLabel} from './replies';
import type {InboxKind,Reply} from './replies';
export default function ReplyPanel({kind,id}:{kind:InboxKind;id:string}){
 useUi();const {api}=useAdmin(),[open,setOpen]=useState(false);
 return <div><button aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{tr('m484')}</button>{open&&<Replies api={api} kind={kind} id={id}/>}</div>;
}
function Replies({api,kind,id}:{api:ReturnType<typeof useAdmin>['api'];kind:InboxKind;id:string}){
 const load=useCallback((_key:string,signal:AbortSignal)=>api.replies(kind,id,signal),[api,kind,id]),state=useResource(id,load);
 const [text,setText]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<Reply|null>(null);
 const attempt=useRef<{text:string;id:string}|null>(null);
 async function send(event:React.FormEvent){
  event.preventDefault();if(pending||api.busy()||!text.trim())return;
  const body=text.trim();if(!attempt.current||attempt.current.text!==body)attempt.current={text:body,id:crypto.randomUUID()};
  setPending(true);setError('');setSaved(null);
  try{const reply=await api.reply(kind,id,body,attempt.current.id);setSaved(reply);setText('');attempt.current=null;state.retry();}
  catch(e){setError(e instanceof Error?e.message:'m041');}finally{setPending(false);}
 }
 return <section aria-label={tr('m487')}>
  {saved&&<p role="status">{tr('m488')} — {tr(deliveryLabel[saved.deliveryStatus])}</p>}
  {state.loading?<p role="status">{tr('m280')}</p>:state.error?<div role="alert"><p>{tr(state.error.message)}</p><button onClick={state.retry}>{tr('m019')}</button></div>:<ul>{state.data?.map(r=><li key={r.id}><p className="contact-message-text">{r.text}</p><p>{tr(deliveryLabel[r.deliveryStatus])} · <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString(dateLocale())}</time></p></li>)}</ul>}
  <form onSubmit={event=>void send(event)} aria-busy={pending}><label htmlFor={'reply-'+id}>{tr('m485')}</label><textarea id={'reply-'+id} required maxLength={2000} rows={4} value={text} disabled={pending} onChange={event=>setText(event.target.value)}/><button disabled={pending||!text.trim()}>{tr(pending?'m248':'m486')}</button>{error&&<p role="alert">{tr(error)}</p>}</form>
 </section>;
}
