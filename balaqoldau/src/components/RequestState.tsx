import { useCatalog } from '../hooks/useCatalog';
import { CircleAlert, RotateCw } from 'lucide-react';
export function Loading() { return <div className="loading-state"><p className="loading-label" role="status">Деректер жүктелуде…</p><div className="program-grid" aria-hidden="true" aria-busy="true">{[1, 2, 3].map(n => <div key={n} className="skeleton"><span/><span/><span/></div>)}</div></div>; }
export function RequestError({ error, retry }: { error: Error; retry: () => void }) {
  return <div className="request-error" role="alert"><CircleAlert aria-hidden="true" size={24}/><div><h2>Деректерді жүктеу мүмкін болмады. Қайталап көріңіз.</h2><p>{error.message}</p><button type="button" className="button primary" onClick={retry}><RotateCw aria-hidden="true" size={18}/>Қайта көру</button></div></div>;
}
export function CatalogStatus() {
  const catalog = useCatalog();
  if (catalog.loading) return <p role="status">Деректер жүктелуде…</p>;
  if (catalog.error) return <RequestError error={catalog.error} retry={catalog.retry}/>;
  if (!catalog.categories.length && !catalog.regions.length) return <p className="demo-notice">Жарияланған бағдарламаларға арналған қолдау түрлері мен өңірлер әлі жоқ.</p>;
  return null;
}
