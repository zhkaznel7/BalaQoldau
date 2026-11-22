import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowRight, ChevronDown } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { updateFilters } from '../api/navigation';
import {referenceName} from '../api/reference-data';

export default function DiscoverySearch() {
  useUi();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');
  const catalog = useCatalog();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams(updateFilters(params, { q: term }));
  }
  return <form className="discovery-search" onSubmit={submit} role="search" aria-label={tr("m255")}>
    <label className="discovery-term"><Search aria-hidden="true" size={20} /><span className="sr-only">{""+tr("m256")+""}</span>
      <input name="q" type="search" maxLength={200} placeholder={tr("m257")} value={term} onChange={e => setTerm(e.target.value)} />
    </label>
    <label className="discovery-region"><span className="sr-only">{""+tr("m258")+""}</span><select name="region" value={params.get('region') || ''} disabled={catalog.loading || Boolean(catalog.error)} onChange={e => setParams(updateFilters(params, { region: e.target.value }))}><option value="">{""+tr("m182")+""}</option>{catalog.regions.map(region => <option key={region.id} value={region.slug}>{referenceName('regions',region.slug,region.name)}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
    <button type="submit" className="button primary">{""+tr("m059")+" "}<ArrowRight aria-hidden="true" size={18} /></button>
  </form>;
}
