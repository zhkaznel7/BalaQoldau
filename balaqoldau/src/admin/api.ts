import {tr} from '../i18n/ui.ts';
import { isProgramId } from '../api/client.ts';
import type { Access, Session, Program, ProgramInput, Taxonomy, Action, Status } from './types.ts';

const messages: Record<number, string> = { 0: tr("m032"), 400: tr("m033"),
  401: tr("m034"), 403: tr("m035"),
  404: tr("m036"), 409: tr("m037"),
  413: tr("m038"), 429: tr("m039") };
export class AdminError extends Error {
  readonly status: number;
  constructor(status: number, login = false) { super(login && status === 401 ? tr("m040") : messages[status] ?? tr("m041")); this.status = status; }
}
const bad = () => new AdminError(503);
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad(); return value as Record<string, unknown>; }
function sessionData(value: unknown): Session {
  const data = record(value), admin = data.admin === null ? null : record(data.admin);
  if (typeof data.authenticated !== 'boolean' || typeof data.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.csrfToken)
    || (data.authenticated && (!admin || typeof admin.id !== 'string' || !isProgramId(admin.id)))) throw bad();
  return { authenticated: data.authenticated, admin: admin ? { id: String(admin.id) } : null, csrfToken: data.csrfToken };
}
function programData(value: unknown): Program {
  const p = record(value);
  if(p.eligibilityComplete!==undefined&&typeof p.eligibilityComplete!=='boolean')throw bad();
  if (typeof p.id !== 'string' || !isProgramId(p.id) || !['draft','review','verified','published'].includes(String(p.status))
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
  async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal, login = false, envelope = false): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (method !== 'GET') { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrf; }
    let response: Response;
    try { response = await fetcher(base + path, { method, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      ...(signal ? { signal } : {}), ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch (error) { if (signal?.aborted) throw error; throw new AdminError(0); }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!response.ok) {
      if (response.status === 401 && !login) { csrf = ''; epoch++; expired(); }
      throw new AdminError(response.status, login);
    }
    if (response.status === 204) return null;
    try { const value = record(await response.json()); return envelope ? value : value.data ?? badResponse(); } catch { throw bad(); }
  }
  function badResponse(): never { throw bad(); }
  async function session(signal?: AbortSignal) {
    const before = epoch;
    const result = sessionData(await request('/session', 'GET', undefined, signal));
    if (before === epoch && !signal?.aborted) csrf = result.csrfToken;
    return result;
  }
  async function mutation<T>(work: () => Promise<T>): Promise<T> {
    if (changing) throw new AdminError(409);
    changing = true;
    try { return await work(); } finally { changing = false; }
  }
  const validId = (id: string) => { if (!isProgramId(id)) throw new AdminError(400); return id; };
  return {
    session,
    busy: () => changing,
    login: (email: string, password: string) => mutation(async () => { epoch++; await session(); const result = sessionData(await request('/login', 'POST', { email, password }, undefined, true)); csrf = result.csrfToken; epoch++; return result; }),
    logout: () => mutation(async () => { await request('/logout', 'POST', {}); csrf = ''; epoch++; }),
    async access(signal?: AbortSignal): Promise<Access> {
      const value = record(await request('/access', 'GET', undefined, signal));
      if (typeof value.id !== 'string' || !isProgramId(value.id) || !['editor','reviewer','admin'].includes(String(value.role))
        || !Array.isArray(value.permissions) || !value.permissions.every(item => typeof item === 'string')) throw bad();
      return value as unknown as Access;
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
    action: (id: string, action: Action, version: number) => mutation(async () => programData(await request('/programs/' + validId(id) + '/' + action, 'POST', { version }))),
  };
}
export type AdminApi = ReturnType<typeof createAdminApi>;
export type { Status };
