import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../hooks/useCatalog';
import { resultsUrl } from '../api/navigation';
import SupportFinder from './SupportFinder';

// Keyword navigation only: actual categories still come from the API.
const directions = [
  { title: 'Жәрдемақылар', query: 'жәрдемақы', text: 'Әлеуметтік қолдау туралы жарияланған ақпарат.' },
  { title: 'Тегін курстар', query: 'тегін курс', text: 'Оқу және жаңа дағдыларға қатысты бағдарламалар.' },
  { title: 'Үйірмелер', query: 'үйірме', text: 'Қосымша білім мен шығармашылық бағыттары.' },
  { title: 'Білім гранттары', query: 'грант', text: 'Білім алуға қолдау туралы ақпарат.' },
];

export default function Home() {
  const catalog = useCatalog();
  const location = useLocation();
  useEffect(() => {
    if (location.hash !== '#how') return;
    const target = document.getElementById('how');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [location]);

  return <>
    <section className="hero-shell"><div className="container hero">
      <div className="discovery-panel">
        <div className="hero-copy"><h1>Балаңызға қолдау іздеу</h1>
          <p>Жарияланған бағдарламаларды атауы, өңірі және баланың жасы бойынша табыңыз.</p>
        </div>
        <SupportFinder />
        <p className="hero-footnote">BalaQoldau өтінім қабылдамайды. Қатысу тәртібін бағдарламаның дереккөзінен тексеріңіз.</p>
      </div>
      <aside className="portal-guide" id="how" tabIndex={-1} aria-labelledby="how-heading">
        <h2 id="how-heading">Қалай жұмыс істейді?</h2>
        <svg className="portal-ornament" width="156" height="18" viewBox="0 0 156 18" fill="none" aria-hidden="true" focusable="false">
          <path d="M1 9h12q8-12 16 0-8 12-16 0h32l8-7 8 7-8 7-8-7h32q8-12 16 0-8 12-16 0h32l8-7 8 7-8 7-8-7h46" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        <ol>
          <li><h3>Бағдарламаны табыңыз</h3><p>Кілтсөз енгізіңіз. Қажет болса, өңір, жас және қолдау түрін таңдаңыз.</p></li>
          <li><h3>Шарттарын тексеріңіз</h3><p>Бағдарлама бетіндегі дереккөз сілтемесін, тексерілген күнін және қатысу талаптарын қараңыз.</p></li>
          <li><h3>Келесі қадамға өтіңіз</h3><p>Ақпаратты таңдаулыларға сақтаңыз. Өтінім сілтемесі болса, сол жердегі нұсқаулықты орындаңыз.</p></li>
        </ol>
        <img className="hero-family-illustration" src="/images/family-reading.svg" width="320" height="144" alt="Ата-ана мен бала бірге кітап қарап отыр." decoding="async"/>
      </aside>
    </div></section>

    <div className="container portal-directory">
      <section className="section directions" aria-labelledby="directions-heading">
        <div className="section-heading"><h2 id="directions-heading">Қолдау бағыттары</h2></div>
        <div className="service-directions">{directions.map(({ title, query, text }) =>
          <Link key={query} to={resultsUrl({ q: query })}><h3>{title}</h3><p>{text}</p></Link>)}</div>
        <p className="section-caption">Бұл сілтемелер кілтсөзбен іздейді. Нәтижелер жарияланған деректерге байланысты.</p>
      </section>
      <section className="section categories" aria-labelledby="categories-heading">
        <div className="section-heading"><h2 id="categories-heading">Бағдарлама санаттары</h2></div>
        {catalog.loading && <p className="catalog-hint" role="status">Деректер жүктелуде…</p>}
        {!catalog.loading && !catalog.error && !catalog.categories.length && <p className="catalog-hint">Қазір бұл санатта бағдарламалар жоқ</p>}
        {!!catalog.categories.length && <div className="category-grid">{catalog.categories.map(category =>
          <Link key={category.id} to={resultsUrl({ category: category.slug })} className="category-card"><h3>{category.name}</h3><p>Жарияланған бағдарламаларды қарау</p></Link>)}</div>}
        <Link className="inline-link" to="/results">Барлық бағдарламалар</Link>
      </section>
    </div>
    <section className="container portal-help" aria-labelledby="help-heading"><h2 id="help-heading">Қосымша ақпарат</h2>
      <p><Link to="/find">Кеңейтілген іздеу</Link> арқылы барлық сүзгіні таңдауға болады. Платформа туралы сұрағыңыз болса, <Link to="/contact">бізге хабарласыңыз</Link>.</p>
    </section>
  </>;
}
