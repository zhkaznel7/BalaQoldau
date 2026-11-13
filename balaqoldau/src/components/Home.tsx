import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resultsUrl } from '../api/navigation';
import SupportFinder from './SupportFinder';
import {categoryName} from '../api/categories';

// Stable category navigation never inserts translated labels into the search query.
const directions = [
  { category:'benefits', text:'m260' },
  { category:'free-courses', text:'m262' },
  { category:'clubs', text:'m264' },
  { category:'grants', text:'m266' },
];

export default function Home() {
  useUi();
  const location = useLocation();
  useEffect(() => {
    if (location.hash !== '#how') return;
    const target = document.getElementById('how');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [location.hash]);

  return <>
    <section className="hero-shell"><div className="container hero">
      <div className="discovery-panel">
        <div className="hero-copy"><h1>{""+tr("m267")+""}</h1>
          <p>{""+tr("m268")+""}</p>
        </div>
        <SupportFinder />
        <p className="hero-footnote">{""+tr("m269")+""}</p>
      </div>
      <aside className="portal-guide" id="how" tabIndex={-1} aria-labelledby="how-heading">
        <h2 id="how-heading">{""+tr("m161")+""}</h2>
        <svg className="portal-ornament" width="156" height="18" viewBox="0 0 156 18" fill="none" aria-hidden="true" focusable="false">
          <path d="M1 9h12q8-12 16 0-8 12-16 0h32l8-7 8 7-8 7-8-7h32q8-12 16 0-8 12-16 0h32l8-7 8 7-8 7-8-7h46" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        <ol>
          <li><h3>{""+tr("m270")+""}</h3><p>{""+tr("m271")+""}</p></li>
          <li><h3>{""+tr("m272")+""}</h3><p>{""+tr("m273")+""}</p></li>
          <li><h3>{""+tr("m274")+""}</h3><p>{""+tr("m275")+""}</p></li>
        </ol>
        <img className="hero-family-illustration" src="/images/family-reading.svg" width="320" height="144" alt={tr("m276")} decoding="async"/>
      </aside>
    </div></section>

    <div className="container portal-directory">
      <section className="section directions" aria-labelledby="directions-heading">
        <div className="section-heading"><h2 id="directions-heading">{""+tr("m277")+""}</h2></div>
        <div className="service-directions">{directions.map(({ category, text }) =>
          <Link key={category} to={resultsUrl({ category })}><h3>{categoryName(category)}</h3><p>{tr(text)}</p></Link>)}</div>
        <p className="section-caption">{""+tr("m278")+""}</p>
        </section>
      
    </div>
    <section className="container portal-help" aria-labelledby="help-heading"><h2 id="help-heading">{""+tr("m283")+""}</h2>
      <p><Link to="/find">{""+tr("m284")+""}</Link>{" "+tr("m285")+" "}<Link to="/contact">{""+tr("m286")+""}</Link>.</p>
    </section>
  </>;
}
