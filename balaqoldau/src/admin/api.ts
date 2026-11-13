import {parseReply} from './replies.ts';
import type {InboxKind} from './replies.ts';
import {tr} from '../i18n/ui.ts';
import { isProgramId } from '../api/client.ts';
import type { Access, Session, Program, ProgramInput, Taxonomy, Action, Status } from './types.ts';
import type {AdminDashboard,VerificationEntry,Report,ReportStatus} from './types.ts';
import type {ContactMessage,ContactStatus} from './types.ts';
function contactData(value:unknown):ContactMessage {
 const p=record(value);
 if(typeof p.id!=='string'||!isProgramId(p.id)||typeof p.senderName!=='string'||p.senderName.length>100||typeof p.email!=='string'||p.email.length>254||!['unread','read','resolved'].includes(String(p.status))||!Number.isSafeInteger(p.version)||Number(p.version)<1||!['createdAt','updatedAt'].every(k=>typeof p[k]==='string'&&Number.isFinite(Date.parse(String(p[k]))))||!((typeof p.preview==='string'&&p.preview.length<=320)||(typeof p.message==='string'&&p.message.length<=4000)))throw bad();
 return p as unknown as ContactMessage;
}

const messages: Record<number, string> = { 0: tr("m032"), 400: tr("m033"),
  401: tr("m034"), 403: tr("m035"),
  404: tr("m036"), 409: tr("m037"),
  413: tr("m038"), 429: tr("m039") };
