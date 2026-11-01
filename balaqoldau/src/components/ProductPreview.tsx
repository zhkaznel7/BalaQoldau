import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronRight, GraduationCap, Heart, MapPin, Palette, SlidersHorizontal, Sparkles } from 'lucide-react';
import { supportTypes } from '../data/programs';
import './ProductPreview.css';

const opportunities = [
  { title: 'Тегін шығармашылық үйірмелер', subtitle: 'Қызығушылыққа алғашқы қадам', icon: Palette, type: supportTypes[1], detail: 'Сурет, музыка және шығармашылық бағыттарындағы мүмкіндіктерді іздеп көріңіз.', tone: 'creative' },
  { title: 'Білім беру бағдарламалары', subtitle: 'Білімге бастайтын жаңа жол', icon: GraduationCap, type: supportTypes[2], detail: 'Балаңыздың жасына сай білім беру мүмкіндіктерін іздеп көріңіз.', tone: 'education' },
  { title: 'Әлеуметтік қолдау', subtitle: 'Отбасыға қажет қамқорлық', icon: Heart, type: supportTypes[3], detail: 'Отбасыңызға арналған әлеуметтік қолдау түрлерін іздеп көріңіз.', tone: 'support' },
];

export default function ProductPreview() {
  const [selected, setSelected] = useState(0);
  const opportunity = opportunities[selected];
  const search = new URLSearchParams({ region: 'Астана', age: '5', type: opportunity.type });

  return <section className="product-preview" aria-labelledby="preview-title">
    <div className="preview-orbit" aria-hidden="true" />
    <div className="preview-floating-label" aria-hidden="true"><Sparkles size={16} /><span>Қолдау іздеуден басталады</span></div>

    <div className="preview-window">
      <div className="preview-toolbar"><span className="preview-brand"><span aria-hidden="true" />BalaQoldau</span><span className="preview-demo">DEMO · Өнім көрінісі</span></div>
      <div className="preview-content">
        <div className="preview-title-row"><div><p className="preview-eyebrow">БАЛАҢЫЗ ҮШІН</p><h2 id="preview-title">Сізге сәйкес мүмкіндіктер</h2></div><span className="preview-filter-symbol" aria-hidden="true"><SlidersHorizontal size={19}/></span></div>
        <dl className="preview-profile">
          <div><dt><MapPin size={13} aria-hidden="true"/>Қала</dt><dd>Астана</dd></div>
          <div><dt>Баланың жасы</dt><dd>5 жас</dd></div>
          <div className="preview-count"><dt>Табылған<br/>мүмкіндіктер</dt><dd>8<span>үлгі</span></dd></div>
        </dl>
        <div className="preview-opportunities" aria-label="Мүмкіндік санатын таңдаңыз">
          {opportunities.map(({ title, subtitle, icon: Icon, tone }, index) => <button
            type="button" key={title} aria-pressed={selected === index}
            aria-controls="preview-selection" className={`preview-opportunity preview-${tone} ${selected === index ? 'is-selected' : ''}`}
            onClick={() => setSelected(index)}>
            <span className="preview-opportunity-icon"><Icon size={21} aria-hidden="true" /></span>
            <span className="preview-opportunity-text"><strong>{title}</strong><small>{subtitle}</small></span>
            <span className="preview-selection-icon" aria-hidden="true">{selected === index ? <Check size={16}/> : <ChevronRight size={16}/>}</span>
          </button>)}
        </div>
        <div className="preview-selection" id="preview-selection">
          <p aria-live="polite" aria-atomic="true">{opportunity.detail}</p>
          <Link to={`/results?${search}`} aria-label={`${opportunity.title}: осы санатты іздеу`}>Осы санатты іздеу <ArrowUpRight size={16} aria-hidden="true"/></Link>
        </div>
      </div>
    </div>
    <div className="preview-floating-note"><span aria-hidden="true"><Heart size={17}/></span><div><strong>Әр балаға — мүмкіндік</strong><small>Бір жерден. Түсінікті. Ыңғайлы.</small></div></div>
    <p className="preview-disclaimer">DEMO · 8 — көрнекі мысал, нақты іздеу нәтижесі емес.</p>
  </section>;
}
