export interface MatchInput {age?:number|undefined;region?:string|undefined;need?:string|undefined}
export interface MatchProgram {
  id:string;ageMin:number;ageMax:number;regions:string[];familyCategories:string[];
  eligibilityComplete?:boolean;verifiedAt:unknown;sourceUrl:string|null;sourceName:string|null;deadline:string|null;
}
export type MatchCode='RULES_UNVERIFIED'|'AGE_MATCH'|'AGE_MISMATCH'|'AGE_MISSING'|'REGION_MATCH'|'REGION_MISMATCH'|'REGION_MISSING'|'NEED_MATCH'|'NEED_MISMATCH'|'NEED_MISSING'|'NEED_UNRESTRICTED'|'DEADLINE_OPEN'|'DEADLINE_PASSED';
export interface MatchResult {status:'MATCH'|'POSSIBLE'|'NOT_MATCH';checks:{code:MatchCode;result:'satisfied'|'not_satisfied'|'missing'}[]}
export function matchingToday():string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
export function evaluateMatch(p:MatchProgram,input:MatchInput,today=matchingToday()):MatchResult {
  // Legacy defaults and publication alone are not evidence of complete eligibility.
  if(!p.eligibilityComplete||!p.verifiedAt||!p.sourceUrl||!p.sourceName||!p.regions.length||
    !Number.isInteger(p.ageMin)||!Number.isInteger(p.ageMax)||p.ageMin<0||p.ageMax>17||p.ageMin>p.ageMax){
    return {status:'POSSIBLE',checks:[{code:'RULES_UNVERIFIED',result:'missing'}]};
  }
  const checks:MatchResult['checks']=[];
  function add(missing:boolean,ok:boolean,yes:MatchCode,no:MatchCode,unknown:MatchCode){checks.push({code:missing?unknown:ok?yes:no,result:missing?'missing':ok?'satisfied':'not_satisfied'});}
  add(input.age===undefined,input.age!==undefined&&input.age>=p.ageMin&&input.age<=p.ageMax,'AGE_MATCH','AGE_MISMATCH','AGE_MISSING');
  add(input.region===undefined,p.regions.includes(input.region??''),'REGION_MATCH','REGION_MISMATCH','REGION_MISSING');
  if(p.familyCategories.length)add(input.need===undefined,p.familyCategories.includes(input.need??''),'NEED_MATCH','NEED_MISMATCH','NEED_MISSING');
  else checks.push({code:'NEED_UNRESTRICTED',result:'satisfied'});
  checks.push({code:p.deadline&&p.deadline<today?'DEADLINE_PASSED':'DEADLINE_OPEN',result:p.deadline&&p.deadline<today?'not_satisfied':'satisfied'});
  return {status:checks.some(c=>c.result==='not_satisfied')?'NOT_MATCH':checks.some(c=>c.result==='missing')?'POSSIBLE':'MATCH',checks};
}
export function compareMatches(a:MatchProgram,b:MatchProgram,input:MatchInput,today=matchingToday()):number {
  const score=(p:MatchProgram)=>[({MATCH:0,POSSIBLE:1,NOT_MATCH:2})[evaluateMatch(p,input,today).status],
    input.need&&p.familyCategories.includes(input.need)?0:1,input.region&&p.regions.includes(input.region)?0:1,
    input.age!==undefined&&input.age>=p.ageMin&&input.age<=p.ageMax?0:1,p.deadline&&p.deadline<today?1:0];
  const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]!-y[i]!;
  return a.id<b.id?-1:a.id>b.id?1:0;
}
