import {tr} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import {referenceName} from '../api/reference-data';
import {supportNeeds} from './family';
import type {FamilyContext} from './family';
export default function FamilyFields({value,onChange,household=true}:{value:FamilyContext|null;onChange:(value:FamilyContext|null)=>void;household?:boolean}){
 useUi();const p=value??{},prefix=household?'parent':'child',flags=household?['singleParent','largeFamily','disabilitySupportEligible']as const:['disabilitySupportEligible']as const;
 const labels={singleParent:'m474',largeFamily:'m475',disabilitySupportEligible:household?'m476':'m483'};
 return <fieldset><legend>{tr('m472')}</legend><p>{tr('m480')}</p>
  {household&&<div className="account-field"><label htmlFor={prefix+'-children-count'}>{tr('m473')}</label><input id={prefix+'-children-count'} type="number" min={0} max={30} step={1} value={p.childrenCount??''} onChange={e=>onChange({...p,childrenCount:e.target.value===''?null:e.target.valueAsNumber})}/></div>}
  {flags.map(key=><div className="account-field" key={key}><label htmlFor={prefix+'-'+key}>{tr(labels[key])}</label><select id={prefix+'-'+key} value={p[key]===undefined||p[key]===null?'':String(p[key])} onChange={e=>onChange({...p,[key]:e.target.value===''?null:e.target.value==='true'})}><option value="">{tr('m477')}</option><option value="true">{tr('m478')}</option><option value="false">{tr('m479')}</option></select></div>)}
  <fieldset><legend>{tr('m481')}</legend>{supportNeeds.map(slug=><label className="admin-check" key={slug}><input id={prefix+'-need-'+slug} value={slug} type="checkbox" checked={p.supportNeeds?.includes(slug)??false} onChange={e=>onChange({...p,supportNeeds:e.target.checked?[...(p.supportNeeds??[]),slug]:(p.supportNeeds??[]).filter(v=>v!==slug)})}/>{referenceName('familyCategories',slug,slug)}</label>)}</fieldset>
  <button type="button" className="button text-button" onClick={()=>onChange(null)}>{tr('m482')}</button>
 </fieldset>;
}
