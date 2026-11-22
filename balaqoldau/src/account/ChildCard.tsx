import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {Pencil, Search, Trash2, UserRound} from 'lucide-react';
import {categoryName} from '../api/categories';
import {referenceName} from '../api/reference-data';
import {tr} from '../i18n/ui';
import {childOpportunityUrl, interestLabels} from './children';
import type {Child, ChildInterest, ChildOptions} from './children';

export default function ChildCard({child,index,options,locked,selected,edit,remove,recommend}:{
  child:Child;index:number;options:ChildOptions;locked:boolean;selected:boolean;
  edit:()=>void;remove:()=>void;recommend:()=>void;
}) {
  const [params]=useSearchParams();
  const language=params.get('lang')==='ru'?'ru':'kk';
  const interests=child.interests??[];
  const [interest,setInterest]=useState(interests[0]);
  const title=child.nickname||tr('m336',{0:index+1});
  const region=referenceName('regions',child.region,options.regions.find(r=>r.slug===child.region)?.name??child.region);

  return <article className="account-panel child-card" aria-labelledby={'child-title-'+child.id}>
    <header className="child-card-header">
      <span className="child-card-avatar"><UserRound size={20} aria-hidden="true"/></span>
      <h2 id={'child-title-'+child.id}>{title}</h2>
    </header>
    <dl className="child-facts">
      <div><dt>{tr('m339')}</dt><dd>{child.age}</dd></div>
      <div><dt>{tr('m340')}</dt><dd>{region}</dd></div>
      {child.fullName&&<div><dt>{tr('childFullNameLabel')}</dt><dd>{child.fullName}</dd></div>}
      <div><dt>{tr('childGenderLabel')}</dt><dd>{tr(child.gender==='female'?'m497':child.gender==='male'?'m498':'m477')}</dd></div>
      <div className="child-facts-wide"><dt>{tr('childInterestLabel')}</dt><dd>
        {interests.length ? <ul className="child-interests">{interests.map(value=><li key={value}>{tr(interestLabels[value])}</li>)}</ul> : tr('m477')}
      </dd></div>
      {child.preferences.length>0&&<div className="child-facts-wide"><dt>{tr('m341')}</dt><dd>
        {child.preferences.map(slug=>categoryName(slug,options.categories.find(c=>c.slug===slug)?.name??slug)).join(', ')}
      </dd></div>}
    </dl>
    <div className="child-card-footer">
      {interests.length>1&&<label className="child-interest-picker">
        <span>{tr('childSearchInterest')}</span>
        <select value={interest} onChange={e=>setInterest(e.target.value as ChildInterest)}>
          {interests.map(value=><option key={value} value={value}>{tr(interestLabels[value])}</option>)}
        </select>
      </label>}
      <div className="child-actions">
        <Link className="button primary child-find" to={childOpportunityUrl(child,language,interest)}
          aria-label={tr('childFindNamed',{0:title})}><Search size={16} aria-hidden="true"/>{tr('childFind')}</Link>
        <button type="button" id={'child-edit-'+child.id} className="button child-action" disabled={locked} onClick={edit}
          aria-label={tr('childEditNamed',{0:title})}><Pencil size={15} aria-hidden="true"/>{tr('m345')}</button>
        <button type="button" id={'child-delete-'+child.id} className="button child-action child-delete" disabled={locked} onClick={remove}
          aria-label={tr('childDeleteNamed',{0:title})}><Trash2 size={15} aria-hidden="true"/>{tr('m346')}</button>
      </div>
      <button type="button" className="button child-private-recommendations" disabled={locked} aria-pressed={selected}
        id={'child-recommend-'+child.id} onClick={recommend}>{tr('m353')}</button>
    </div>
  </article>;
}
