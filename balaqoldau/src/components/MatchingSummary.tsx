import type {Matching} from '../api/matching';
import {tr} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
const labels={MATCH:'m306',POSSIBLE:'m307',NOT_MATCH:'m308'};
const explanations={RULES_UNVERIFIED:'m309',AGE_MATCH:'m310',AGE_MISMATCH:'m311',AGE_MISSING:'m312',REGION_MATCH:'m313',REGION_MISMATCH:'m314',REGION_MISSING:'m315',NEED_MATCH:'m316',NEED_MISMATCH:'m317',NEED_MISSING:'m318',NEED_UNRESTRICTED:'m319',DEADLINE_OPEN:'m320',DEADLINE_PASSED:'m321'};
export default function MatchingSummary({matching,expanded=false}:{matching:Matching;expanded?:boolean}){
  useUi();return <section className={'matching-summary matching-'+matching.status.toLowerCase()} aria-label={tr('m322')}>
    <strong>{tr(labels[matching.status])}</strong><details open={expanded}><summary>{tr('m322')}</summary>
    <ul>{matching.checks.map(check=><li key={check.code}><span className="matching-check-kind">{tr(check.result==='satisfied'?'m323':check.result==='not_satisfied'?'m324':'m325')}: </span>{tr(explanations[check.code])}</li>)}</ul>
    <p>{tr('m326')}</p></details>
  </section>;
}
