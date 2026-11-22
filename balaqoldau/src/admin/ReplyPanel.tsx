import {useCallback,useRef,useState} from 'react';
import {useAdmin} from './context';
import {useResource} from '../hooks/useResource';
import {tr,dateLocale} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import {deliveryLabel} from './replies';
import type {InboxKind,Reply} from './replies';

export default function ReplyPanel({
  kind,
  id,
  replied=false,
  defaultOpen=false,
}: {
  kind: InboxKind;
  id: string;
  replied?:boolean;
  defaultOpen?:boolean;
}) {
  useUi();

  const { api } = useAdmin();
  const [open, setOpen] = useState(defaultOpen),[activated,setActivated]=useState(defaultOpen),[answered,setAnswered]=useState(replied);

  return (
    <div className="reply-workspace">
      <div className="reply-heading"><h2>{tr('m487')}</h2>{(answered||replied)&&<span className="reply-status-badge">{tr('m488')}</span>}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={'reply-panel-'+id}
        onClick={() => {setActivated(true);setOpen(value => !value);}}
      >
        {tr('m484')}
      </button>
      </div>

        <div className="reply-panel-content" id={'reply-panel-'+id} hidden={!open}>
          {activated&&<Replies api={api} kind={kind} id={id} onSaved={()=>setAnswered(true)} />}
        </div>
    </div>
  );
}

function Replies({api,kind,id,onSaved}:{api:ReturnType<typeof useAdmin>['api'];kind:InboxKind;id:string;onSaved:()=>void}){
 const load=useCallback((_key:string,signal:AbortSignal)=>api.replies(kind,id,signal),[api,kind,id]),state=useResource(id,load);
 const [text,setText]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<Reply|null>(null);
 const attempt=useRef<{text:string;id:string}|null>(null);
 async function send(event:React.FormEvent){
  event.preventDefault();if(pending||api.busy()||!text.trim())return;
  const body=text.trim();if(!attempt.current||attempt.current.text!==body)attempt.current={text:body,id:crypto.randomUUID()};
  setPending(true);setError('');setSaved(null);
  try{const reply=await api.reply(kind,id,body,attempt.current.id);setSaved(reply);onSaved();setText('');attempt.current=null;state.retry();}
  catch(e){setError(e instanceof Error?e.message:'m041');}finally{setPending(false);}
 }
 return <section aria-label={tr('m487')}>
  {saved&&<p className="admin-visually-hidden" role="status">{tr(deliveryLabel[saved.deliveryStatus])}</p>}
  <div className="inbox-card reply-history">
  {state.loading?<p role="status">{tr('m280')}</p>:state.error?<div role="alert"><p>{tr(state.error.message)}</p><button onClick={state.retry}>{tr('m019')}</button></div>:!state.data?.length?<p>{tr('m493')}</p>:<ol className="reply-timeline">{state.data.map(r=><li key={r.id}><div className="reply-meta"><time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString(dateLocale())}</time><span className={'delivery-badge delivery-'+r.deliveryStatus}>{tr(deliveryLabel[r.deliveryStatus])}</span></div><p className="contact-message-text">{r.text}</p></li>)}</ol>}
  </div>
  <form className="inbox-card reply-form" onSubmit={event=>void send(event)} aria-busy={pending}><h3>{tr('m506')}</h3><label htmlFor={'reply-'+id}>{tr('m485')}</label><textarea id={'reply-'+id} required maxLength={2000} rows={5} value={text} disabled={pending||state.loading||!!state.error} onChange={event=>setText(event.target.value)}/><div className="reply-form-footer"><p>{tr('m507')}</p><button className="admin-primary" disabled={pending||state.loading||!!state.error||!text.trim()}>{tr(pending?'m248':'m486')}</button></div>{error&&<p role="alert">{tr(error)}</p>}</form>
 </section>;
}
