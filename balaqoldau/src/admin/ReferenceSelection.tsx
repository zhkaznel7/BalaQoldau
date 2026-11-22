import {useState} from 'react';
import {tr} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import {referenceName,nationwideRegions} from '../api/reference-data';
import type {Reference} from '../api/reference-data';

export default function ReferenceSelection({kind,options,selected,onChange}:{kind:'regions'|'familyCategories';options:Reference[];selected:string[];onChange:(values:string[])=>void}){
  useUi();const [query,setQuery]=useState('');
  const all=nationwideRegions(options),nationwide=all.length===20&&all.every(slug=>selected.includes(slug));
  const toggle=(slug:string,checked:boolean)=>onChange(checked?[...new Set([...selected,slug])]:selected.filter(value=>value!==slug));
  const visible=options.filter(item=>referenceName(kind,item.slug,item.name).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <fieldset id={'program-'+kind} tabIndex={-1} className="admin-reference-section"><legend>{tr(kind==='regions'?'m181':'m455')}</legend>
    <p className="admin-muted">{tr(kind==='regions'?'m447':'m448')}</p>
    {selected.some(slug=>!options.some(item=>item.slug===slug))&&<p role="status">{tr('m456')} <button type="button" onClick={()=>onChange(selected.filter(slug=>options.some(item=>item.slug===slug)))}>{tr('m457')}</button></p>}
    {kind==='regions'&&options.length>0&&<>
      <label className="admin-check"><input id="program-nationwide" type="checkbox" checked={nationwide} disabled={!all.length} onChange={event=>onChange(event.target.checked?[...new Set([...selected,...all])]:selected.filter(slug=>!all.includes(slug)))}/>{tr('m445')}</label>
      <label htmlFor="program-region-search">{tr('m446')}</label><input id="program-region-search" type="search" value={query} maxLength={100} onChange={event=>setQuery(event.target.value)}/>
    </>}
    <div className="admin-checks">{visible.map(item=><label className="admin-check" key={item.slug}><input type="checkbox" value={item.slug} checked={selected.includes(item.slug)} onChange={event=>toggle(item.slug,event.target.checked)}/>{referenceName(kind,item.slug,item.name)}</label>)}</div>
    {!options.length?<p role="status">{tr('m452')}</p>:!visible.length&&<p role="status">{tr('m450')}</p>}
  </fieldset>;
}
