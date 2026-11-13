import type { ReactNode } from 'react';
import { CatalogContext } from '../hooks/useCatalog';
import { useResource } from '../hooks/useResource';
import { loadCatalog } from '../api/service';
export default function CatalogProvider({ children }: { children: ReactNode }) {
  const state = useResource('catalog', loadCatalog);
  return <CatalogContext.Provider value={{ needs:state.data?.needs??[],categories: state.data?.categories ?? [], regions: state.data?.regions ?? [], loading: state.loading, error: state.error, retry: state.retry }}>{children}</CatalogContext.Provider>;
}
