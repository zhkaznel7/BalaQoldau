import {tr} from '../i18n/ui.ts';
import {matchCodes,matchingContext} from './matching.ts';
import type {Matching} from './matching.ts';
export interface Taxonomy { id: string; slug: string; name: string }
export interface Program {
  matching?:Matching;
  id: string; slug: string; category: string; title: string; description: string;
  sourceUrl: string; sourceName: string; verifiedAt: string; ageMin: number; ageMax: number;
  deadline: string | null; applyUrl: string | null; isDemo: false;
  regions: string[]; familyCategories: string[];
}
export interface Page<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface ContactInput {
  senderName: string;
  email: string;
  message: string;
  submissionId?: string;
}
export interface ReportInput {reason:'incorrect'|'outdated'|'source_broken'|'other';explanation:string|null}
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? (status === 400 ? tr("m145")
      : status === 404 ? tr("m146")
      : status === 429 ? tr("m147")
      : tr("m148")));
    this.status = status;
  }
}
export const isProgramId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const invalid = (): never => { throw new ApiError(0, tr("m149")); };
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
}
function text(value: unknown): string { return typeof value === 'string' ? value : invalid(); }
function integer(value: unknown, minimum = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum ? value : invalid();
}
function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(text) : invalid(); }
function https(value: unknown): string {
  const result = text(value);
  try { const url = new URL(result); if (url.protocol === 'https:' && !url.username && !url.password) return result; } catch { /* Reject unsafe links. */ }
  return invalid();
}
export function parseProgram(value: unknown): Program {
  const p = record(value);
  let matching:Matching|undefined;
  if(p.matching!==undefined){
    const m=record(p.matching);
    if(!['MATCH','POSSIBLE','NOT_MATCH'].includes(String(m.status))||!Array.isArray(m.checks)||!m.checks.length||m.checks.length>13)return invalid();
    const checks=m.checks.map(value=>{const c=record(value);if(!matchCodes.includes(c.code as typeof matchCodes[number])||!['satisfied','not_satisfied','missing'].includes(String(c.result)))return invalid();return c as unknown as Matching['checks'][number];});
    const expected=checks.some(c=>c.result==='not_satisfied')?'NOT_MATCH':checks.some(c=>c.result==='missing')?'POSSIBLE':'MATCH';
    if(expected!==m.status||new Set(checks.map(c=>c.code)).size!==checks.length)return invalid();
    matching={status:m.status as Matching['status'],checks};
  }
  if (p.isDemo !== false || (p.status !== undefined && p.status !== 'published')) return invalid();
  const id = text(p.id);
  const ageMin = integer(p.ageMin), ageMax = integer(p.ageMax);
  if (!isProgramId(id) || ageMin > ageMax || ageMax > 17 || !Number.isFinite(Date.parse(text(p.verifiedAt)))) return invalid();
  return { id, slug: text(p.slug), category: text(p.category), title: text(p.title), description: text(p.description),
    sourceUrl: https(p.sourceUrl), sourceName: text(p.sourceName), verifiedAt: text(p.verifiedAt), ageMin, ageMax,
    deadline: p.deadline === null ? null : text(p.deadline), applyUrl: p.applyUrl === null ? null : https(p.applyUrl),
    isDemo: false, regions: strings(p.regions), familyCategories: strings(p.familyCategories),...(matching?{matching}:{}) };
}
function parseTaxonomy(value: unknown): Taxonomy {
  const item = record(value);
  return { id: text(item.id), slug: text(item.slug), name: text(item.name) };
}
function parsePage<T>(value: unknown, parse: (item: unknown) => T): Page<T> {
  const result = record(value), pagination = record(result.pagination);
  if (!Array.isArray(result.data)) return invalid();
  const meta = { page: integer(pagination.page, 1), limit: integer(pagination.limit, 1), total: integer(pagination.total), totalPages: integer(pagination.totalPages) };
  if (meta.limit > 50 || meta.page > 10000 || meta.totalPages !== Math.ceil(meta.total / meta.limit) || result.data.length > meta.limit) return invalid();
  return { data: result.data.map(parse), pagination: meta };
}
function apiBase(value: string): string {
  const base = value.replace(/\/+$/, '');
  if (/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(base)) return base;
  try {
    const url = new URL(base);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash) return base;
  } catch { /* Only public HTTP API configuration is accepted. */ }
  throw new ApiError(0, tr("m150"));
}
export function createApi(baseUrl = '/api', fetcher: typeof fetch = globalThis.fetch) {
  const base = apiBase(baseUrl);
  async function request<T>(path: string, parse: (value: unknown) => T, signal?: AbortSignal, body?: ContactInput|ReportInput): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 15000);
    try {
      const response = await fetcher(base + path, { signal: controller.signal, credentials: 'omit', cache: 'no-store',
        method: body ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw new ApiError(response.status);
      return parse(await response.json() as unknown);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  return {
    report(id:string,input:ReportInput,signal?:AbortSignal){
      if(!isProgramId(id))return Promise.reject(new ApiError(404));
      return request('/programs/'+encodeURIComponent(id)+'/reports',value=>{if(record(record(value).data).accepted!==true)return invalid();return {accepted:true as const};},signal,input);
    },
    matches(query:string,signal?:AbortSignal){
      const params=new URLSearchParams(query);for(const key of [...params.keys()])if(!['category','region','age','need','q','page','limit'].includes(key))params.delete(key);
      return request('/program-matches?'+params.toString(),value=>parsePage(value,parseProgram),signal);
    },
    match(id:string,query:string,signal?:AbortSignal){
      if(!isProgramId(id))return Promise.reject(new ApiError(404));
      return request('/program-matches/'+encodeURIComponent(id)+'?'+matchingContext(new URLSearchParams(query)),value=>parseProgram(record(value).data),signal);
    },
    programs(query: string, signal?: AbortSignal) {
      const params = new URLSearchParams();
      for (const [key, value] of new URLSearchParams(query)) {
        if (['category', 'region', 'age', 'q', 'page', 'limit'].includes(key) && value !== '') params.append(key, value);
      }
      return request('/programs?' + params.toString(), value => parsePage(value, parseProgram), signal);
    },
    program(id: string, signal?: AbortSignal) {
      if (!isProgramId(id)) return Promise.reject(new ApiError(404));
      return request('/programs/' + encodeURIComponent(id), value => parseProgram(record(value).data), signal);
    },
    async taxonomy(kind: 'categories' | 'regions' | 'family-categories', signal?: AbortSignal): Promise<Taxonomy[]> {
      const result: Taxonomy[] = [];
      for (let page = 1; page <= 10000; page++) {
        const response = await request(`/${kind}?limit=50&page=${page}`, value => parsePage(value, parseTaxonomy), signal);
        result.push(...response.data);
        if (page >= response.pagination.totalPages) return result;
      }
      return invalid();
    },
    contact(input: ContactInput, signal?: AbortSignal) {
      return request('/contact-messages', value => {
        const id = text(record(record(value).data).id);
        return isProgramId(id) ? { id } : invalid();
      }, signal, input);
    },
  };
}