export class AdminError extends Error {
  readonly status: number;
  readonly retryAt:number|undefined;
  constructor(status: number, login = false,retryAt?:number) { super(login && status === 401 ? tr("m040") : messages[status] ?? tr("m041")); this.status = status;this.retryAt=retryAt; }
}
export function parseRetryAfter(value:string|null,now=Date.now()):number|undefined {
  if(!value?.trim())return undefined;
  const text=value.trim();
  if(/^\d+$/.test(text)){const at=now+Number(text)*1000;return Number.isSafeInteger(at)&&at<=8640000000000000?at:undefined;}
  if(!/^[A-Za-z]{3},/.test(text))return undefined;
  const at=Date.parse(text);return Number.isFinite(at)?Math.max(now,at):undefined;
}
// Abort the subscriber, not the shared request (StrictMode/focus can subscribe again).
function subscribe<T>(promise:Promise<T>,signal?:AbortSignal):Promise<T>{
  if(!signal)return promise;
  if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};
    signal.addEventListener('abort',abort,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
const bad = () => new AdminError(503);
function pageData<T>(value:unknown,parse:(v:unknown)=>T){const payload=record(value),p=record(payload.pagination);
  if(!Array.isArray(payload.data)||!['page','limit','total','totalPages'].every(k=>Number.isSafeInteger(p[k])&&Number(p[k])>=0)||Number(p.page)<1||Number(p.page)>10000||Number(p.limit)<1||Number(p.limit)>50||p.totalPages!==Math.ceil(Number(p.total)/Number(p.limit))||payload.data.length>Number(p.limit))throw bad();
  return {data:payload.data.map(parse),pagination:p as unknown as {page:number;limit:number;total:number;totalPages:number}};
}
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad(); return value as Record<string, unknown>; }
function sessionData(value: unknown): Session {
  const data = record(value), admin = data.admin === null ? null : record(data.admin);
  if (typeof data.authenticated !== 'boolean' || typeof data.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.csrfToken)
    || (data.authenticated && (!admin || typeof admin.id !== 'string' || !isProgramId(admin.id)))) throw bad();
  return { authenticated: data.authenticated, admin: admin ? { id: String(admin.id) } : null, csrfToken: data.csrfToken };
}
function programData(value: unknown): Program {
  const p = record(value);
  if(p.expiresOn!==undefined&&p.expiresOn!==null&&(typeof p.expiresOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.expiresOn)))throw bad();
  for(const key of ['sourceNeedsRecheck','expired','needsReverification'])if(p[key]!==undefined&&typeof p[key]!=='boolean')throw bad();
  if(p.eligibilityComplete!==undefined&&typeof p.eligibilityComplete!=='boolean')throw bad();
  if (typeof p.id !== 'string' || !isProgramId(p.id) || !['draft','review','verified','published','rejected','archived'].includes(String(p.status))
    || !Number.isInteger(p.version) || Number(p.version) < 1 || typeof p.isDemo !== 'boolean') throw bad();
  for (const key of ['slug','category','title','description']) if (typeof p[key] !== 'string') throw bad();
  for (const key of ['sourceUrl','applyUrl']) {
    if (p[key] !== null) { try { const u = new URL(String(p[key])); if (u.protocol !== 'https:' || u.username || u.password) throw bad(); } catch { throw bad(); } }
  }
  for (const key of ['sourceName','deadline','verifiedAt','createdBy','submittedBy','reviewedBy']) if (p[key] !== null && typeof p[key] !== 'string') throw bad();
  for (const key of ['regions','familyCategories']) if (!Array.isArray(p[key]) || !(p[key] as unknown[]).every(item => typeof item === 'string')) throw bad();
  if (!Number.isInteger(p.ageMin) || !Number.isInteger(p.ageMax) || Number(p.ageMin) < 0 || Number(p.ageMax) > 17 || Number(p.ageMin) > Number(p.ageMax)) throw bad();
  return p as unknown as Program;
}
export function createAdminApi(base = '/api/admin', fetcher: typeof fetch = fetch, expired: () => void = () => {}) {
  if (!/^\/(?!\/)[A-Za-z0-9/_-]+$/.test(base)) throw new AdminError(503);
  base = base.replace(/\/$/, '');
  let csrf = '', changing = false, epoch = 0;
  let sessionFlight:Promise<Session>|undefined,accessFlight:Promise<Access>|undefined,verificationBackoff:AdminError|undefined;
  async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal, login = false, envelope = false): Promise<unknown> {
    const verification=method==='GET'&&(path==='/session'||path==='/access');
    if(verification&&verificationBackoff?.retryAt!==undefined&&verificationBackoff.retryAt>Date.now())throw verificationBackoff;
    const before=epoch;
    const headers: Record<string, string> = {};
    if (method !== 'GET') { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrf; }
    let response: Response;
    try { response = await fetcher(base + path, { method, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      ...(signal ? { signal } : {}), ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch (error) { if (signal?.aborted) throw error; throw new AdminError(0); }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!response.ok) {
      if (response.status === 401 && !login&&before===epoch) { csrf = ''; epoch++; expired(); }
      const retryAt=parseRetryAfter(response.headers.get('Retry-After'))??(response.status===429?Date.now()+5000:undefined);
      const failure=new AdminError(response.status,login,retryAt);
      if(verification&&retryAt!==undefined)verificationBackoff=failure;
      throw failure;
    }
    if (response.status === 204) return null;
    try { const value = record(await response.json()); return envelope ? value : value.data ?? badResponse(); } catch { throw bad(); }
  }
  function badResponse(): never { throw bad(); }
  async function verificationRequest(path:string):Promise<unknown>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{return await request(path,'GET',undefined,controller.signal);}
    catch(error){if(controller.signal.aborted)throw new AdminError(0);throw error;}
    finally{clearTimeout(timer);}
  }
  function session(signal?: AbortSignal):Promise<Session> {
    if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
    if(!sessionFlight){
      const before=epoch;
      const work=(async()=>{const result=sessionData(await verificationRequest('/session'));if(before===epoch)csrf=result.csrfToken;return result;})();
      sessionFlight=work;const clear=()=>{if(sessionFlight===work)sessionFlight=undefined;};void work.then(clear,clear);
    }
    return subscribe(sessionFlight,signal);
  }
  async function mutation<T>(work: () => Promise<T>): Promise<T> {
    if (changing) throw new AdminError(409);
    changing = true;
    try { return await work(); } finally { changing = false; }
  }
  const validId = (id: string) => { if (!isProgramId(id)) throw new AdminError(400); return id; };
  return {
    async dashboard(signal?:AbortSignal):Promise<AdminDashboard>{
      const value=record(await request('/programs/dashboard','GET',undefined,signal)),counts=record(value.counts);
      if(Object.keys(counts).length!==9||!['total','draft','review','verified','published','rejected','archived','needsReverification','expired'].every(k=>Number.isSafeInteger(counts[k])&&Number(counts[k])>=0)||!Number.isInteger(value.reviewPeriodDays)||Number(value.reviewPeriodDays)<7||Number(value.reviewPeriodDays)>730||!Array.isArray(value.recent)||value.recent.length>10)throw bad();
      for(const item of value.recent){const p=record(item);if(!isProgramId(String(p.id))||typeof p.title!=='string'||!['draft','review','verified','published','rejected','archived'].includes(String(p.status))||!Number.isInteger(p.version)||Number(p.version)<1||!Number.isFinite(Date.parse(String(p.updatedAt))))throw bad();}
      return value as unknown as AdminDashboard;
    },
    async history(id:string,page=1,signal?:AbortSignal){
      return pageData(await request('/programs/'+validId(id)+'/history?page='+page,'GET',undefined,signal,false,true),value=>{
        const e=record(value);if(!isProgramId(String(e.id))||!isProgramId(String(e.actorId))||!['approve','reject','recheck'].includes(String(e.decision))||typeof e.notes!=='string'||e.notes.length>1000||!Number.isInteger(e.programVersion)||!['sourceReviewed','informationReviewed','eligibilityReviewed'].every(k=>typeof e[k]==='boolean')||!Number.isFinite(Date.parse(String(e.createdAt))))throw bad();return e as unknown as VerificationEntry;
      });
    },
    async replies(kind:InboxKind,id:string,signal?:AbortSignal){const rows=await request('/'+kind+'/'+validId(id)+'/replies','GET',undefined,signal);if(!Array.isArray(rows)||rows.length>50)throw bad();return rows.map(parseReply);},
    reply:(kind:InboxKind,id:string,text:string,submissionId:string)=>mutation(async()=>parseReply(await request('/'+kind+'/'+validId(id)+'/replies','POST',{text,submissionId}))),
    async reports(query:string,signal?:AbortSignal){
      const params=new URLSearchParams(query);params.delete('lang');
      return pageData(await request('/reports?'+params,'GET',undefined,signal,false,true),value=>{const r=record(value);if(!isProgramId(String(r.id))||!isProgramId(String(r.programId))||typeof r.programTitle!=='string'||!['incorrect','outdated','source_broken','other'].includes(String(r.reason))||!(r.explanation===null||typeof r.explanation==='string')||!['open','reviewed','resolved','dismissed'].includes(String(r.status))||!Number.isInteger(r.version)||Number(r.version)<1||!Number.isFinite(Date.parse(String(r.createdAt))))throw bad();return r as unknown as Report;});
    },
    moderateReport:(id:string,version:number,status:ReportStatus)=>mutation(async()=>{const result=record(await request('/reports/'+validId(id),'POST',{version,status}));if(result.id!==id||result.status!==status||result.version!==version+1)throw bad();}),
    session,
    async contacts(query:string,signal?:AbortSignal){
      const parsed=new URLSearchParams(query);parsed.delete('lang');
      const payload=await request('/contact-messages?'+parsed,'GET',undefined,signal,false,true),page=pageData(payload,contactData),count=record(payload).unreadCount;
      if(!Number.isSafeInteger(count)||Number(count)<0)throw bad();return {...page,unreadCount:Number(count)};
    },
    async contact(id:string,signal?:AbortSignal){const result=contactData(await request('/contact-messages/'+validId(id),'GET',undefined,signal));if(result.id!==id||typeof result.message!=='string')throw bad();return result;},
    changeContact:(id:string,version:number,status:ContactStatus)=>mutation(async()=>{const result=contactData(await request('/contact-messages/'+validId(id),'POST',{version,status}));if(result.id!==id||result.version!==version+1||result.status!==status||typeof result.message!=='string')throw bad();return result;}),
    busy: () => changing,
    login: (email: string, password: string) => mutation(async () => { await session();epoch++;accessFlight=undefined; const result = sessionData(await request('/login', 'POST', { email, password }, undefined, true)); csrf = result.csrfToken; epoch++; return result; }),
    logout: () => mutation(async () => { await request('/logout', 'POST', {}); csrf = ''; epoch++; }),
    access(signal?: AbortSignal): Promise<Access> {
      if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
      if(!accessFlight){
        const work=(async()=>{const value=record(await verificationRequest('/access'));
          if(typeof value.id!=='string'||!isProgramId(value.id)||!['editor','reviewer','admin'].includes(String(value.role))||!Array.isArray(value.permissions)||!value.permissions.every(item=>typeof item==='string'))throw bad();
          return value as unknown as Access;})();
        accessFlight=work;const clear=()=>{if(accessFlight===work)accessFlight=undefined;};void work.then(clear,clear);
      }
      return subscribe(accessFlight,signal);
    },
    async programs(query: string, signal?: AbortSignal) {
      const params=new URLSearchParams(query);params.delete('lang');
      const payload = record(await request('/programs?' + params.toString(), 'GET', undefined, signal, false, true));
      const page = record(payload.pagination);
      if (!Array.isArray(payload.data) || !['page','limit','total','totalPages'].every(key => Number.isInteger(page[key]) && Number(page[key]) >= 0)) throw bad();
      return { data: payload.data.map(programData), pagination: page as unknown as { page: number; limit: number; total: number; totalPages: number } };
    },
    async program(id: string, signal?: AbortSignal) { return programData(await request('/programs/' + validId(id), 'GET', undefined, signal)); },
    async taxonomy(signal?: AbortSignal): Promise<Taxonomy> {
      const result = record(await request('/programs/taxonomy', 'GET', undefined, signal));
      for (const key of ['categories','regions','familyCategories']) if (!Array.isArray(result[key]) || !(result[key] as unknown[]).every(item => { const t = record(item); return typeof t.slug === 'string' && typeof t.name === 'string'; })) throw bad();
      return result as unknown as Taxonomy;
    },
    create: (input: ProgramInput) => mutation(async () => programData(await request('/programs', 'POST', input))),
    update: (id: string, input: Omit<ProgramInput, 'isDemo'> & { version: number }) => mutation(async () => programData(await request('/programs/' + validId(id), 'PATCH', input))),
    action: (id: string, action: Action, version: number,decision:Record<string,unknown>={}) => mutation(async () => programData(await request('/programs/' + validId(id) + '/' + action, 'POST', { version,...(['publish','archive'].includes(action)?{confirm:true}:{}),...decision }))),
  };
}
export type AdminApi = ReturnType<typeof createAdminApi>;
export type { Status };
