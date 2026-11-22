import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resultsUrl } from '../api/navigation';
import SupportFinder from './SupportFinder';
import {carryLanguage} from './language';
import {categoryName} from '../api/categories';
import {Search,ClipboardCheck,MessageSquare,ShieldCheck,WalletCards,GraduationCap,Palette,Award,ArrowUpRight} from 'lucide-react';

// Stable category navigation never inserts translated labels into the search query.
const directions = [
  { category:'benefits', text:'m260',icon:WalletCards },
  { category:'free-courses', text:'m262',icon:GraduationCap },
  { category:'clubs', text:'m264',icon:Palette },
  { category:'grants', text:'m266',icon:Award },
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
        <Link className="button hero-assistant-link" to={'/ai-assistant' + carryLanguage(location.search, '')}>
          <MessageSquare aria-hidden="true" size={18}/>{tr('aiSearch')}
        </Link>
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
        <div className="service-directions">{directions.map(({ category, text,icon:Icon }) =>
          <Link className="support-direction-card" key={category} to={resultsUrl({ category })}><Icon aria-hidden="true"/><div><h3>{categoryName(category)}</h3><p>{tr(text)}</p></div><ArrowUpRight aria-hidden="true"/></Link>)}</div>
        <p className="section-caption">{""+tr("m278")+""}</p>
        </section>
      
    </div>
    <section className="container portal-about" aria-labelledby="about-heading">
      <header className="about-intro"><div><h2 id="about-heading">{tr('m508')}</h2><p>{tr('m509')}</p></div><div><p>{tr('m510')}</p><Link className="button primary" to="/find">{tr('m513')}</Link></div></header>
      <div className="about-grid">
        <article><Search aria-hidden="true"/><h3>{tr('m511')}</h3><p>{tr('m512')}</p><Link to="/profile/children">{tr('m514')}</Link></article>
        <article><ClipboardCheck aria-hidden="true"/><h3>{tr('m515')}</h3><p>{tr('m516')}</p></article>
        <article><MessageSquare aria-hidden="true"/><h3>{tr('m517')}</h3><p>{tr('m518')}</p><Link to="/contact">{tr('m519')}</Link></article>
        <article><ShieldCheck aria-hidden="true"/><h3>{tr('m520')}</h3><p>{tr('m521')}</p></article>
      </div>
    </section>
  </>;
}
