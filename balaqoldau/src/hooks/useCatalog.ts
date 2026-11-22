import { createContext, useContext } from 'react';
import type { Taxonomy } from '../api/client';
export const CatalogContext = createContext<{ needs:Taxonomy[]; categories: Taxonomy[]; regions: Taxonomy[]; loading: boolean; error: Error | null; retry: () => void }>({
  needs:[],categories: [], regions: [], loading: true, error: null, retry: () => {},
});
export const useCatalog = () => useContext(CatalogContext);
