import { ApiError, createApi } from './client.ts';
import type { ContactInput } from './client.ts';
let client: ReturnType<typeof createApi> | undefined;
const getClient = () => client ??= createApi(import.meta.env?.VITE_API_BASE_URL || '/api');
export const api = {
  async programs(query: string, signal?: AbortSignal) { return getClient().programs(query, signal); },
  async program(id: string, signal?: AbortSignal) { return getClient().program(id, signal); },
  async taxonomy(kind: 'categories' | 'regions', signal?: AbortSignal) { return getClient().taxonomy(kind, signal); },
  async contact(input: ContactInput, signal?: AbortSignal) { return getClient().contact(input, signal); },
};
export const loadPrograms = (query: string, signal: AbortSignal) => api.programs(query, signal);
export const loadProgram = (id: string, signal: AbortSignal) => api.program(id, signal);
export async function loadCatalog(_key: string, signal: AbortSignal) {
  const [categories, regions] = await Promise.all([api.taxonomy('categories', signal), api.taxonomy('regions', signal)]);
  return { categories, regions };
}
export async function loadFavorites(key: string, signal: AbortSignal) {
  const result = await Promise.all(key.split(',').filter(Boolean).map(async id => {
    try { return await api.program(id, signal); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }));
  return result.filter(item => item !== null);
}
