import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, Search } from 'lucide-react';
import { familyCategories, regions } from '../data/programs';

export default function SupportFinder() {
  const navigate = useNavigate();
  const [region, setRegion] = useState('');
  const [age, setAge] = useState('');
  const [family, setFamily] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`/results?${new URLSearchParams({ region, age, family })}`);
  }

  return <form className="hero-finder" onSubmit={submit} aria-labelledby="finder-title">
    <div className="finder-heading">
      <span className="finder-mark"><Search aria-hidden="true" size={20} /></span>
      <div><h2 id="finder-title">Сізге сай мүмкіндік</h2><p>Іздеуді осы жерден бастаңыз</p></div>
      <span className="finder-demo">DEMO · Ресми ақпарат емес</span>
    </div>
    <div className="finder-fields">
      <label className="field"><span>Қала / өңір</span><div className="select-wrap">
        <select name="region" value={region} onChange={e => setRegion(e.target.value)}>
          <option value="">Барлық өңірлер</option>{regions.map(item => <option key={item}>{item}</option>)}
        </select><ChevronDown aria-hidden="true" size={16} />
      </div></label>
      <label className="field"><span>Баланың жасы</span><input name="age" type="number" min="0" max="17" step="1" placeholder="0–17 жас" value={age} onChange={e => setAge(e.target.value)} /></label>
      <label className="field"><span>Отбасы санаты</span><div className="select-wrap">
        <select name="family" value={family} onChange={e => setFamily(e.target.value)}>
          <option value="">Барлық санаттар</option>{familyCategories.map(item => <option key={item}>{item}</option>)}
        </select><ChevronDown aria-hidden="true" size={16} />
      </div></label>
      <button className="button primary" type="submit">Көмек табу <ArrowUpRight aria-hidden="true" size={19} /></button>
    </div>
  </form>;
}
