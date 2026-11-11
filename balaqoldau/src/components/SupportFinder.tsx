import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, Search } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { resultsUrl } from '../api/navigation';
import { CatalogStatus } from './RequestState';

export default function SupportFinder() {
  const navigate = useNavigate();
  const [region, setRegion] = useState('');
  const [age, setAge] = useState('');
  const [category, setCategory] = useState('');
  const catalog = useCatalog();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(resultsUrl({ region, age, category }));
  }

  return <form className="hero-finder" onSubmit={submit} aria-labelledby="finder-title">
    <div className="finder-heading">
      <span className="finder-mark"><Search aria-hidden="true" size={20} /></span>
      <div><h2 id="finder-title">Сізге сай мүмкіндік</h2><p>Іздеуді осы жерден бастаңыз</p></div>
      <span className="finder-demo">Тек жарияланған бағдарламалар</span>
    </div>
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
      <button className="button primary" type="submit">Көмек табу <ArrowUpRight aria-hidden="true" size={19} /></button>
    </div>
    <CatalogStatus />
  </form>;
}
