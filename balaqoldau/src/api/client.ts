export interface Taxonomy { id: string; slug: string; name: string }
export interface Program {
  id: string; slug: string; category: string; title: string; description: string;
  sourceUrl: string; sourceName: string; verifiedAt: string; ageMin: number; ageMax: number;
  deadline: string | null; applyUrl: string | null; isDemo: false;
  regions: string[]; familyCategories: string[];
}
export interface Page<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface ContactInput { senderName: string; email: string; message: string }
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? (status === 400 ? 'Іздеу не форма деректерін тексеріңіз.'
      : status === 404 ? 'Бағдарлама табылмады немесе жарияланбаған.'
      : status === 429 ? 'Сұрау шегінен асты. Біраз уақыттан кейін қайталаңыз.'
      : 'Сервермен байланысу мүмкін болмады. Қайта көріңіз.'));
    this.status = status;
  }
}
export const isProgramId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const invalid = (): never => { throw new ApiError(0, 'Сервер деректерінің пішімі дұрыс емес.'); };
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
function parseProgram(value: unknown): Program {
  const p = record(value);
  if (p.isDemo !== false || (p.status !== undefined && p.status !== 'published')) return invalid();
  const id = text(p.id);
  const ageMin = integer(p.ageMin), ageMax = integer(p.ageMax);
  if (!isProgramId(id) || ageMin > ageMax || ageMax > 17 || !Number.isFinite(Date.parse(text(p.verifiedAt)))) return invalid();
  return { id, slug: text(p.slug), category: text(p.category), title: text(p.title), description: text(p.description),
    sourceUrl: https(p.sourceUrl), sourceName: text(p.sourceName), verifiedAt: text(p.verifiedAt), ageMin, ageMax,
    deadline: p.deadline === null ? null : text(p.deadline), applyUrl: p.applyUrl === null ? null : https(p.applyUrl),
    isDemo: false, regions: strings(p.regions), familyCategories: strings(p.familyCategories) };
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
  throw new ApiError(0, 'API мекенжайы дұрыс бапталмаған.');
}
export function createApi(baseUrl = '/api', fetcher: typeof fetch = globalThis.fetch) {
  const base = apiBase(baseUrl);
  async function request<T>(path: string, parse: (value: unknown) => T, signal?: AbortSignal, body?: ContactInput): Promise<T> {
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
    async taxonomy(kind: 'categories' | 'regions', signal?: AbortSignal): Promise<Taxonomy[]> {
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
