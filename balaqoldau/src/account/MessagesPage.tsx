import {useCallback,useState} from 'react';
import {useUser} from './context';
import {authText} from './translations';
import {UserAuthError} from './api';
import {useResource} from '../hooks/useResource';
import {tr,dateLocale,currentLanguage} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
export default function MessagesPage(){
 useUi();const language=currentLanguage(),{api}=useUser(),[page,setPage]=useState(1),load=useCallback((key:string,signal:AbortSignal)=>api.messages(Number(key),signal),[api]),state=useResource(String(page),load);
 const t=authText[language];
 if(state.loading)return <p role="status">{tr('m280')}</p>;
 if(state.error)return <div role="alert"><p>{state.error instanceof UserAuthError?t[state.error.key]:t.unavailable}</p><button onClick={state.retry}>{tr('m019')}</button></div>;
 return <section><h2>{tr('m492')}</h2>{!state.data?.data.length?<p>{tr('m493')}</p>:<ul>{state.data.data.map(r=><li key={r.id}><h3>{tr(r.kind==='contact'?'m466':'m392')}</h3><p className="contact-message-text">{r.text}</p><time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString(dateLocale())}</time></li>)}</ul>}
 {state.data&&state.data.pagination.totalPages>1&&<nav aria-label={tr('m492')}><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>{tr('m072')}</button><span>{page} / {state.data.pagination.totalPages}</span><button disabled={page>=state.data.pagination.totalPages} onClick={()=>setPage(p=>p+1)}>{tr('m073')}</button></nav>}</section>;
}
