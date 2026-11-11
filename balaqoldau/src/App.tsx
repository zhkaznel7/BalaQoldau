import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, Heart, MapPin, Menu, Search, Sparkles, Users, Wallet, Palette, GraduationCap, HandHeart, X, SlidersHorizontal, ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { ApiError, isProgramId } from './api/client';
import { loadPrograms, loadProgram, loadFavorites } from './api/service';
import { resultsUrl, updateFilters } from './api/navigation';
import { useCatalog } from './hooks/useCatalog';
import { useResource } from './hooks/useResource';
import CatalogProvider from './components/CatalogProvider';
import Contact from './components/Contact';
import { Loading, RequestError, CatalogStatus } from './components/RequestState';
import RouteAccessibility from './components/RouteAccessibility';
import type { Program, Taxonomy } from './api/client';
import HeroFamilyPhoto from './components/HeroFamilyPhoto';
import SupportFinder from './components/SupportFinder';
import DiscoverySearch from './components/DiscoverySearch';
import { useScrollReveal } from './components/useScrollReveal';
import './refinements.css';
const icons = [Wallet, Palette, GraduationCap, HandHeart];
const FavoritesContext = createContext<{
    ids: string[];
    toggle: (id: string) => void;
    clear: () => void;
}>({ ids: [], toggle: () => { }, clear: () => { } });
function FavoritesProvider({ children }: {
    children: ReactNode;
}) {
    const [favorites, setFavorites] = useState<{ ids: string[]; storageError: boolean }>(() => {
        try {
            const value: unknown = JSON.parse(localStorage.getItem('balaqoldau:favorites') || '[]');
            return { ids: Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && isProgramId(id)))].slice(0, 50) : [], storageError: false };
        }
        catch {
            return { ids: [], storageError: true };
        }
    });
    const { ids, storageError } = favorites;
    const [announcement, setAnnouncement] = useState('');
    const toggle = useCallback((id: string) => {
        const saved = ids.includes(id);
        if (!saved && ids.length >= 50) { setAnnouncement('Ең көбі 50 бағдарлама сақтауға болады.'); return; }
        const nextIds = saved ? ids.filter(i => i !== id) : [...ids, id];
        let failed = storageError;
        try { localStorage.setItem('balaqoldau:favorites', JSON.stringify(nextIds)); }
        catch { failed = true; }
        setFavorites({ ids: nextIds, storageError: failed });
        setAnnouncement(saved ? 'Мүмкіндік таңдаулылардан өшірілді' : 'Мүмкіндік таңдаулыларға сақталды');
    }, [ids, storageError]);
    const clear = useCallback(() => {
        let failed = storageError;
        try { localStorage.setItem('balaqoldau:favorites', '[]'); } catch { failed = true; }
        setFavorites({ ids: [], storageError: failed });
        setAnnouncement('Таңдаулылар тазаланды');
    }, [storageError]);
    const context = useMemo(() => ({ ids, toggle, clear }), [ids, toggle, clear]);
    useEffect(() => { if (!announcement) return; const timer = window.setTimeout(() => setAnnouncement(''), 3500); return () => window.clearTimeout(timer); }, [announcement]);
    return <FavoritesContext.Provider value={context}>{storageError && <div className="storage-notice" role="status">Браузер сақтауға рұқсат бермеді. Таңдаулылар осы бет ашық кезде ғана сақталады.</div>}{children}<div className="favorite-status" role="status" aria-live="polite" aria-atomic="true">{announcement}</div></FavoritesContext.Provider>;
}
function Logo() {
    return <Link to="/" className="logo" aria-label="BalaQoldau — басты бет">
    <span className="logo-symbol">
    <Heart aria-hidden="true" size={23} strokeWidth={2.5}/>
    <span />
    </span>Bala<span>Qoldau</span>
    <span className="logo-period">.</span>
    </Link>;
}
function Header() {
    const [open, setOpen] = useState(false);
    const { ids } = useContext(FavoritesContext);
    useEffect(() => {
        function closeMenu(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('.mobile-toggle')?.focus(); } }
        if (open) document.addEventListener('keydown', closeMenu);
        return () => document.removeEventListener('keydown', closeMenu);
    }, [open]);
    return <header className="header">
    <div className="container nav">
    <Logo />
    <nav id="primary-navigation" className={open ? 'nav-links is-open' : 'nav-links'} aria-label="Негізгі мәзір" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget) && !(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest('.mobile-toggle'))) setOpen(false);
    }}>
    <NavLink to="/" end>Басты бет</NavLink>
    <NavLink to="/find">Мүмкіндіктер</NavLink>
    <Link to="/#how" onClick={() => setOpen(false)}>Қалай жұмыс істейді?</Link>
    <NavLink to="/contact">Байланыс</NavLink>
    </nav>
    <div className="nav-actions">
    <NavLink to="/favorites" className="favorites-nav" aria-label={`Таңдаулылар: ${ids.length}`}>
    <Bookmark aria-hidden="true" size={19}/>
    <span>Таңдаулылар</span>{ids.length > 0 && <b>{ids.length}</b>}</NavLink>
    <span className="language">ҚАЗ</span>
    <button type="button" className="mobile-toggle icon-button" onClick={() => setOpen(!open)} onKeyDown={event => {
        // Navigation precedes the visual toggle in DOM order; Tab enters the open links.
        if (open && event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            document.querySelector<HTMLAnchorElement>('#primary-navigation a')?.focus();
        }
    }} aria-controls="primary-navigation" aria-expanded={open} aria-label={open ? 'Мәзірді жабу' : 'Мәзірді ашу'}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
    </div>
    </div>
    </header>;
}
function Layout() {
    const location = useLocation();
    useScrollReveal(location.key);
    return <>
    <a href="#main" className="skip-link">Мазмұнға өту</a>
    <RouteAccessibility/>
    <Header key={location.pathname} />
    <main id="main" tabIndex={-1}>
    <p id="external-link-note" className="sr-only">Сілтеме жаңа қойындыда ашылады.</p>
    <Routes>
    <Route path="/" element={<Home />}/>
    <Route path="/find" element={<Find key={location.search} />}/>
    <Route path="/results" element={<Results />}/>
    <Route path="/program/:id" element={<Details />}/>
    <Route path="/favorites" element={<Favorites />}/>
    <Route path="/contact" element={<Contact />}/>
    <Route path="*" element={<div className="container inner-page"><PageIntro label="404" title="Бұл бет табылмады" text="Қажетті мүмкіндікті іздеуден бастаңыз."/><Empty title="Іздеуді жалғастырыңыз" text="Қолдау іздеу бетіне өтіңіз."/></div>}/>
    </Routes>
    </main>
    <footer>
    <div className="container footer-top">
    <div>
    <Logo />
    <p>Әр баланың мүмкіндігі мол болсын.</p>
    </div>
    <div>
    <Link to="/find">Көмек табу <ArrowUpRight aria-hidden="true" size={16}/>
    </Link>
    <Link to="/favorites">Таңдаулылар</Link>
    <Link to="/contact">Байланыс</Link>
    </div>
    <div className="footer-note">Қазақстандағы отбасылар үшін<br />
    <span>Сүйіспеншілікпен жасалған <Heart aria-hidden="true" size={13}/>
    </span>
    </div>
    </div>
    <div className="container footer-bottom">
    <span>© {new Date().getFullYear()} BalaQoldau</span>
    <span>Ақпаратты дереккөзден тексеріңіз.</span>
    </div>
    </footer>
    </>;
}
function Home() {
    const catalog = useCatalog();
    const location = useLocation();
    useEffect(() => { if (location.hash === '#how') {
        const target = document.getElementById('how');
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } }, [location]);
    return <>
    <section className="container hero">
    <div className="hero-copy">
    <div className="eyebrow">
    <span /> БАЛАҢЫЗДЫҢ БОЛАШАҒЫНА БІР ҚАДАМ</div>
    <h1>Балаңызға арналған <span>мүмкіндіктерді</span> бірге табайық<span className="headline-star">✳</span>
    </h1>
    <p>Жәрдемақылар, тегін үйірмелер, білім гранттары және әлеуметтік көмек. Балаңызға қажет қолдау — бір жерден.</p>
    <div className="hero-buttons">
    <Link className="button primary" to="/find">Көмек табу <ArrowUpRight aria-hidden="true" size={20}/>
    </Link>
    <a className="button text-button" href="#how">Қалай жұмыс істейді? <ArrowRight aria-hidden="true" size={18}/>
    </a>
    </div>
    <div className="hero-trust">
    <span className="care-seal"><HandHeart size={23} aria-hidden="true" /></span>
    <div>Балаға қамқорлық — ортақ құндылық<small>Түсінікті. Ыңғайлы. Баршаға ашық.</small>
    </div>
    </div>
    </div>
    <HeroFamilyPhoto />
    <SupportFinder />
    </section>
    <div className="container">
    <div className="mission-strip">
    <span>
    <Sparkles aria-hidden="true" size={21}/> Кішкентай қадам. Үлкен мүмкіндік.</span>
    <p>Әр бала өз әлеуетін ашуға лайық.</p>
    <span className="demo-inline">Тек жарияланған бағдарламалар</span>
    </div>
    </div>
    <section className="container section categories">
    <div className="section-heading">
    <div>
    <span className="eyebrow">01 / ҚОЛДАУДЫҢ ТҮРЛЕРІ</span>
    <h2>Балаңыз үшін не іздейсіз?</h2>
    </div>
    <Link className="inline-link" to="/results">Барлық мүмкіндіктер <ArrowUpRight aria-hidden="true" size={18}/>
    </Link>
    </div>
    {catalog.categories.length === 0 && <p className="catalog-hint">{catalog.loading ? 'Қолдау түрлері жүктелуде…' : catalog.error ? 'Қолдау түрлері жүктелмеді. Жоғарыдағы «Қайта көру» батырмасын қолданыңыз.' : 'Жарияланған қолдау түрлері әлі жоқ. Бағдарламалар қосылғанда осы жерден көресіз.'}</p>}
    {catalog.categories.length > 0 && <div className={`category-grid${catalog.categories.length >= 4 ? ' has-editorial-layout' : ''}`}>{catalog.categories.map((category, i) => {
        const Icon = icons[i % icons.length];
        return <Link key={category.id} to={resultsUrl({ category: category.slug })} className={`category-card category-${i % icons.length}`}>
          <span className="category-icon"><Icon aria-hidden="true" size={27}/></span><span className="category-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          <Icon className="category-decoration" size={135} strokeWidth={1} aria-hidden="true"/>
          <h3>{category.name}</h3><p>Қолдау туралы ақпаратпен танысыңыз.</p>
          <span className="category-arrow"><ArrowUpRight aria-hidden="true" size={21}/></span>
        </Link>;
    })}</div>}
    </section>
    <section className="container section how" id="how" tabIndex={-1} aria-labelledby="how-heading">
    <div className="section-heading">
    <div>
    <span className="eyebrow">02 / БӘРІ СІЗ ОЙЛАҒАННАН ОҢАЙ</span>
    <h2 id="how-heading">Қолдауға апарар үш қадам</h2>
    </div>
    <span className="hand-drawn">Бірге бастайық ↴</span>
    </div>
    <div className="steps">{[['01', 'Өзіңіз туралы айтыңыз', 'Өңіріңізді, балаңыздың жасын және қолдау түрін таңдаңыз.'], ['02', 'Мүмкіндіктерді табыңыз', 'Таңдауыңызға сәйкес қолдау түрлерін бір жерден қараңыз.'], ['03', 'Келесі қадамды біліңіз', 'Талаптармен танысып, ұнаған мүмкіндіктерді сақтап қойыңыз.']].map(([n, title, desc]) => <article key={n}>
        <span className="step-number">{n}</span>
        <h3>{title}</h3>
        <p>{desc}</p>
        </article>)}</div>
    </section>
    <section className="container">
    <div className="bottom-cta">
    <div>
    <span className="eyebrow">БАЛАҢЫЗДЫҢ ЕРТЕҢІ БҮГІННЕН БАСТАЛАДЫ</span>
    <h2>Алғашқы қадамды бірге жасайық.</h2>
    <p>Отбасыңызға сай мүмкіндіктерді қарап көріңіз.</p>
    </div>
    <Link className="button primary" to="/find">Мүмкіндіктерді табу <ArrowUpRight aria-hidden="true" size={20}/>
    </Link>
    <svg className="cta-path" viewBox="0 0 350 240" fill="none" aria-hidden="true"><path d="M-40 190C30-20 280-30 220 112S60 340 300 200 390 40 400 10M-20 215C50 5 300-5 240 137S80 365 320 225 410 65 420 35" stroke="currentColor" strokeWidth="1.5"/></svg>
    </div>
    </section>
    </>;
}
function PageIntro({ label, title, text }: {
    label: string;
    title: string;
    text: string;
}) {
    return <div className="page-intro">
    <span className="eyebrow">{label}</span>
    <h1>{title}</h1>
    <p>{text}</p>
    </div>;
}
function SelectField({ label, name, value, options, placeholder, onChange, disabled = false }: {
    label: string; name: string; value: string; options: Taxonomy[]; placeholder: string;
    onChange: (value: string) => void; disabled?: boolean;
}) {
    return <label className="field"><span>{label}</span><div className="select-wrap">
      <select name={name} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">{placeholder}</option>{options.map(option => <option key={option.id} value={option.slug}>{option.name}</option>)}
      </select><ChevronDown aria-hidden="true" size={17}/></div></label>;
}
function Find() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const catalog = useCatalog();
    const [filters, setFilters] = useState({ region: params.get('region') || '', age: params.get('age') || '', category: params.get('category') || '', q: params.get('q') || '' });
    function submit(event: FormEvent) { event.preventDefault(); navigate(resultsUrl(filters)); }
    const disabled = catalog.loading || Boolean(catalog.error);
    return <div className="container inner-page">
      <PageIntro label="СІЗГЕ САЙ ҚОЛДАУ" title="Кішкентай мәлімет. Жаңа мүмкіндік." text="Барлық өрісті толтыру міндетті емес."/>
      <div className="search-layout"><form onSubmit={submit} className="search-form">
        <div className="form-title"><Search aria-hidden="true" size={23}/><h2>Қолдау іздеу</h2></div>
        <SelectField label="Қала / өңір" name="region" value={filters.region} options={catalog.regions} disabled={disabled} placeholder="Барлық өңірлер" onChange={region => setFilters({ ...filters, region })}/>
        <label className="field"><span>Баланың жасы</span><input type="number" name="age" min="0" max="17" step="1" placeholder="0–17 жас" value={filters.age} onChange={event => setFilters({ ...filters, age: event.target.value })}/></label>
        <SelectField label="Қолдау түрі" name="category" value={filters.category} options={catalog.categories} disabled={disabled} placeholder="Барлығы" onChange={category => setFilters({ ...filters, category })}/>
        <label className="field"><span>Іздеу сөзі</span><input name="q" type="search" maxLength={200} value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })}/></label>
        <button className="button primary" type="submit">Мүмкіндіктерді табу <ArrowRight aria-hidden="true" size={19}/></button>
        <p className="form-privacy">Аты-жөніңіз бен байланыс деректеріңіз сұралмайды.</p>
      </form><aside className="search-aside"><span className="aside-flower">✳</span><h2>Әр отбасының<br/>өз жолы бар.</h2>
        <p>Біз сол жолдағы мүмкіндіктерді көруге көмектесеміз.</p><div><Check aria-hidden="true" size={19}/> Тіркелу қажет емес</div>
        <div><Check aria-hidden="true" size={19}/> Таңдаулыларды сақтауға болады</div><CatalogStatus/>
      </aside></div>
    </div>;
}
function FavoriteButton({ program }: { program: Program }) {
    const { ids, toggle } = useContext(FavoritesContext);
    const saved = ids.includes(program.id);
    return <button type="button" className={`icon-button save-button ${saved ? 'saved' : ''}`} aria-label={saved ? `${program.title}: таңдаулылардан өшіру` : `${program.title}: таңдаулыларға сақтау`} aria-pressed={saved} onClick={() => toggle(program.id)}><Bookmark aria-hidden="true" size={20} fill={saved ? 'currentColor' : 'none'}/></button>;
}
function ProgramCard({ program }: { program: Program }) {
    const catalog = useCatalog();
    const location = useLocation();
    const category = catalog.categories.find(item => item.slug === program.category);
    const index = Math.max(0, catalog.categories.findIndex(item => item.slug === program.category)) % icons.length;
    const Icon = icons[index];
    const regionNames = program.regions.map(slug => catalog.regions.find(region => region.slug === slug)?.name || slug);
    return <article className="program-card">
      <div className="card-top"><span className={`program-icon category-${index}`}><Icon aria-hidden="true" size={25}/></span><FavoriteButton program={program}/></div>
      <span className="demo-tag">ЖАРИЯЛАНҒАН БАҒДАРЛАМА</span>
      <h2><Link to={`/program/${program.id}`} state={{ from: location.pathname + location.search }}>{program.title}</Link></h2><p className={`program-type category-${index}`}>{category?.name || program.category}</p>
      <div className="program-meta"><span><MapPin aria-hidden="true" size={15}/>{regionNames.join(', ') || 'Өңір көрсетілмеген'}</span><span><Users aria-hidden="true" size={15}/>{program.ageMin}–{program.ageMax} жас</span></div>
      <a className="official-source" href={program.sourceUrl} target="_blank" rel="noopener noreferrer" aria-describedby="external-link-note">{program.sourceName} <ExternalLink aria-hidden="true" size={13}/></a>
      <Link className="card-detail" to={`/program/${program.id}`} state={{ from: location.pathname + location.search }} aria-label={`${program.title}: толығырақ`}>Толығырақ <ArrowUpRight aria-hidden="true" size={18}/></Link>
    </article>;
}
function Empty({ title, text }: { title: string; text: string }) {
    return <div className="empty"><span><Search aria-hidden="true" size={31}/></span><h2>{title}</h2><p>{text}</p><Link to="/find" className="button primary">Көмек іздеу <ArrowRight aria-hidden="true" size={18}/></Link></div>;
}
function Results() {
    const [params] = useSearchParams();
    return <SearchResults key={params.toString()}/>;
}
function SearchResults() {
    const [params, setParams] = useSearchParams();
    const catalog = useCatalog();
    const query = params.toString();
    const state = useResource(query, loadPrograms);
    const summary = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        const active = document.activeElement;
        if (!state.loading && (active === document.body || active?.id === 'main')) summary.current?.focus({ preventScroll: true });
    }, [state.loading]);
    function categoryFilter(category: string) { setParams(updateFilters(params, { category })); }
    return <div className="container inner-page">
      <PageIntro label="МҮМКІНДІКТЕР КЕҢІСТІГІ" title="Балаңызға ашылған жаңа жолдар" text="Қолдау түрлерімен танысып, қажет ақпаратты таңдаулыларға сақтаңыз."/>
      <CatalogStatus/><DiscoverySearch key={query}/>
      <div className="results-toolbar"><div className="filter-chips" aria-label="Қолдау түрі бойынша сүзгі">
        <button className={!params.get('category') ? 'chip selected' : 'chip'} aria-pressed={!params.get('category')} onClick={() => categoryFilter('')}>Барлығы</button>
        {catalog.categories.map(item => <button key={item.id} className={params.get('category') === item.slug ? 'chip selected' : 'chip'} aria-pressed={params.get('category') === item.slug} onClick={() => categoryFilter(item.slug)}>{item.name}</button>)}
      </div><Link to={`/find?${query}`} className="inline-link"><SlidersHorizontal aria-hidden="true" size={17}/> Іздеуді өзгерту</Link></div>
      <div className="results-summary"><h2 className="result-count" id="results-heading" ref={summary} tabIndex={-1} aria-live="polite" aria-atomic="true">{state.loading ? 'Мүмкіндіктер ізделуде…' : state.error ? 'Іздеу орындалмады' : `${state.data?.pagination.total ?? 0} бағдарлама табылды`}</h2>
      {query && <button type="button" className="reset-filters" onClick={() => setParams({})}><X aria-hidden="true" size={14}/> Сүзгілерді тазалау</button>}</div>
      {state.loading ? <Loading/> : state.error ? <RequestError error={state.error} retry={state.retry}/> : state.data?.data.length ? <div className="program-grid">{state.data.data.map(program => <ProgramCard key={program.id} program={program}/>)}</div> : <div className="empty-results"><Empty title="Жарияланған бағдарлама табылмады" text="Бұл өлшемдерге сай жарияланған бағдарлама әзірге жоқ. Сүзгілерді өзгертіп немесе кейінірек қайта көріңіз."/></div>}
      {state.data && state.data.pagination.totalPages > 1 && <nav className="pagination" aria-label="Нәтиже беттері">
        <button type="button" className="button text-button" disabled={state.data.pagination.page <= 1} onClick={() => setParams(updateFilters(params, { page: String(state.data!.pagination.page - 1) }))}>Алдыңғы</button>
        <span aria-current="page">{state.data.pagination.page} / {state.data.pagination.totalPages}</span>
        <button type="button" className="button text-button" disabled={state.data.pagination.page >= state.data.pagination.totalPages} onClick={() => setParams(updateFilters(params, { page: String(state.data!.pagination.page + 1) }))}>Келесі</button>
      </nav>}
    </div>;
}
function Details() {
    const { id = '' } = useParams();
    return <ProgramDetails key={id} id={id}/>;
}
function ProgramDetails({ id }: { id: string }) {
    const state = useResource(id, loadProgram);
    const catalog = useCatalog();
    const location = useLocation();
    const routeState: unknown = location.state;
    const from = routeState && typeof routeState === 'object' && 'from' in routeState ? routeState.from : null;
    const back = typeof from === 'string' && /^\/(results|favorites)(\?|$)/.test(from) ? from : '/results';
    useEffect(() => { if (state.data) document.title = `${state.data.title} — BalaQoldau`; }, [state.data]);
    if (state.loading) return <div className="container inner-page"><PageIntro label="МҮМКІНДІКТЕР" title="Бағдарлама мәліметтері" text="Мәліметтер жүктелуде."/><Loading/></div>;
    if (state.error) return <div className="container inner-page"><PageIntro label="МҮМКІНДІКТЕР" title="Бағдарлама мәліметтері" text="Тек жарияланған бағдарламалар көрсетіледі."/>{state.error instanceof ApiError && state.error.status === 404 ? <Empty title="Бағдарлама табылмады" text="Бағдарлама жоқ немесе жарияланбаған."/> : <RequestError error={state.error} retry={state.retry}/>}</div>;
    const p = state.data;
    if (!p) return null;
    const category = catalog.categories.find(item => item.slug === p.category)?.name || p.category;
    const regionNames = p.regions.map(slug => catalog.regions.find(region => region.slug === slug)?.name || slug);
    return <div className="container inner-page">
      <Link className="inline-link back-link" to={back}><ArrowLeft aria-hidden="true" size={17}/> {back.startsWith('/favorites') ? 'Таңдаулыларға оралу' : 'Мүмкіндіктерге оралу'}</Link>
      <div className="details-heading"><div><span className="eyebrow">{category}</span><h1>{p.title}</h1>
        <div className="program-meta"><span><MapPin aria-hidden="true" size={17}/>{regionNames.join(', ') || 'Өңір көрсетілмеген'}</span><span><Users aria-hidden="true" size={17}/>{p.ageMin}–{p.ageMax} жас</span></div>
      </div><FavoriteButton program={p}/></div>
      <div className="details-layout"><div className="details-content">
        <section><h2>Бағдарлама туралы</h2><p>{p.description}</p></section>
        <section><h2>Қатысу туралы</h2><p>Жас аралығы: {p.ageMin}–{p.ageMax} жас.</p>{p.familyCategories.length > 0 && <p>Дереккөздегі отбасы санаттары: {p.familyCategories.join(', ')}.</p>}<p>Толық талаптар мен қажетті құжаттарды дереккөзден тексеріңіз.</p></section>
        <section><h2>Дереккөз</h2><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" aria-describedby="external-link-note">{p.sourceName} <ExternalLink aria-hidden="true" size={16}/></a><p>Тексерілген күні: {new Date(p.verifiedAt).toLocaleDateString('kk-KZ')}</p>{p.deadline && <p>Мерзімі: {p.deadline}</p>}</section>
      </div><aside className="application-aside"><FileText aria-hidden="true" size={30}/><h2>Келесі қадам</h2><p>Өтінім беру тәртібін дереккөзден тексеріңіз.</p>
        {p.applyUrl ? <a className="button primary" href={p.applyUrl} target="_blank" rel="noopener noreferrer" aria-describedby="external-link-note">Өтінім сілтемесіне өту <ExternalLink aria-hidden="true" size={18}/></a> : <div className="unavailable">Өтінім сілтемесі көрсетілмеген</div>}
        <p className="small">BalaQoldau бұл бағдарламаға өтінім қабылдамайды.</p>
      </aside></div>
    </div>;
}
function Favorites() {
    const { ids } = useContext(FavoritesContext);
    return <FavoriteResults key={ids.join(',')}/>;
}
function FavoriteResults() {
    const { ids, clear } = useContext(FavoritesContext);
    const state = useResource(ids.join(','), loadFavorites);
    return <div className="container inner-page"><PageIntro label="ӨЗІҢІЗ ҮШІН САҚТАҢЫЗ" title="Таңдаулы мүмкіндіктеріңіз" text="Таңдаулылар осы браузерде сақталады. Мұнда тек жарияланған бағдарламалар көрсетіледі."/>
      {state.loading ? <Loading/> : state.error ? <RequestError error={state.error} retry={state.retry}/> : state.data?.length ? <><p className="result-count" role="status">{state.data.length} бағдарлама сақталды</p><div className="program-grid">{state.data.map(program => <ProgramCard key={program.id} program={program}/>)}</div></> : <Empty title={ids.length ? 'Сақталған бағдарламалар қолжетімсіз' : 'Алғашқы мүмкіндікті сақтап қойыңыз'} text="Жарияланған бағдарламаның карточкасындағы бетбелгіні басыңыз."/>}
      {ids.length > 0 && <button type="button" className="button text-button" onClick={clear}>Таңдаулыларды тазалау</button>}
    </div>;
}
export default function App() {
    return <BrowserRouter><CatalogProvider><FavoritesProvider><Layout/></FavoritesProvider></CatalogProvider></BrowserRouter>;
}
