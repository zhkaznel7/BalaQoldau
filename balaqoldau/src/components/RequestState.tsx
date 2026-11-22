import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useCatalog } from '../hooks/useCatalog';
import { CircleAlert, RotateCw } from 'lucide-react';
export function Loading() {
  useUi(); return <div className="loading-state"><p className="loading-label" role="status">{""+tr("m280")+""}</p><div className="program-grid" aria-hidden="true" aria-busy="true">{[1, 2, 3].map(n => <div key={n} className="skeleton"><span/><span/><span/></div>)}</div></div>; }
export function RequestError({ error, retry }: { error: Error; retry: () => void }) {
  useUi();
  return <div className="request-error" role="alert"><CircleAlert aria-hidden="true" size={24}/><div><h2>{""+tr("m297")+""}</h2><p>{tr(error.message)}</p><button type="button" className="button primary" onClick={retry}><RotateCw aria-hidden="true" size={18}/>{""+tr("m298")+""}</button></div></div>;
}
export function CatalogStatus() {
  useUi();
  const catalog = useCatalog();
  if (catalog.loading) return <p role="status">{""+tr("m280")+""}</p>;
  if (catalog.error) return <RequestError error={catalog.error} retry={catalog.retry}/>;
  if (!catalog.categories.length && !catalog.regions.length) return <p className="catalog-empty-notice">{""+tr("m299")+""}</p>;
  return null;
}
