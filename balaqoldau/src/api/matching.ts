export const matchCodes=['RULES_UNVERIFIED','AGE_MATCH','AGE_MISMATCH','AGE_MISSING','REGION_MATCH','REGION_MISMATCH','REGION_MISSING','NEED_MATCH','NEED_MISMATCH','NEED_MISSING','NEED_UNRESTRICTED','DEADLINE_OPEN','DEADLINE_PASSED'] as const;
export interface Matching {status:'MATCH'|'POSSIBLE'|'NOT_MATCH';checks:{code:typeof matchCodes[number];result:'satisfied'|'not_satisfied'|'missing'}[]}
export function matchingContext(params:URLSearchParams):string {
  const next=new URLSearchParams();for(const name of ['age','region','need']){const value=params.get(name);if(value)next.set(name,value);}
  return next.toString();
}
