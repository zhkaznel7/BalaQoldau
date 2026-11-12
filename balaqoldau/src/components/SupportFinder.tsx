import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { resultsUrl } from '../api/navigation';
import { CatalogStatus } from './RequestState';

export default function SupportFinder() {
  const navigate = useNavigate();
  const [region, setRegion] = useState('');
  const [age, setAge] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const catalog = useCatalog();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(resultsUrl({ region, age, category, q: query }));
  }

  return <form className="hero-finder" onSubmit={submit} role="search" aria-labelledby="finder-title">
    <h2 id="finder-title" className="sr-only">Бағдарламаларды іздеу</h2>
    <div className="finder-query"><label htmlFor="home-search">Бағдарлама атауы немесе кілтсөз</label><div><Search aria-hidden="true" size={22}/><input id="home-search" name="q" type="search" maxLength={200} placeholder="Мысалы: үйірме, курс, грант" value={query} onChange={event => setQuery(event.target.value)}/><button className="button primary" type="submit">Іздеу</button></div></div>
    <div className="finder-fields">
      <label className="field"><span>Қала / өңір</span><div className="select-wrap">
        <select name="region" value={region} disabled={catalog.loading || Boolean(catalog.error)} onChange={e => setRegion(e.target.value)}>
          <option value="">Барлық өңірлер</option>{catalog.regions.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select><ChevronDown aria-hidden="true" size={16} />
      </div></label>
      <label className="field"><span>Баланың жасы</span><input name="age" type="number" min="0" max="17" step="1" placeholder="0–17 жас" value={age} onChange={e => setAge(e.target.value)} /></label>
      <label className="field"><span>Қолдау түрі</span><div className="select-wrap">
        <select name="category" value={category} disabled={catalog.loading || Boolean(catalog.error)} onChange={e => setCategory(e.target.value)}>
          <option value="">Барлық түрлер</option>{catalog.categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select><ChevronDown aria-hidden="true" size={16} />
      </div></label>
    </div>
    <CatalogStatus />
  </form>;
}
