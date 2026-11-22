import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {createUserApi,UserAuthError} from './api';
import type {UserSession} from './api';
import {UserContext} from './context';
import type {UserState} from './context';
export default function UserProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState<UserState>({session:null,ready:false,error:null}),[revision,setRevision]=useState(0);
  const current=useRef<AbortController|null>(null);
  const api=useMemo(()=>createUserApi(fetch,()=>setState({session:null,ready:true,error:'expired'})),[]);
  const accept=useCallback((session:UserSession|null)=>{current.current?.abort();setState({session,ready:true,error:null});},[]);
  const refresh=useCallback(()=>{
    current.current?.abort();const controller=new AbortController();current.current=controller;
    return api.session(controller.signal).then(session=>{if(!controller.signal.aborted)setState({session,ready:true,error:null});})
      .catch((error:unknown)=>{if(!controller.signal.aborted)setState({session:null,ready:true,error:error instanceof UserAuthError?error.key:'unavailable'});});
  },[api]);
  useEffect(()=>{void refresh();return()=>current.current?.abort();},[refresh]);
  useEffect(()=>{
    const check=()=>{if(document.visibilityState!=='hidden'&&!api.busy())void refresh();};
    const timer=setInterval(check,60000);window.addEventListener('focus',check);window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',check);
    return()=>{clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',check);};
  },[api,refresh]);
  const changed=useCallback(()=>setRevision(value=>value+1),[]);
  const value=useMemo(()=>({...state,api,accept,refresh,revision,changed}),[state,api,accept,refresh,revision,changed]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
