export interface FamilyContext {childrenCount?:number|null;singleParent?:boolean|null;largeFamily?:boolean|null;disabilitySupportEligible?:boolean|null;supportNeeds?:string[]}
export const supportNeeds=['education-support','creative-development','sports-activities'];
export function validFamilyContext(value:unknown,household=true):value is FamilyContext|null {
 if(value===null)return true;if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const p=value as Record<string,unknown>,flags=household?['singleParent','largeFamily','disabilitySupportEligible']:['disabilitySupportEligible'];
 if(Object.keys(p).some(key=>![...flags,'supportNeeds',...(household?['childrenCount']:[])].includes(key)))return false;
 if(p.childrenCount!==undefined&&p.childrenCount!==null&&(!Number.isInteger(p.childrenCount)||Number(p.childrenCount)<0||Number(p.childrenCount)>30))return false;
 if(flags.some(key=>p[key]!==undefined&&p[key]!==null&&typeof p[key]!=='boolean'))return false;
 return p.supportNeeds===undefined||(Array.isArray(p.supportNeeds)&&p.supportNeeds.length<=3&&new Set(p.supportNeeds).size===p.supportNeeds.length&&p.supportNeeds.every(v=>typeof v==='string'&&supportNeeds.includes(v)));
}
