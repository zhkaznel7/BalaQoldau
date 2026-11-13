import {useEffect,useId,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {ChevronDown} from 'lucide-react';
import {carryLanguage} from './language';
import './language.css';
import {tr} from '../i18n/ui';

// The URL remains the sole locale source. Remember navigation context, not a second locale state.
export function LanguageNavigation() {
  const location=useLocation(),navigate=useNavigate(),previousSearch=useRef(location.search);
  useEffect(()=>{
    const search=carryLanguage(previousSearch.current,location.search);previousSearch.current=search;
    document.documentElement.lang=new URLSearchParams(search).get('lang')==='ru'?'ru':'kk';
    if(search!==location.search)navigate({pathname:location.pathname,search,hash:location.hash},{replace:true,state:location.state,preventScrollReset:true});
  },[location,navigate]);
  return null;
}
export default function LanguageSwitcher() {
  const location=useLocation(),navigate=useNavigate(),language=new URLSearchParams(location.search).get('lang')==='ru'?'ru':'kk';
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
  const label=tr('m288');
  useEffect(()=>{
    if(!open)return;
    root.current?.querySelector<HTMLButtonElement>('[aria-checked=true]')?.focus();
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  function choose(value:'kk'|'ru') {
    const params=new URLSearchParams(location.search);params.set('lang',value);
    navigate({pathname:location.pathname,search:'?'+params.toString(),hash:location.hash},{replace:true,state:location.state,preventScrollReset:true});
    setOpen(false);trigger.current?.focus();
  }
  return <div className="language" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}
    onKeyDown={event=>{
      if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
      if(open&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const options=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')],index=options.indexOf(document.activeElement as HTMLButtonElement);
        const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next]?.focus();
      }
    }}>
    <button type="button" className="language-trigger" ref={trigger} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(!open&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true);}}}>
      {language==='ru'?'РУС':'ҚАЗ'}<ChevronDown aria-hidden="true" size={12}/>
    </button>
    {open&&<div id={id} className="language-menu" role="menu" aria-label={label}>
      <button type="button" role="menuitemradio" aria-checked={language==='kk'} lang="kk" tabIndex={-1} onClick={()=>choose('kk')}>Қазақша</button>
      <button type="button" role="menuitemradio" aria-checked={language==='ru'} lang="ru" tabIndex={-1} onClick={()=>choose('ru')}>Русский</button>
    </div>}
  </div>;
}
