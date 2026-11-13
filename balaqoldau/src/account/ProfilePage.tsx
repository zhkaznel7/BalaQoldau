import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {Link,NavLink,Navigate,useLocation,useNavigate,useSearchParams} from 'react-router-dom';
import {useUser} from './context';
import {authText} from './translations';
import type {AuthMessage,Language} from './translations';
import {normalizeProfile,UserAuthError} from './api';
import type {DashboardProfile} from './api';
import {useResource} from '../hooks/useResource';
import {ProgramGrid} from '../components/ProgramCard';
import './account.css';
import ChildrenPage from './ChildrenPage';
import {tr} from '../i18n/ui';

export default function ProfilePage() {
  const {session,ready,error,refresh}=useUser(),location=useLocation(),[params]=useSearchParams();
  const language:Language=params.get('lang')==='ru'?'ru':'kk',t=authText[language];
  const href=(path:string)=>path+'?lang='+language;
  const title=location.pathname==='/profile/children'?tr('m335'):location.pathname==='/profile/saved'?t.savedTitle:t.account;
  useEffect(()=>{document.title=title+' — BalaQoldau';},[title]);
  if(ready&&!session?.authenticated&&(!error||error==='expired'))return <Navigate to={'/login?'+new URLSearchParams({lang:language,returnTo:location.pathname+location.search})} replace state={{expired:error==='expired'}}/>;
  return <section className="account-page dashboard container inner-page" lang={language}>
    <div className="account-heading"><h1>{title}</h1></div>
    <nav className="account-links" aria-label={t.account}><NavLink end to={href('/profile')}>{t.account}</NavLink><NavLink to={href('/profile/saved')}>{t.savedTitle}</NavLink><NavLink to={href('/profile/children')}>{tr('m335')}</NavLink><Link to="/find">{t.find}</Link></nav>
    {!ready?<p role="status">{t.loading}</p>:error?<div role="alert" className="account-feedback error"><p>{t[error]}</p><button className="button" onClick={()=>void refresh()}>{t.retry}</button></div>:
      session?.user&&(location.pathname==='/profile/children'?<ChildrenPage key={session.user.id}/>:location.pathname==='/profile/saved'?<SavedPage key={session.user.id} language={language}/>:<Overview key={session.user.id} language={language}/>)}
  </section>;
}
function Overview({language}:{language:Language}) {
  const {api,revision}=useUser(),t=authText[language];
  const load=useCallback((_key:string,signal:AbortSignal)=>api.dashboard(signal),[api]);
  const state=useResource(String(revision),load);
  if(state.loading)return <p role="status">{t.loading}</p>;
  if(state.error)return <ReadError error={state.error} retry={state.retry} language={language}/>;
  return state.data?<ProfileEditor initial={state.data} language={language}/>:null;
}
function ProfileEditor({initial,language}:{initial:DashboardProfile;language:Language}) {
  const {api,accept,changed,refresh}=useUser(),navigate=useNavigate(),t=authText[language];
  const [input,setInput]=useState({fullName:initial.fullName??'',location:initial.location??''}),[pending,setPending]=useState(false);
  const [message,setMessage]=useState<AuthMessage|null>(null),[failed,setFailed]=useState(false),[uncertain,setUncertain]=useState(false);
  const alive=useRef(true),feedback=useRef<HTMLDivElement>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(message)feedback.current?.focus();},[message]);
  async function submit(event:FormEvent){
    event.preventDefault();if(pending||api.busy()||uncertain)return;
    const normalized=normalizeProfile(input);setMessage(null);
    if(!normalized){setFailed(true);setMessage('profileInvalid');return;}
    setPending(true);try{const result=await api.updateProfile(normalized);if(alive.current){setInput({fullName:result.fullName??'',location:result.location??''});setFailed(false);setMessage('profileSaved');}}
    catch(error){if(alive.current){setFailed(true);setMessage(error instanceof UserAuthError?error.key:'unavailable');setUncertain(error instanceof UserAuthError&&error.status===0);}}
    finally{if(alive.current)setPending(false);}
  }
  async function logout(){
    if(pending||api.busy())return;setPending(true);try{await api.logout();if(alive.current){accept(null);navigate('/login?lang='+language,{replace:true});await refresh();}}
    catch(error){if(alive.current){setFailed(true);setMessage(error instanceof UserAuthError?error.key:'unavailable');}}
    finally{if(alive.current)setPending(false);}
  }
  return <div className="dashboard-layout"><div className="account-panel">
    <dl><dt>{t.email}</dt><dd>{initial.email}</dd></dl><p className="small">{t.emailFixed}</p>
    {message&&<div className={'account-feedback'+(failed?' error':'')} role={failed?'alert':'status'} tabIndex={-1} ref={feedback}><p>{t[message]}</p>
      {uncertain&&<button type="button" className="button" onClick={()=>changed()}>{t.reloadProfile}</button>}</div>}
    <form onSubmit={event=>void submit(event)} noValidate aria-busy={pending}>
      <div className="account-field"><label htmlFor="profile-name">{t.fullName}</label><input id="profile-name" autoComplete="name" value={input.fullName} disabled={pending} onChange={event=>setInput(value=>({...value,fullName:event.target.value}))}/></div>
      <div className="account-field"><label htmlFor="profile-location">{t.location}</label><input id="profile-location" autoComplete="address-level2" value={input.location} disabled={pending} onChange={event=>setInput(value=>({...value,location:event.target.value}))}/></div>
      <p>{t.profilePrivacy}</p><button type="submit" className="button primary" disabled={pending||uncertain}>{pending?t.pending:t.saveChanges}</button>
    </form></div><aside className="account-panel dashboard-summary"><h2>{t.savedTitle}</h2><p className="saved-count" data-saved-count={initial.savedCount}>{initial.savedCount}</p><p>{t.savedDescription}</p>
      <Link className="button" to={'/profile/saved?lang='+language}>{t.savedTitle}</Link><Link to="/favorites">{t.legacy}</Link><p>{t.unverified}</p>
      <button type="button" className="button text-button" disabled={pending} onClick={()=>void logout()}>{pending?t.pending:t.logout}</button>
    </aside></div>;
}
function SavedPage({language}:{language:Language}) {
  const {api,revision}=useUser(),[params,setParams]=useSearchParams(),t=authText[language];
  const raw=params.get('page')??'1',page=/^[1-9]\d*$/.test(raw)&&Number(raw)<=10000?Number(raw):1;
  const loader=useCallback((key:string,signal:AbortSignal)=>api.savedPrograms(Number(key.split(':')[0]),signal),[api]);
  const state=useResource(page+':'+revision,loader);
  if(state.loading)return <p role="status">{t.loading}</p>;
  if(state.error)return <ReadError error={state.error} retry={state.retry} language={language}/>;
  return <><p>{t.savedDescription}</p>{state.data?.data.length?<ProgramGrid programs={state.data.data}/>:<div className="account-panel" role="status"><p>{t.savedEmpty}</p><Link className="button primary" to="/find">{t.find}</Link></div>}
    {state.data&&(page>1||state.data.pagination.totalPages>1)&&<nav className="pagination" aria-label={t.savedTitle}>
      <button className="button" disabled={page<=1} onClick={()=>{const next=new URLSearchParams(params);next.set('page',String(page-1));setParams(next);}}>{t.previous}</button>
      <span>{page} / {Math.max(1,state.data.pagination.totalPages)}</span><button className="button" disabled={page>=state.data.pagination.totalPages} onClick={()=>{const next=new URLSearchParams(params);next.set('page',String(page+1));setParams(next);}}>{t.next}</button>
    </nav>}</>;
}
function ReadError({error,retry,language}:{error:Error;retry:()=>void;language:Language}) {
  const t=authText[language];return <div className="account-feedback error" role="alert"><p>{t[error instanceof UserAuthError?error.key:'unavailable']}</p><button className="button" onClick={retry}>{t.retry}</button></div>;
}
