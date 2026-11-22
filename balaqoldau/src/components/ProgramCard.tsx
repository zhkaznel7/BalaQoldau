import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {ArrowUpRight,MapPin,Users,Wallet,Palette,GraduationCap,HandHeart,ExternalLink} from 'lucide-react';
import type {Program} from '../api/client';
import MatchingSummary from './MatchingSummary';
import {matchingContext} from '../api/matching';
import ContentLanguageNotice from '../i18n/ContentLanguageNotice';
import {useCatalog} from '../hooks/useCatalog';
import {SaveProgramButton,SavedProgramsScope} from '../account/SavedProgramsScope';
import {authText} from '../account/translations';
const icons=[Wallet,Palette,GraduationCap,HandHeart];
export function ProgramGrid({programs}:{programs:Program[]}) {
  useUi();
  return <><ContentLanguageNotice/><SavedProgramsScope ids={programs.map(p=>p.id)}><div className="program-grid">{programs.map(program=><ProgramCard key={program.id} program={program}/>)}</div></SavedProgramsScope></>;
}
function ProgramCard({program}:{program:Program}) {
  useUi();
  const catalog=useCatalog(),location=useLocation(),[params]=useSearchParams(),t=authText[params.get('lang')==='ru'?'ru':'kk'];
  const query=matchingContext(params),detailUrl='/program/'+program.id+(query?'?'+query:'');
  const category=catalog.categories.find(item=>item.slug===program.category);
  const index=Math.max(0,catalog.categories.findIndex(item=>item.slug===program.category))%icons.length,Icon=icons[index];
  const regionNames=program.regions.map(slug=>catalog.regions.find(region=>region.slug===slug)?.name||slug);
  return <article className="program-card">
    <div className="card-top"><span className={`program-icon category-${index}`}><Icon aria-hidden="true" size={25}/></span><SaveProgramButton id={program.id} title={program.title}/></div>
    <span className="demo-tag">{params.get('lang')==='ru'?tr("m293"):tr("m294")}</span>
    <h2><Link to={detailUrl} state={{from:location.pathname+location.search}}>{program.title}</Link></h2><p className={`program-type category-${index}`}>{category?.name||program.category}</p>
    <div className="program-meta"><span><MapPin aria-hidden="true" size={15}/>{regionNames.join(', ')||(params.get('lang')==='ru'?tr("m295"):tr("m214"))}</span><span><Users aria-hidden="true" size={15}/>{program.ageMin}–{program.ageMax} {params.get('lang')==='ru'?tr("m296"):tr("m215")}</span></div>
    {program.matching&&<MatchingSummary matching={program.matching}/>}
    <a className="official-source" href={program.sourceUrl} target="_blank" rel="noopener noreferrer" aria-describedby="external-link-note">{program.sourceName} <ExternalLink aria-hidden="true" size={13}/></a>
    <Link className="card-detail" to={`/program/${program.id}`} state={{from:location.pathname+location.search}} aria-label={`${program.title}: ${t.details}`}>{t.details} <ArrowUpRight aria-hidden="true" size={18}/></Link>
  </article>;
}
