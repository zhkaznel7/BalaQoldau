const keys = ['category', 'region', 'age', 'q', 'page', 'limit'];
export function updateFilters(current: URLSearchParams, changes: Record<string, string>): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of current) if (keys.includes(key) && value !== '') next.append(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (!keys.includes(key)) continue;
    if (value.trim()) next.set(key, value.trim()); else next.delete(key);
  }
  if (!('page' in changes)) next.delete('page');
  return next;
}
export function resultsUrl(filters: Record<string, string>): string {
  const query = updateFilters(new URLSearchParams(), filters).toString();
  return '/results' + (query ? '?' + query : '');
}
