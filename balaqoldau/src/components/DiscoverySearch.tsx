import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowRight, ChevronDown } from 'lucide-react';
import { regions } from '../data/programs';

export default function DiscoverySearch() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (term.trim()) next.set('q', term.trim()); else next.delete('q');
    setParams(next);
  }
  return <form className="discovery-search" onSubmit={submit} role="search" aria-label="Мүмкіндіктер ішінен іздеу">
    <label className="discovery-term"><Search aria-hidden="true" size={20} /><span className="sr-only">Атауы немесе қолдау түрі</span>
      <input name="q" type="search" placeholder="Атауы немесе қолдау түрі бойынша іздеу" value={term} onChange={e => setTerm(e.target.value)} />
    </label>
    <label className="discovery-region"><span className="sr-only">Өңір бойынша сүзгі</span><select value={params.get('region') || ''} onChange={e => {
      const next = new URLSearchParams(params);
      if (e.target.value) next.set('region', e.target.value); else next.delete('region');
      setParams(next);
    }}><option value="">Барлық өңірлер</option>{regions.map(region => <option key={region}>{region}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
    <button type="submit" className="button primary">Іздеу <ArrowRight aria-hidden="true" size={18} /></button>
  </form>;
}
