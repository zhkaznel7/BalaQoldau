import {tr} from '../i18n/ui.ts';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authText } from './translations';
import type { AuthMessage } from './translations';
import { resetTokenFromHash, safeReturnTo, UserAuthError, validNewPassword } from './api';
import { useUser } from './context';
import { validContactEmail } from '../api/contact';
import './account.css';

export default function AccountPage() {
  const location=useLocation(),navigate=useNavigate(),[params]=useSearchParams();
  const language=params.get('lang')==='ru'?'ru':'kk',t=authText[language],path=location.pathname;
  const {api,session,ready,error:sessionError,refresh,accept}=useUser();
  const [error,setError]=useState<AuthMessage|null>(null),[success,setSuccess]=useState<AuthMessage|null>(null),[pending,setPending]=useState(false);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [resetToken,setResetToken]=useState(()=>resetTokenFromHash(window.location.hash));
  const alive=useRef(true),feedback=useRef<HTMLDivElement>(null);
  const returnTo=safeReturnTo(params.get('returnTo'));
  const href=(target:string)=>target+'?'+new URLSearchParams({lang:language,...(returnTo!=='/profile'?{returnTo}:{})}).toString();
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    if(path!=='/reset-password')return;
    const clearFragment=()=>history.replaceState(history.state,'',window.location.pathname+window.location.search);
    const changed=()=>{setResetToken(resetTokenFromHash(window.location.hash));setError(null);setSuccess(null);clearFragment();};
    window.addEventListener('hashchange',changed);
    if(window.location.hash)clearFragment();
    return()=>window.removeEventListener('hashchange',changed);
  },[path]);
  useEffect(()=>{if(error||success)feedback.current?.focus();},[error,success]);
  const registering=path==='/register',resetting=path==='/reset-password',forgot=path==='/forgot-password';
  const title=registering?t.register:resetting||forgot?t.reset:t.login;
  useEffect(()=>{document.title=title+' — BalaQoldau';},[title]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(api.busy()||pending)return;
    setError(null);setSuccess(null);
    if(!resetting&&!validContactEmail(email)){setError('invalid');return;}
    if(!forgot&&!validNewPassword(password)){setError('passwordInvalid');return;}
    if((registering||resetting)&&password!==confirmation){setError('mismatch');return;}
    if(resetting&&!resetToken){setError('invalidReset');return;}
    setPending(true);
    try{
      if(registering){await api.register(email,password,language);if(alive.current)setSuccess('registered');}
      else if(forgot){await api.requestReset(email);if(alive.current)setSuccess('requested');}
      else if(resetting){await api.confirmReset(resetToken,password);if(alive.current){setResetToken('');setSuccess('resetDone');await refresh();}}
      else{const next=await api.login(email,password);if(alive.current){accept(next);navigate(returnTo==='/profile'?href('/profile'):returnTo,{replace:true});}}
    }catch(failure){if(alive.current)setError(failure instanceof UserAuthError?failure.key:'unavailable');}
    finally{if(alive.current){setPassword('');setConfirmation('');setPending(false);}}
  }
  if(ready&&!resetting&&session?.authenticated)return <Navigate to={returnTo==='/profile'?href('/profile'):returnTo} replace/>;
  const visibleError=error??sessionError;
  return <section className="account-page container inner-page" lang={language}>
    <div className="account-heading"><h1>{tr(title)}</h1></div>
    {!ready?<p role="status">{t.loading}</p>:<>
      {(visibleError||success||location.state?.expired)&&<div ref={feedback} tabIndex={-1} role={visibleError?'alert':'status'} className={visibleError?'account-feedback error':'account-feedback'}>
        <p>{visibleError?t[visibleError]:success?t[success]:t.expired}</p>
        {visibleError&&<button type="button" className="button" disabled={pending} onClick={()=>{setError(null);void refresh();}}>{t.retry}</button>}
      </div>}
      {session&&!session.authenticated&&<div className="account-panel">
          {forgot&&!session.resetAvailable?<p role="status">{t.noMail}</p>:success?<p><Link to={href('/login')}>{t.login}</Link></p>:
            resetting&&!resetToken?<p>{t.invalidReset}</p>:<form onSubmit={event=>void submit(event)} noValidate aria-busy={pending}>
              {!resetting&&<div className="account-field"><label htmlFor="user-email">{t.email}</label><input id="user-email" type="email" autoComplete="email" value={email} maxLength={254} required disabled={pending} onChange={event=>setEmail(event.target.value)}/></div>}
              {!forgot&&<div className="account-field"><label htmlFor="user-password">{resetting?t.newPassword:t.password}</label><input id="user-password" type="password" autoComplete={registering||resetting?'new-password':'current-password'} value={password} required disabled={pending} onChange={event=>setPassword(event.target.value)}/></div>}
              {(registering||resetting)&&<div className="account-field"><label htmlFor="user-confirm">{t.confirm}</label><input id="user-confirm" type="password" autoComplete="new-password" value={confirmation} required disabled={pending} onChange={event=>setConfirmation(event.target.value)}/></div>}
              {registering&&<p>{t.privacy}</p>}
              <button className="button primary" type="submit" disabled={pending}>{pending?t.pending:forgot?t.send:resetting?t.save:registering?t.register:t.login}</button>
            </form>}
        </div>}
    </>}
    <nav className="account-links" aria-label={t.account}><Link to={href('/login')}>{t.login}</Link><Link to={href('/register')}>{t.register}</Link><Link to={href('/forgot-password')}>{t.forgot}</Link></nav>
  </section>;
}
