import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { createAdminApi,AdminError } from './api';
import type { Access } from './types';
import { roles } from './types';
import { AdminContext } from './context';
import { ProgramList, ProgramDetails, ProgramFormPage } from './Programs';
import './admin.css';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {AdminOverview,AdminReports} from './VerificationPanels';
import ContentLanguageNotice from '../i18n/ContentLanguageNotice';
import ContactInbox from './ContactInbox';

export default function AdminApp() {
  useUi();
  const [state, setState] = useState<{ loading: boolean; access: Access | null; error: Error | null; expired: boolean }>({ loading: true, access: null, error: null, expired: false });
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const current = useRef<AbortController | null>(null);
  const checking=useRef<Promise<void>|null>(null),lastCheck=useRef(0);
  const known = useRef(false);
  const navigate = useNavigate(), location = useLocation();
  const api = useMemo(() => createAdminApi(import.meta.env.VITE_ADMIN_API_BASE_URL || '/api/admin', fetch, () => {
    setState({ loading: false, access: null, error: null, expired: true });
  }), []);
  const refresh = useCallback((force=true):Promise<void> => {
    if(checking.current&&!current.current?.signal.aborted)return checking.current;
    if(!force&&Date.now()-lastCheck.current<15000)return Promise.resolve();
    lastCheck.current=Date.now();
    const controller = new AbortController(); current.current = controller;
    const work=(async()=>{
    try {
      const session = await api.session(controller.signal);
      const access = session.authenticated ? await api.access(controller.signal) : null;
      if (access && access.id !== session.admin?.id) throw new Error(tr("m001"));
      if (controller.signal.aborted) return;
      const expired = known.current && !access;
      known.current = !!access;
      setState({ loading: false, access, error: null, expired });
    } catch (error) {
      if (!controller.signal.aborted) {
        const unauthorized = error instanceof Error && 'status' in error && error.status === 401;
        const temporary=error instanceof AdminError&&(error.status===0||error.status===429||error.status>=500);
        setState(previous=>({ loading: false, access: temporary?previous.access:null, error: unauthorized ? null : error instanceof Error ? error : new Error(tr("m002")), expired: unauthorized }));
      }
    }
    })();
    checking.current=work;void work.finally(()=>{if(checking.current===work)checking.current=null;});
    return work;
  }, [api]);
  useEffect(() => { void refresh(); return () => current.current?.abort(); }, [refresh]);
  useEffect(() => {
    if (!state.access) return;
    const check = () => { if (document.visibilityState !== 'hidden' && !api.busy()) void refresh(false); };
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check); window.addEventListener('pageshow', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); document.removeEventListener('visibilitychange', check); };
  }, [api, refresh, state.access]);
  useEffect(() => { document.title = tr("m003"); }, [location.pathname,location.search]);
  useEffect(() => { document.getElementById('admin-main')?.focus(); window.scrollTo(0, 0); }, [location.pathname]);
  async function signIn(email: string, password: string) {
    current.current?.abort(); setLogoutError('');
    await api.login(email, password); await refresh();
  }
  async function logout() {
    if (api.busy()) { setLogoutError(tr("m004")); return; }
    current.current?.abort(); setLoggingOut(true); setLogoutError('');
    try { await api.logout(); known.current = false; setState({ loading: false, access: null, error: null, expired: false }); navigate('/admin/login', { replace: true }); }
    catch (error) { setLogoutError(error instanceof Error ? error.message : tr("m005")); }
    finally { setLoggingOut(false); }
  }
  return <div className="admin-app">
    <a className="admin-skip" href="#admin-main">{""+tr("m006")+""}</a>
    <header className="admin-header"><Link to="/admin/programs" className="admin-brand">BalaQoldau <span>{""+tr("m007")+""}</span></Link><Link to="/">{""+tr("m008")+""}</Link><LanguageSwitcher/>
      {state.access && <><span className="admin-role"><ShieldCheck size={17} aria-hidden="true"/>{tr(roles[state.access.role])}</span><button type="button" disabled={loggingOut || api.busy()} onClick={() => void logout()}><LogOut size={17} aria-hidden="true"/> {loggingOut ? tr("m009") : tr("m010")}</button></>}
    </header>
    <div className={state.access ? 'admin-layout' : 'admin-login-layout'}>
      {state.access && <nav className="admin-nav" aria-label={tr("m011")}>{state.access.permissions.includes('contacts:manage')&&<NavLink to="/admin/messages">{tr('m460')}</NavLink>}<NavLink to="/admin/overview">{tr("m368")}</NavLink>{state.access.permissions.includes('programs:review')&&<NavLink to="/admin/reports">{tr("m392")}</NavLink>}<NavLink end to="/admin/programs">{""+tr("m012")+""}</NavLink>
        {state.access.permissions.includes('programs:review') && <Link to="/admin/programs?status=review">{""+tr("m013")+""}</Link>}
        {state.access.role === 'admin' && <Link to="/admin/programs?status=verified">{""+tr("m014")+""}</Link>}
        {state.access.permissions.includes('programs:draft:write') && <NavLink to="/admin/programs/new">{""+tr("m015")+""}</NavLink>}
      </nav>}
      <main id="admin-main" tabIndex={-1}>
        {state.access&&<ContentLanguageNotice/>}
        {state.access&&state.error&&<SessionProblem error={state.error} retry={()=>void refresh()}/>}
        {logoutError && <div role="alert" className="admin-error"><p>{tr(logoutError)}</p><button onClick={() => void refresh()}>{""+tr("m016")+""}</button></div>}
        {state.loading ? <p role="status">{""+tr("m017")+""}</p> : state.error&&!state.access ? <section><h1>{tr(state.error instanceof AdminError&&state.error.status===403?'m458':'m018')}</h1><SessionProblem error={state.error} retry={()=>void refresh()}/></section>
          : state.access ? <AdminContext.Provider key={state.access.id} value={{ api, access: state.access, refresh }}><Routes>
            <Route path="messages" element={<ContactInbox/>}/><Route path="messages/:id" element={<ContactInbox/>}/><Route path="overview" element={<AdminOverview/>}/><Route path="reports" element={<AdminReports/>}/><Route path="login" element={<Navigate replace to="/admin/programs"/>}/><Route path="programs" element={<ProgramList/>}/>
            <Route path="programs/new" element={<ProgramFormPage/>}/><Route path="programs/:id/edit" element={<ProgramFormPage/>}/>
            <Route path="programs/:id" element={<ProgramDetails/>}/><Route index element={<Navigate replace to="/admin/programs"/>}/>
            <Route path="*" element={<><h1>{""+tr("m020")+""}</h1><Link to="/admin/programs">{""+tr("m021")+""}</Link></>}/>
          </Routes></AdminContext.Provider>
            : location.pathname === '/admin/login' ? <Login expired={state.expired} signIn={signIn}/> : <Navigate replace to="/admin/login"/>}
      </main>
    </div><footer className="admin-footer">{""+tr("m022")+""}</footer>
  </div>;
}
function SessionProblem({error,retry}:{error:Error;retry:()=>void}){
  useUi();const [now,setNow]=useState(Date.now);
  const until=error instanceof AdminError?error.retryAt:undefined;
  useEffect(()=>{if(until===undefined||until<=now)return;const timer=window.setTimeout(()=>setNow(Date.now()),Math.min(1000,until-now));return()=>clearTimeout(timer);},[until,now]);
  const seconds=until===undefined?0:Math.max(0,Math.ceil((until-now)/1000));
  return <div role="alert" className="admin-error admin-session-problem"><p>{tr(error.message)}</p><button type="button" disabled={seconds>0} onClick={retry}>{seconds?tr('m459',{'0':seconds}):tr('m019')}</button></div>;
}
function Login({ signIn, expired }: { signIn: (email: string, password: string) => Promise<void>; expired: boolean }) {
  useUi();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return; setError(''); setPending(true);
    try { await signIn(email.trim(), password); }
    catch (failure) { setError(failure instanceof Error ? failure.message : tr("m023")); }
    finally { setPassword(''); setPending(false); }
  }
  return <section className="admin-login"><h1>{""+tr("m024")+""}</h1><p>{""+tr("m025")+""}</p>
    {expired && <p role="alert">{""+tr("m026")+""}</p>}
    <form onSubmit={event => void submit(event)} aria-busy={pending}>
      <label htmlFor="admin-email">{""+tr("m027")+""}</label><input id="admin-email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={pending}/>
      <label htmlFor="admin-password">{""+tr("m028")+""}</label><input id="admin-password" type="password" autoComplete="current-password" maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} disabled={pending}/>
      {error && <p role="alert" className="admin-error">{tr(error)}</p>}
      <button className="admin-primary" disabled={pending}>{pending ? tr("m029") : tr("m030")}</button>
    </form><p className="admin-muted">{""+tr("m031")+""}</p>
  </section>;
}
