import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {Bookmark} from 'lucide-react';
import {useUser} from './context';
import {useResource} from '../hooks/useResource';
import {authText} from './translations';
import type {AuthMessage} from './translations';
import {UserAuthError} from './api';
import './saved.css';

interface SavedState {ids:string[];loading:boolean;error:Error|null;retry:()=>void;change:(id:string,saved:boolean)=>Promise<void>}
const Context=createContext<SavedState|null>(null);
export function SavedProgramsScope({ids,children}:{ids:string[];children:ReactNode}) {
  const {session}=useUser();return <SavedStateProvider key={(session?.user?.id??'anonymous')+':'+ids.join(',')} ids={ids}>{children}</SavedStateProvider>;
}
function SavedStateProvider({ids,children}:{ids:string[];children:ReactNode}) {
  const {api,session,revision,changed}=useUser(),authenticated=!!session?.authenticated,key=ids.join(',');
  const loader=useCallback((query:string,signal:AbortSignal)=>authenticated?api.savedStatus(query?query.split(','):[],signal):Promise.resolve([]),[api,authenticated]);
  const state=useResource(key+':'+revision,useCallback((query:string,signal:AbortSignal)=>loader(query.split(':')[0],signal),[loader]));
  const change=async(id:string,saved:boolean)=>{if(saved)await api.removeProgram(id);else await api.saveProgram(id);changed();};
  return <Context.Provider value={{ids:state.data??[],loading:state.loading,error:state.error,retry:state.retry,change}}>{children}</Context.Provider>;
}
export function SaveProgramButton({id,title}:{id:string;title:string}) {
  const scope=useContext(Context),{session,ready,error:sessionError,refresh}=useUser(),location=useLocation(),[params]=useSearchParams();
  const t=authText[params.get('lang')==='ru'?'ru':'kk'];
  const [prompt,setPrompt]=useState(false),[pending,setPending]=useState(false),[message,setMessage]=useState<AuthMessage|null>(null);
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  if(!scope)throw new Error('Saved scope missing');
  const success=message==='savedSuccess'||message==='removedSuccess';
  const saved=scope.ids.includes(id),error=(!success?message:null)??(scope.error instanceof UserAuthError?scope.error.key:scope.error?'unavailable':sessionError);
  async function toggle(){
    if(!scope||pending)return;setMessage(null);
    if(!session?.authenticated){setPrompt(true);return;}
    setPending(true);try{await scope.change(id,saved);if(alive.current)setMessage(saved?'removedSuccess':'savedSuccess');}
    catch(failure){if(alive.current)setMessage(failure instanceof UserAuthError?failure.key:'unavailable');}
    finally{if(alive.current)setPending(false);}
  }
  const login='/login?'+new URLSearchParams({lang:params.get('lang')==='ru'?'ru':'kk',returnTo:location.pathname+location.search+location.hash}).toString();
  return <span className="saved-control"><button type="button" className={'icon-button save-button '+(saved?'saved':'')} aria-label={title+': '+(saved?t.removeSaved:t.saveProgram)} aria-pressed={saved}
    disabled={!ready||pending||(!!session?.authenticated&&scope.loading)} onClick={()=>void toggle()}><Bookmark aria-hidden="true" size={20} fill={saved?'currentColor':'none'}/></button>
    {prompt&&!session?.authenticated&&<span className="saved-feedback" role="status">{t.loginToSave} <Link to={login}>{t.login}</Link></span>}
    {success&&<span className="sr-only" role="status">{t[message]}</span>}
    {error&&<span className="saved-feedback" role="status">{t[error]} <button type="button" disabled={pending} onClick={()=>{setMessage(null);scope.retry();void refresh();}}>{t.retry}</button></span>}
  </span>;
}
