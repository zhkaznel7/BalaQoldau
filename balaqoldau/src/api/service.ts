import { ApiError, createApi } from './client.ts';
import type { ContactInput,ReportInput,RecommendationIntent } from './client.ts';
let client: ReturnType<typeof createApi> | undefined;
const getClient = () => client ??= createApi(import.meta.env?.VITE_API_BASE_URL || '/api');
export const api = {
  recommendations: (query: string, signal?: AbortSignal, context?:RecommendationIntent|null, openAIConsent?:boolean) =>
    getClient().recommendations(query, signal, context, openAIConsent),
  suggestions: (signal?:AbortSignal) => getClient().suggestions(signal),
  report:(id:string,input:ReportInput,signal?:AbortSignal)=>getClient().report(id,input,signal),
  async programs(query: string, signal?: AbortSignal) { return new URLSearchParams(query).get('matching')==='1'?getClient().matches(query,signal):getClient().programs(query, signal); },
  async program(id: string, signal?: AbortSignal) { return getClient().program(id, signal); },
  async match(id:string,query:string,signal?:AbortSignal){return getClient().match(id,query,signal);},
  async taxonomy(kind: 'categories' | 'regions' | 'family-categories', signal?: AbortSignal) { return getClient().taxonomy(kind, signal); },
  async contact(input: ContactInput, signal?: AbortSignal) { return getClient().contact(input, signal); },
};
export const loadPrograms = (query: string, signal: AbortSignal) => api.programs(query, signal);
export const loadProgram = (id: string, signal: AbortSignal) => api.program(id, signal);
export async function loadCatalog(_key: string, signal: AbortSignal) {
  const [categories, regions,needs] = await Promise.all([api.taxonomy('categories', signal), api.taxonomy('regions', signal),api.taxonomy('family-categories',signal)]);
  return { categories, regions,needs };
}
export async function loadFavorites(key: string, signal: AbortSignal) {
  const result = await Promise.all(key.split(',').filter(Boolean).map(async id => {
    try { return await api.program(id, signal); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }));
  return result.filter(item => item !== null);
}
