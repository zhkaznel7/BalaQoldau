import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowRight, ChevronDown } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { updateFilters } from '../api/navigation';

export default function DiscoverySearch() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');
  const catalog = useCatalog();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams(updateFilters(params, { q: term }));
  }
  return <form className="discovery-search" onSubmit={submit} role="search" aria-label="Мүмкіндіктер ішінен іздеу">
    <label className="discovery-term"><Search aria-hidden="true" size={20} /><span className="sr-only">Атауы немесе қолдау түрі</span>
      <input name="q" type="search" maxLength={200} placeholder="Атауы немесе сипаттамасы бойынша іздеу" value={term} onChange={e => setTerm(e.target.value)} />
    </label>
    <label className="discovery-region"><span className="sr-only">Өңір бойынша сүзгі</span><select name="region" value={params.get('region') || ''} disabled={catalog.loading || Boolean(catalog.error)} onChange={e => setParams(updateFilters(params, { region: e.target.value }))}><option value="">Барлық өңірлер</option>{catalog.regions.map(region => <option key={region.id} value={region.slug}>{region.name}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
    <button type="submit" className="button primary">Іздеу <ArrowRight aria-hidden="true" size={18} /></button>
  </form>;
}
