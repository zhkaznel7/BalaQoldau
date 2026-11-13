import FamilyFields from './FamilyFields';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useUser} from './context';
import {UserAuthError} from './api';
import type {Child,ChildOptions} from './children';
import {normalizeChild} from './children';
import {authText} from './translations';
import type {AuthMessage} from './translations';
import {useResource} from '../hooks/useResource';
import {tr} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import {ProgramGrid} from '../components/ProgramCard';
import ContentLanguageNotice from '../i18n/ContentLanguageNotice';
import './children.css';

function failure(error:unknown):AuthMessage{return error instanceof UserAuthError?error.key:'unavailable';}
function ChildError({error}:{error:unknown}){
  const [params]=useSearchParams(),{refresh}=useUser(),t=authText[params.get('lang')==='ru'?'ru':'kk'];
  return <div role="alert" className="account-feedback error"><p>{t[failure(error)]}</p><button type="button" className="button" onClick={()=>void refresh()}>{t.retry}</button></div>;
}
export default function ChildrenPage(){
  useUi();const {api}=useUser();
  const loader=useCallback(async(_key:string,signal:AbortSignal)=>{const [children,options]=await Promise.all([api.children(signal),api.childOptions(signal)]);return {children,options};},[api]);
  const state=useResource('children',loader),[editing,setEditing]=useState<Child|'new'|null>(null),[deleting,setDeleting]=useState<Child|null>(null),[selected,setSelected]=useState<Child|null>(null);
  const [notice,setNotice]=useState(''),[error,setError]=useState<unknown>(null),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false);
  const alive=useRef(true),confirmation=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(deleting)confirmation.current?.focus();},[deleting]);
  function reload(){setEditing(null);setDeleting(null);setSelected(null);setError(null);setUncertain(false);state.retry();}
  function cancelDeletion(){const id=deleting?.id;setDeleting(null);setError(null);queueMicrotask(()=>document.getElementById('child-delete-'+id)?.focus());}
  async function remove(){
    if(!deleting||pending||api.busy()||uncertain)return;setPending(true);setError(null);
    try{await api.deleteChild(deleting.id,deleting.version);if(alive.current){reload();setNotice('m352');}}
    catch(error){if(alive.current){setError(error);setUncertain(error instanceof UserAuthError&&[0,409].includes(error.status));}}
    finally{if(alive.current)setPending(false);}
  }
  if(state.loading)return <p role="status">{tr('m280')}</p>;
  if(state.error)return <><ChildError error={state.error}/><button className="button" onClick={state.retry}>{tr('m298')}</button></>;
  if(!state.data)return null;
  const {children,options}=state.data;
  return <div className="children-dashboard"><p className="child-privacy">{tr('m342')}</p><p className="field-hint">{tr('m361')}</p><ContentLanguageNotice/>
    {notice&&<p className="account-feedback" role="status">{tr(notice)}</p>}
    {!!error&&<ChildError error={error}/>}
    <button className="button primary" disabled={pending||children.length>=20||editing!==null||deleting!==null} onClick={()=>{setEditing('new');setNotice('');setSelected(null);}}>{tr('m337')}</button>
    {!children.length&&<p role="status" className="account-panel">{tr('m350')}</p>}
    <div className="child-card-grid">{children.map((child,index)=><article className="account-panel child-card" key={child.id}>
      <h2>{child.nickname||tr('m336',{0:index+1})}</h2><dl><dt>{tr('m339')}</dt><dd>{child.age}</dd><dt>{tr('m340')}</dt><dd>{options.regions.find(r=>r.slug===child.region)?.name??child.region}</dd></dl>
      <p>{child.preferences.map(slug=>options.categories.find(c=>c.slug===slug)?.name??slug).join(', ')}</p>
      <div className="child-actions"><button className="button" disabled={pending||deleting!==null} onClick={()=>{setEditing(child);setSelected(null);setNotice('');}}>{tr('m345')}</button>
      <button id={'child-delete-'+child.id} className="button" disabled={pending||deleting!==null} onClick={()=>{setDeleting(child);setEditing(null);setSelected(null);setError(null);setUncertain(false);}}>{tr('m346')}</button>
      <button className="button" disabled={pending||deleting!==null} aria-pressed={selected?.id===child.id} onClick={()=>{setSelected(child);setEditing(null);setNotice('');}}>{tr('m353')}</button></div>
    </article>)}</div>
    {editing!==null&&<ChildEditor key={editing==='new'?'new':editing.id+':'+editing.version} child={editing==='new'?undefined:editing} options={options} cancel={()=>setEditing(null)} saved={()=>{reload();setNotice('m351');}} reload={reload}/>}
    {deleting&&<section className="account-panel child-confirm" role="alertdialog" aria-labelledby="child-confirm-title" aria-describedby="child-confirm-description" onKeyDown={e=>{if(e.key==='Escape'&&!pending){e.preventDefault();cancelDeletion();}}}>
      <h2 id="child-confirm-title" tabIndex={-1} ref={confirmation}>{tr('m347')}</h2><p>{deleting.nickname||tr('m336',{0:children.findIndex(c=>c.id===deleting.id)+1})}</p><p id="child-confirm-description">{tr('m348')}</p>
      <div className="child-actions"><button className="button" disabled={pending} onClick={cancelDeletion}>{tr('m344')}</button><button className="button" disabled={pending||uncertain} onClick={()=>void remove()}>{tr('m349')}</button></div>
      {uncertain&&<button className="button" onClick={reload}>{tr('m359')}</button>}
    </section>}
    {selected&&<section className="child-recommendations" aria-labelledby="child-recommendations-title"><h2 id="child-recommendations-title">{tr('m354')}</h2><p>{tr('m356')}</p>
      <button className="button" onClick={()=>setSelected(null)}>{tr('m362')}</button><Recommendations key={selected.id+':'+selected.version} child={selected}/></section>}
  </div>;
}
function ChildEditor({child,options,cancel,saved,reload}:{child:Child|undefined;options:ChildOptions;cancel:()=>void;saved:()=>void;reload:()=>void}){
  useUi();const {api}=useUser(),[params]=useSearchParams(),t=authText[params.get('lang')==='ru'?'ru':'kk'];
  const [values,setValues]=useState({nickname:child?.nickname??'',age:child?String(child.age):'',region:child?.region??'',preferences:child?.preferences??[],familyContext:child?.familyContext??null});
  const [pending,setPending]=useState(false),[error,setError]=useState<unknown>(null),[invalid,setInvalid]=useState(false),[uncertain,setUncertain]=useState(false);
  const alive=useRef(true),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null);
  useEffect(()=>{alive.current=true;heading.current?.focus();return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(error||invalid)feedback.current?.focus();},[error,invalid]);
  async function submit(e:FormEvent){
    e.preventDefault();if(pending||uncertain||api.busy())return;const input=normalizeChild(values);setInvalid(!input);setError(null);if(!input)return;
    setPending(true);try{if(child)await api.updateChild(child.id,input,child.version);else await api.createChild(input);if(alive.current)saved();}
    catch(error){if(alive.current){setError(error);setUncertain(error instanceof UserAuthError&&[0,409].includes(error.status));}}
    finally{if(alive.current)setPending(false);}
  }
  return <section className="account-panel child-editor"><h2 ref={heading} tabIndex={-1}>{tr(child?'m345':'m337')}</h2>
    {(invalid||!!error)&&<div ref={feedback} tabIndex={-1}>{invalid?<p role="alert">{t.childInvalid}</p>:<ChildError error={error}/>}</div>}
    {!options.regions.length&&<p role="status">{tr('m358')}</p>}
    <form onSubmit={e=>void submit(e)} noValidate aria-busy={pending}><fieldset disabled={pending||uncertain}>
      <div className="account-field"><label htmlFor="child-nickname">{tr('m338')}</label><input id="child-nickname" autoComplete="off" maxLength={60} value={values.nickname} onChange={e=>setValues({...values,nickname:e.target.value})}/></div>
      <FamilyFields household={false} value={values.familyContext} onChange={familyContext=>setValues(value=>({...value,familyContext}))}/>
      <div className="account-field"><label htmlFor="child-age">{tr('m339')}</label><input id="child-age" type="number" min="0" max="17" step="1" required value={values.age} onChange={e=>setValues({...values,age:e.target.value})}/></div>
      <div className="account-field"><label htmlFor="child-region">{tr('m340')}</label><select id="child-region" required value={values.region} onChange={e=>setValues({...values,region:e.target.value})}><option value="">{tr('m182')}</option>{options.regions.map(r=><option key={r.slug} value={r.slug}>{r.name}</option>)}</select></div>
      <fieldset className="child-preferences"><legend>{tr('m341')}</legend><p id="child-preferences-hint">{tr('m357')}</p>{options.categories.map(c=><label key={c.slug}><input type="checkbox" aria-describedby="child-preferences-hint" checked={values.preferences.includes(c.slug)} disabled={values.preferences.length>=10&&!values.preferences.includes(c.slug)} onChange={e=>setValues({...values,preferences:e.target.checked?[...values.preferences,c.slug]:values.preferences.filter(v=>v!==c.slug)})}/>{c.name}</label>)}</fieldset>
      </fieldset><div className="child-actions"><button className="button primary" disabled={pending||uncertain||!options.regions.length}>{pending?t.pending:tr('m343')}</button><button type="button" className="button" disabled={pending} onClick={cancel}>{tr('m344')}</button></div>
      {uncertain&&<button type="button" className="button" onClick={reload}>{tr('m359')}</button>}
    </form>
  </section>;
}
function Recommendations({child}:{child:Child}){
  useUi();const {api}=useUser(),[page,setPage]=useState(1);
  const loader=useCallback((key:string,signal:AbortSignal)=>api.childRecommendations(child.id,Number(key),signal),[api,child.id]);
  const state=useResource(String(page),loader);
  if(state.loading)return <p role="status">{tr('m280')}</p>;
  if(state.error)return <><ChildError error={state.error}/><button className="button" onClick={state.retry}>{tr('m298')}</button></>;
  return <>{state.data?.data.length?<ProgramGrid programs={state.data.data}/>:<p className="account-panel" role="status">{tr('m355')}</p>}
    {state.data&&state.data.pagination.totalPages>1&&<nav className="pagination" aria-label={tr('m205')}><button className="button" disabled={page<=1} onClick={()=>setPage(page-1)}>{tr('m072')}</button><span>{page} / {state.data.pagination.totalPages}</span><button className="button" disabled={page>=state.data.pagination.totalPages} onClick={()=>setPage(page+1)}>{tr('m073')}</button></nav>}</>;
}
