import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { resultsUrl } from '../api/navigation';
import { CatalogStatus } from './RequestState';

export default function SupportFinder() {
  useUi();
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
    <h2 id="finder-title" className="sr-only">{""+tr("m300")+""}</h2>
    <div className="finder-query"><label htmlFor="home-search">{""+tr("m301")+""}</label><div><Search aria-hidden="true" size={22}/><input id="home-search" name="q" type="search" maxLength={200} placeholder={tr("m302")} value={query} onChange={event => setQuery(event.target.value)}/><button className="button primary" type="submit">{""+tr("m059")+""}</button></div></div>
    <div className="finder-fields">
      <label className="field"><span>{""+tr("m181")+""}</span><div className="select-wrap">
        <select name="region" value={region} disabled={catalog.loading || Boolean(catalog.error)} onChange={e => setRegion(e.target.value)}>
          <option value="">{""+tr("m182")+""}</option>{catalog.regions.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select><ChevronDown aria-hidden="true" size={16} />
      </div></label>
      <label className="field"><span>{""+tr("m183")+""}</span><input name="age" type="number" min="0" max="17" step="1" placeholder={tr("m184")} value={age} onChange={e => setAge(e.target.value)} /></label>
      <label className="field"><span>{""+tr("m185")+""}</span><div className="select-wrap">
        <select name="category" value={category} disabled={catalog.loading || Boolean(catalog.error)} onChange={e => setCategory(e.target.value)}>
          <option value="">{""+tr("m303")+""}</option>{catalog.categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select><ChevronDown aria-hidden="true" size={16} />
      </div></label>
    </div>
    <CatalogStatus />
  </form>;
}
