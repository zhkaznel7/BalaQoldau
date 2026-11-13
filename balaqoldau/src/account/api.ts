import type {ContactInput,ReportInput} from '../api/client.ts';
import type { AuthMessage, Language } from './translations.ts';
import { isProgramId,parseProgram } from '../api/client.ts';
import type { Page,Program } from '../api/client.ts';
import {parseChild,parseChildOptions} from './children.ts';
import type {ChildInput} from './children.ts';
import {validFamilyContext} from './family.ts';
import type {FamilyContext} from './family.ts';
export interface UserProfile { id: string; email: string; language: Language }
export interface UserSession { authenticated: boolean; user: UserProfile | null; csrfToken: string; resetAvailable: boolean }
export interface DashboardProfile extends UserProfile {fullName:string|null;location:string|null;savedCount:number;familyContext?:FamilyContext|null}
export interface ProfileInput {fullName:string|null;location:string|null;familyContext?:FamilyContext|null}
export class UserAuthError extends Error {
  readonly status: number;
  readonly key: AuthMessage;
  constructor(status: number, key: AuthMessage) { super(key); this.status=status; this.key=key; }
}
const object = (value: unknown): Record<string,unknown> => {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new UserAuthError(503,'unavailable');
  return value as Record<string,unknown>;
};
function profile(value: unknown): UserProfile {
  const p=object(value);
  if(typeof p.id!=='string' || !/^[a-f0-9-]{36}$/i.test(p.id) || typeof p.email!=='string' || p.email.length>254 || !['kk','ru'].includes(String(p.language))) throw new UserAuthError(503,'unavailable');
  return p as unknown as UserProfile;
}
function dashboard(value:unknown):DashboardProfile {
  const p=object(value);profile(p);
  if(p.familyContext!==undefined&&!validFamilyContext(p.familyContext))throw new UserAuthError(503,'unavailable');
  if(!['fullName','location'].every(key=>p[key]===null||(typeof p[key]==='string'&&[...String(p[key])].length<=100))||!Number.isSafeInteger(p.savedCount)||Number(p.savedCount)<0)throw new UserAuthError(503,'unavailable');
  return p as unknown as DashboardProfile;
}
export function normalizeProfile(input:{fullName:string;location:string;familyContext?:FamilyContext|null}):ProfileInput|null {
  if(input.familyContext!==undefined&&!validFamilyContext(input.familyContext))return null;
  const values=[input.fullName,input.location];
  if(values.some(value=>[...value].some(character=>{const code=character.charCodeAt(0);return code<32||(code>=127&&code<=159);})))return null;
  const [fullName,location]=values.map(value=>value.normalize('NFC').trim().replace(/\s+/gu,' '));
  if([...fullName].length>100||[...location].length>100)return null;
  return {fullName:fullName||null,location:location||null,...(input.familyContext===undefined?{}:{familyContext:input.familyContext})};
}
export function safeReturnTo(value:string|null):string {
  if(!value||value.includes('\\')||[...value].some(character=>character.charCodeAt(0)<=32)||!/^\/(?:results|find|favorites|profile(?:\/(?:saved|children|messages))?|program\/[a-f0-9-]{36})(?:[?#]|$)/i.test(value))return '/profile';
  try{const url=new URL(value,'https://local.invalid');return url.origin==='https://local.invalid'?url.pathname+url.search+url.hash:'/profile';}catch{return '/profile';}
}
export function passwordError(value:string):'passwordShort'|'passwordLong'|null {
  if([...value].length<8)return 'passwordShort';
  return new TextEncoder().encode(value).length>256?'passwordLong':null;
}
export const validNewPassword = (value:string) => passwordError(value)===null;
export function resetTokenFromHash(hash:string):string {
  if(!hash.startsWith('#')) return '';
  const values=new URLSearchParams(hash.slice(1)); const value=values.get('token')??'';
  return values.size===1 && /^[a-f0-9]{64}$/.test(value)?value:'';
}
export function createUserApi(fetcher:typeof fetch=fetch, expired:()=>void=()=>{}) {
  let csrf='',busy=false,epoch=0;
  async function request(path:string,method='GET',body?:unknown,signal?:AbortSignal) {
    let response:Response;
    try { response=await fetcher('/api/auth'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal,
      headers:method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},...(body===undefined?{}:{body:JSON.stringify(body)})}); }
    catch(error) { if(signal?.aborted) throw error; throw new UserAuthError(0,'unknown'); }
    if(signal?.aborted) throw new DOMException('Aborted','AbortError');
    if(!response.ok) {
      if(response.status===401 && path!=='/login'){csrf='';epoch++;expired();}
      let code=''; try{const payload=object(await response.json()); code=String(object(payload.error).code);}catch{/* Never echo server details. */}
      const key:AuthMessage=response.status===401?(path==='/login'?'credentials':'expired'):response.status===403?'forbidden':response.status===429?'limited':code==='PASSWORD_TOO_SHORT'?'passwordShort':code==='PASSWORD_TOO_LONG'?'passwordLong':
        code==='CHILD_LIMIT'?'childLimit':path.startsWith('/children')&&response.status===404?'childMissing':path.startsWith('/children')&&response.status===409?'childConflict':path.startsWith('/children')&&response.status===400?'childInvalid':code==='RESET_UNAVAILABLE'?'noMail':code==='INVALID_RESET'?'invalidReset':code==='PASSWORD_POLICY'?'passwordInvalid':response.status===404&&path.startsWith('/saved-programs/')?'programUnavailable':response.status===409?'conflict':response.status===400?'invalid':'unavailable';
      throw new UserAuthError(response.status,key);
    }
    if(response.status===204)return null;
    try{const payload=object(await response.json());return path.startsWith('/messages?')||path.startsWith('/saved-programs?')||/^\/children\/[^/]+\/recommendations\?/.test(path)?payload:payload.data;}catch{throw new UserAuthError(503,'unavailable');}
  }
  function sessionData(value:unknown):UserSession {
    const data=object(value);
    if(typeof data.authenticated!=='boolean' || typeof data.csrfToken!=='string' || !/^[a-f0-9]{64}$/.test(data.csrfToken) || typeof data.resetAvailable!=='boolean'
      || (!data.authenticated && data.user!==null)) throw new UserAuthError(503,'unavailable');
    return { authenticated:data.authenticated,user:data.authenticated?profile(data.user):null,csrfToken:data.csrfToken,resetAvailable:data.resetAvailable };
  }
  function accepted(value:unknown) {if(object(value).accepted!==true)throw new UserAuthError(503,'unavailable');}
  async function mutate<T>(work:()=>Promise<T>) {if(busy)throw new UserAuthError(409,'conflict');busy=true;epoch++;try{return await work();}finally{busy=false;epoch++;}}
  return {
    contact:(input:ContactInput,signal?:AbortSignal)=>mutate(async()=>{const p=object(await request('/contact-messages','POST',input,signal));if(!isProgramId(String(p.id)))throw new UserAuthError(503,'unavailable');}),
    report:(id:string,input:ReportInput,signal?:AbortSignal)=>mutate(async()=>{if(!isProgramId(id))throw new UserAuthError(400,'invalid');accepted(await request('/programs/'+id+'/reports','POST',input,signal));}),
    async messages(page=1,signal?:AbortSignal){
      const payload=object(await request('/messages?page='+page+'&limit=20','GET',undefined,signal)),p=object(payload.pagination);
      if(!Array.isArray(payload.data)||payload.data.length>20||!['page','limit','total','totalPages'].every(k=>Number.isSafeInteger(p[k])&&Number(p[k])>=0)||p.page!==page||p.limit!==20||p.totalPages!==Math.ceil(Number(p.total)/20))throw new UserAuthError(503,'unavailable');
      return {data:payload.data.map(value=>{const r=object(value);if(!isProgramId(String(r.id))||typeof r.text!=='string'||r.text.length>4000||!['contact','report'].includes(String(r.kind))||!Number.isFinite(Date.parse(String(r.createdAt))))throw new UserAuthError(503,'unavailable');return r as unknown as {id:string;text:string;kind:'contact'|'report';createdAt:string};}),pagination:p as unknown as Page<Program>['pagination']};
    },
    async children(signal?:AbortSignal){const value=await request('/children','GET',undefined,signal);try{if(!Array.isArray(value)||value.length>20)throw new Error();return value.map(parseChild);}catch{throw new UserAuthError(503,'unavailable');}},
    async childOptions(signal?:AbortSignal){try{return parseChildOptions(await request('/children/options','GET',undefined,signal));}catch(error){if(error instanceof UserAuthError)throw error;throw new UserAuthError(503,'unavailable');}},
    createChild:(input:ChildInput)=>mutate(async()=>{try{return parseChild(await request('/children','POST',input));}catch(error){if(error instanceof UserAuthError)throw error;throw new UserAuthError(503,'unavailable');}}),
    updateChild:(id:string,input:ChildInput,version:number)=>mutate(async()=>{if(!isProgramId(id))throw new UserAuthError(400,'childInvalid');try{return parseChild(await request('/children/'+id,'PATCH',{...input,version}));}catch(error){if(error instanceof UserAuthError)throw error;throw new UserAuthError(503,'unavailable');}}),
    deleteChild:(id:string,version:number)=>mutate(async()=>{if(!isProgramId(id))throw new UserAuthError(400,'childInvalid');await request('/children/'+id,'DELETE',{version,confirm:true});}),
    async childRecommendations(id:string,page=1,signal?:AbortSignal):Promise<Page<Program>>{
      if(!isProgramId(id)||!Number.isInteger(page)||page<1||page>10000)throw new UserAuthError(400,'childInvalid');
      const result=object(await request('/children/'+id+'/recommendations?page='+page+'&limit=20','GET',undefined,signal)),p=object(result.pagination);
      if(!Array.isArray(result.data)||result.data.length>20||!['page','limit','total','totalPages'].every(k=>Number.isSafeInteger(p[k])&&Number(p[k])>=0)||p.page!==page||p.limit!==20||p.totalPages!==Math.ceil(Number(p.total)/20))throw new UserAuthError(503,'unavailable');
      return {data:result.data.map(parseProgram),pagination:p as unknown as Page<Program>['pagination']};
    },
    busy:()=>busy,
    async session(signal?:AbortSignal) {const before=epoch,result=sessionData(await request('/session','GET',undefined,signal));if(before===epoch && !signal?.aborted)csrf=result.csrfToken;return result;},
    async profile(signal?:AbortSignal){return profile(await request('/profile','GET',undefined,signal));},
    async dashboard(signal?:AbortSignal){return dashboard(await request('/profile','GET',undefined,signal));},
    updateProfile:(input:ProfileInput)=>mutate(async()=>dashboard(await request('/profile','PATCH',input))),
    async savedPrograms(page=1,signal?:AbortSignal):Promise<Page<Program>> {
      const result=object(await request('/saved-programs?page='+page+'&limit=20','GET',undefined,signal)),pagination=object(result.pagination);
      if(!Array.isArray(result.data)||!['page','limit','total','totalPages'].every(key=>Number.isSafeInteger(pagination[key])&&Number(pagination[key])>=0)
        ||Number(pagination.limit)<1||Number(pagination.limit)>50||Number(pagination.page)<1||Number(pagination.page)>10000
        ||pagination.totalPages!==Math.ceil(Number(pagination.total)/Number(pagination.limit))||result.data.length>Number(pagination.limit))throw new UserAuthError(503,'unavailable');
      return {data:result.data.map(parseProgram),pagination:pagination as unknown as Page<Program>['pagination']};
    },
    async savedStatus(ids:string[],signal?:AbortSignal):Promise<string[]> {
      if(!ids.length)return [];if(ids.length>50||ids.some(id=>!isProgramId(id)))throw new UserAuthError(400,'invalid');
      const value=await request('/saved-programs/status?ids='+ids.join(','),'GET',undefined,signal);
      if(!Array.isArray(value)||value.some(id=>typeof id!=='string'||!ids.includes(id)))throw new UserAuthError(503,'unavailable');return value as string[];
    },
    saveProgram:(id:string)=>mutate(async()=>{if(!isProgramId(id))throw new UserAuthError(400,'invalid');await request('/saved-programs/'+id,'POST',{});}),
    removeProgram:(id:string)=>mutate(async()=>{if(!isProgramId(id))throw new UserAuthError(400,'invalid');await request('/saved-programs/'+id,'DELETE',{});}),
    login:(email:string,password:string)=>mutate(async()=>{const result=sessionData(await request('/login','POST',{email,password}));csrf=result.csrfToken;return result;}),
    register:(email:string,password:string,language:Language)=>mutate(async()=>accepted(await request('/register','POST',{email,password,language}))),
    logout:()=>mutate(async()=>{await request('/logout','POST',{});csrf='';}),
    requestReset:(email:string)=>mutate(async()=>accepted(await request('/password-reset/request','POST',{email}))),
    confirmReset:(token:string,password:string)=>mutate(async()=>{await request('/password-reset/confirm','POST',{token,password});csrf='';}),
  };
}
