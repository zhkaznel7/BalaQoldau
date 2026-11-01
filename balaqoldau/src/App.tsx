import { createContext, useContext, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, Heart, MapPin, Menu, Search, Sparkles, Users, Wallet, Palette, GraduationCap, HandHeart, X, SlidersHorizontal, ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { familyCategories, programRepository, programs, regions, supportTypes } from './data/programs';
import type { Program, SearchFilters } from './data/programs';
import HeroFamilyPhoto from './components/HeroFamilyPhoto';
import SupportFinder from './components/SupportFinder';
import DiscoverySearch from './components/DiscoverySearch';
import { useScrollReveal } from './components/useScrollReveal';
import './refinements.css';
const icons = [Wallet, Palette, GraduationCap, HandHeart];
const FavoritesContext = createContext<{
    ids: string[];
    toggle: (id: string) => void;
}>({ ids: [], toggle: () => { } });
function FavoritesProvider({ children }: {
    children: ReactNode;
}) {
    const [ids, setIds] = useState<string[]>(() => {
        try {
            const value: unknown = JSON.parse(localStorage.getItem('balaqoldau:favorites') || '[]');
            return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && programs.some(p => p.id === id)) : [];
        }
        catch {
            return [];
        }
    });
    const [storageError, setStorageError] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    function toggle(id: string) {
        const saved = ids.includes(id);
        setIds(current => current.includes(id) ? current.filter(i => i !== id) : [...current, id]);
        setAnnouncement(saved ? 'Мүмкіндік таңдаулылардан өшірілді' : 'Мүмкіндік таңдаулыларға сақталды');
    }
    useEffect(() => { if (!announcement) return; const timer = window.setTimeout(() => setAnnouncement(''), 3500); return () => window.clearTimeout(timer); }, [announcement]);
    useEffect(() => { try {
        localStorage.setItem('balaqoldau:favorites', JSON.stringify(ids));
    }
    catch {
        setStorageError(true);
    } }, [ids]);
    return <FavoritesContext.Provider value={{ ids, toggle }}>{storageError && <div className="storage-notice" role="status">Браузер сақтауға рұқсат бермеді. Таңдаулылар осы бет ашық кезде ғана сақталады.</div>}{children}<div className="favorite-status" role="status" aria-live="polite" aria-atomic="true">{announcement}</div></FavoritesContext.Provider>;
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
function Layout() {
    const [open, setOpen] = useState(false);
    const { ids } = useContext(FavoritesContext);
    const location = useLocation();
    useScrollReveal(location.key);
    useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
    useEffect(() => {
        function closeMenu(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('.mobile-toggle')?.focus(); } }
        if (open) document.addEventListener('keydown', closeMenu);
        return () => document.removeEventListener('keydown', closeMenu);
    }, [open]);
    return <>
    <a href="#main" className="skip-link">Мазмұнға өту</a>
    <header className="header">
    <div className="container nav">
    <Logo />
    <nav id="primary-navigation" className={open ? 'nav-links is-open' : 'nav-links'} aria-label="Негізгі мәзір">
    <NavLink to="/" end>Басты бет</NavLink>
    <NavLink to="/find">Мүмкіндіктер</NavLink>
    <Link to="/#how" onClick={() => setOpen(false)}>Қалай жұмыс істейді?</Link>
    </nav>
    <div className="nav-actions">
    <NavLink to="/favorites" className="favorites-nav" aria-label={`Таңдаулылар: ${ids.length}`}>
    <Bookmark aria-hidden="true" size={19}/>
    <span>Таңдаулылар</span>{ids.length > 0 && <b>{ids.length}</b>}</NavLink>
    <span className="language">ҚАЗ</span>
    <button className="mobile-toggle icon-button" onClick={() => setOpen(!open)} aria-controls="primary-navigation" aria-expanded={open} aria-label={open ? 'Мәзірді жабу' : 'Мәзірді ашу'}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
    </div>
    </div>
    </header>
    <main id="main">
    <Routes>
    <Route path="/" element={<Home />}/>
    <Route path="/find" element={<Find />}/>
    <Route path="/results" element={<Results />}/>
    <Route path="/program/:id" element={<Details />}/>
    <Route path="/favorites" element={<Favorites />}/>
    <Route path="*" element={<Empty title="Бұл бет табылмады" text="Қажетті мүмкіндікті іздеуден бастаңыз."/>}/>
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
    </div>
    <div className="footer-note">Қазақстандағы отбасылар үшін<br />
    <span>Сүйіспеншілікпен жасалған <Heart aria-hidden="true" size={13}/>
    </span>
    </div>
    </div>
    <div className="container footer-bottom">
    <span>© {new Date().getFullYear()} BalaQoldau</span>
    <span>DEMO · Көрсетілім нұсқасы. Ресми ақпарат емес.</span>
    </div>
    </footer>
    </>;
}
function Home() {
    const location = useLocation();
    useEffect(() => { if (location.hash === '#how')
        document.getElementById('how')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [location]);
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
    <span className="demo-inline">DEMO · Көрсетілім нұсқасы</span>
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
    <div className="category-grid">{supportTypes.map((type, i) => {
            const Icon = icons[i];
            return <Link key={type} to={`/find?type=${encodeURIComponent(type)}`} className={`category-card category-${i}`}>
            <span className="category-icon">
            <Icon size={27}/>
            </span>
            <span className="category-number">0{i + 1}</span>
            <Icon className="category-decoration" size={135} strokeWidth={1} aria-hidden="true" />
            <h3>{type}</h3>
            <p>{['Отбасыңызға қаржылық қолдау', 'Жаңа қызығушылық, жаңа достар', 'Білімді болашаққа бастар жол', 'Қажет сәтте жаныңыздан табылу'][i]}</p>
            <span className="category-arrow">
            <ArrowUpRight aria-hidden="true" size={21}/>
            </span>
            </Link>;
        })}</div>
    </section>
    <section className="container section how" id="how">
    <div className="section-heading">
    <div>
    <span className="eyebrow">02 / БӘРІ СІЗ ОЙЛАҒАННАН ОҢАЙ</span>
    <h2>Қолдауға апарар үш қадам</h2>
    </div>
    <span className="hand-drawn">Бірге бастайық ↴</span>
    </div>
    <div className="steps">{[['01', 'Өзіңіз туралы айтыңыз', 'Өңіріңізді, балаңыздың жасын және отбасы санатын таңдаңыз.'], ['02', 'Мүмкіндіктерді табыңыз', 'Таңдауыңызға сәйкес қолдау түрлерін бір жерден қараңыз.'], ['03', 'Келесі қадамды біліңіз', 'Талаптармен танысып, ұнаған мүмкіндіктерді сақтап қойыңыз.']].map(([n, title, desc]) => <article key={n}>
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
function DemoNotice() {
    return <div className="demo-notice">
    <Sparkles aria-hidden="true" size={19}/>
    <p>
    <strong>DEMO · Көрсетілім деректері.</strong> Атаулар мен сәйкестік өлшемдері — ойдан шығарылған үлгілер. Бұл нақты мемлекеттік бағдарламалар емес.</p>
    </div>;
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
function SelectField({ label, name, value, options, placeholder, onChange }: {
    label: string;
    name: string;
    value: string;
    options: readonly string[];
    placeholder: string;
    onChange: (v: string) => void;
}) {
    return <label className="field">
    <span>{label}</span>
    <div className="select-wrap">
    <select name={name} value={value} onChange={e => onChange(e.target.value)}>
    <option value="">{placeholder}</option>{options.map(option => <option key={option}>{option}</option>)}</select>
    <ChevronDown aria-hidden="true" size={17}/>
    </div>
    </label>;
}
function Find() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [filters, setFilters] = useState<SearchFilters>({ region: params.get('region') || '', age: params.get('age') || '', family: params.get('family') || '', type: params.get('type') || '' });
    function submit(e: FormEvent) { e.preventDefault(); navigate(`/results?${new URLSearchParams({ ...filters })}`); }
    return <div className="container inner-page">
    <PageIntro label="СІЗГЕ САЙ ҚОЛДАУ" title="Кішкентай мәлімет. Жаңа мүмкіндік." text="Өзіңізге ыңғайлы өлшемдерді таңдаңыз. Барлық өрісті толтыру міндетті емес."/>
    <div className="search-layout">
    <form onSubmit={submit} className="search-form">
    <div className="form-title">
    <Search aria-hidden="true" size={23}/>
    <h2>Қолдау іздеу</h2>
    </div>
    <SelectField label="Қала / өңір" name="region" value={filters.region} options={regions} placeholder="Барлық өңірлер" onChange={region => setFilters({ ...filters, region })}/>
    <label className="field">
    <span>Баланың жасы</span>
    <input type="number" name="age" min="0" max="17" step="1" placeholder="0–17 жас" value={filters.age} onChange={e => setFilters({ ...filters, age: e.target.value })}/>
    </label>
    <SelectField label="Отбасы санаты" name="family" value={filters.family} options={familyCategories} placeholder="Барлық санаттар" onChange={family => setFilters({ ...filters, family })}/>
    <SelectField label="Қолдау түрі" name="type" value={filters.type} options={supportTypes} placeholder="Барлығы" onChange={type => setFilters({ ...filters, type })}/>
    <button className="button primary" type="submit">Мүмкіндіктерді табу <ArrowRight aria-hidden="true" size={19}/>
    </button>
    <p className="form-privacy">Аты-жөніңіз бен байланыс деректеріңіз сұралмайды.</p>
    </form>
    <aside className="search-aside">
    <span className="aside-flower">✳</span>
    <h2>Әр отбасының<br />өз жолы бар.</h2>
    <p>Біз сол жолдағы мүмкіндіктерді көруге көмектесеміз.</p>
    <div>
    <Check aria-hidden="true" size={19}/> Тіркелу қажет емес</div>
    <div>
    <Check aria-hidden="true" size={19}/> Таңдаулыларды сақтауға болады</div>
    <DemoNotice />
    </aside>
    </div>
    </div>;
}
function FavoriteButton({ program }: {
    program: Program;
}) {
    const { ids, toggle } = useContext(FavoritesContext);
    const saved = ids.includes(program.id);
    return <button type="button" className={`icon-button save-button ${saved ? 'saved' : ''}`} aria-label={saved ? `${program.title}: таңдаулылардан өшіру` : `${program.title}: таңдаулыларға сақтау`} aria-pressed={saved} onClick={() => toggle(program.id)}>
    <Bookmark aria-hidden="true" size={20} fill={saved ? 'currentColor' : 'none'}/>
    </button>;
}
function ProgramCard({ program }: {
    program: Program;
}) {
    const i = supportTypes.indexOf(program.type);
    const Icon = icons[i];
    return <article className="program-card">
    <div className="card-top">
    <span className={`program-icon category-${i}`}>
    <Icon size={25}/>
    </span>
    <FavoriteButton program={program}/>
    </div>
    <span className="demo-tag">{program.isDemo ? 'DEMO · ҮЛГІ' : 'ТЕКСЕРІЛГЕН АҚПАРАТ'}</span>
    <h2>
    <Link to={`/program/${program.id}`}>{program.title}</Link>
    </h2>
    <p className={`program-type category-${i}`}>{program.type}</p>
    <div className="program-meta">
    <span>
    <MapPin aria-hidden="true" size={15}/>{program.region}</span>
    <span>
    <Users aria-hidden="true" size={15}/>{program.minAge}–{program.maxAge} жас</span>
    </div>
    <div className="eligibility-summary"><span>{program.isDemo ? 'Үлгі сәйкестік өлшемдері' : 'Қатысу санаттары'}</span><ul>{program.categories.map(category => <li key={category}><Check aria-hidden="true" size={14} />{category}</li>)}</ul></div>
    {program.officialUrl && <a className="official-source" href={program.officialUrl} target="_blank" rel="noopener noreferrer">Ресми дереккөз <ExternalLink aria-hidden="true" size={13} /></a>}
    <Link className="card-detail" to={`/program/${program.id}`}>Толығырақ <ArrowUpRight aria-hidden="true" size={18}/>
    </Link>
    </article>;
}
function Empty({ title, text }: {
    title: string;
    text: string;
}) {
    return <div className="empty">
    <span>
    <Search aria-hidden="true" size={31}/>
    </span>
    <h2>{title}</h2>
    <p>{text}</p>
    <Link to="/find" className="button primary">Көмек іздеу <ArrowRight aria-hidden="true" size={18}/>
    </Link>
    </div>;
}
function Results() {
    const [params, setParams] = useSearchParams();
    const [items, setItems] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const query = params.toString();
    useEffect(() => { let active = true; setLoading(true); setFailed(false); const values = new URLSearchParams(query); programRepository.search({ region: values.get('region') || '', age: values.get('age') || '', family: values.get('family') || '', type: values.get('type') || '', q: values.get('q') || '' }).then(result => { if (active) {
        setItems(result);
        setLoading(false);
    } }).catch(() => { if (active) { setFailed(true); setLoading(false); } }); return () => { active = false; }; }, [query]);
    return <div className="container inner-page">
    <PageIntro label="МҮМКІНДІКТЕР КЕҢІСТІГІ" title="Балаңызға ашылған жаңа жолдар" text="Қолдау түрлерімен танысып, қажет ақпаратты таңдаулыларға сақтаңыз."/>
    <DemoNotice />
    <DiscoverySearch key={query} />
    <div className="results-toolbar">
    <div className="filter-chips" aria-label="Қолдау түрі бойынша сүзгі">{['', ...supportTypes].map(type => <button key={type} className={(params.get('type') || '') === type ? 'chip selected' : 'chip'} aria-pressed={(params.get('type') || '') === type} onClick={() => { const next = new URLSearchParams(params); if (type)
            next.set('type', type);
        else
            next.delete('type'); setParams(next); }}>{type || 'Барлығы'}</button>)}</div>
    <Link to={`/find?${query}`} className="inline-link">
    <SlidersHorizontal aria-hidden="true" size={17}/> Іздеуді өзгерту</Link>
    </div>
    <div className="results-summary"><div className="result-count" role="status">{loading ? 'Мүмкіндіктер ізделуде…' : failed ? 'Іздеу орындалмады' : `${items.length} үлгі табылды`}{params.get('region') && ` · ${params.get('region')}`}{params.get('age') && ` · ${params.get('age')} жас`}{params.get('family') && ` · ${params.get('family')}`}{params.get('q') && ` · «${params.get('q')}»`}</div>{query && <button type="button" className="reset-filters" onClick={() => setParams({})}><X aria-hidden="true" size={14}/> Сүзгілерді тазалау</button>}</div>
    {loading ? <div className="program-grid" aria-label="Жүктелуде" aria-busy="true">{[1, 2, 3].map(n => <div key={n} className="skeleton"><span/><span/><span/></div>)}</div> : failed ? <Empty title="Мәліметтерді жүктеу мүмкін болмады" text="Іздеуді қайта орындап көріңіз."/> : items.length ? <div className="program-grid">{items.map(p => <ProgramCard program={p} key={p.id}/>)}</div> : <div className="empty-results"><Empty title="Бұл өлшемдерге сай үлгі табылмады" text="Іздеу сөзін, өңірді немесе жас аралығын өзгертіп көріңіз. Қазір тек шағын DEMO жинағы қолжетімді."/><button className="inline-link" onClick={() => setParams({})}>Барлық үлгілерді көрсету <ArrowRight aria-hidden="true" size={16}/></button></div>}</div>;
}
function Details() {
    const { id } = useParams();
    const p = programRepository.getById(id || '');
    if (!p)
        return <Empty title="Бағдарлама табылмады" text="Мүмкіндіктер тізімінен басқа үлгіні таңдаңыз."/>;
    return <div className="container inner-page">
    <Link className="inline-link back-link" to="/results">
    <ArrowLeft aria-hidden="true" size={17}/> Мүмкіндіктерге оралу</Link>
    <DemoNotice />
    <div className="details-heading">
    <div>
    <span className="eyebrow">{p.type}</span>
    <h1>{p.title}</h1>
    <div className="program-meta">
    <span>
    <MapPin aria-hidden="true" size={17}/>{p.region}</span>
    <span>
    <Users aria-hidden="true" size={17}/>{p.minAge}–{p.maxAge} жас · үлгі өлшемі</span>
    </div>
    </div>
    <FavoriteButton program={p}/>
    </div>
    <div className="details-layout">
    <div className="details-content">
    <section>
    <h2>Үлгі туралы</h2>
    <p>{p.description}</p>
    </section>
    <section>
    <h2>Қатысу талаптары</h2>
    <ul>{p.eligibility.map(item => <li key={item}>{item}</li>)}</ul>
    <p>Үлгі отбасы санаттары: {p.categories.join(', ')}.</p>
    </section>
    <section>
    <h2>Қажетті құжаттар</h2>{p.documents.map(item => <p key={item}>{item}</p>)}</section>
    <section>
    <h2>Өтінім беру жолы</h2>
    <ol>{p.instructions.map(item => <li key={item}>{item}</li>)}</ol>
    </section>
    </div>
    <aside className="application-aside">
    <FileText aria-hidden="true" size={30}/>
    <h2>Келесі қадам</h2>
    <p>Бұл көрсетілім нұсқасында өтінім қабылданбайды.</p>{p.officialUrl ? <a className="button primary" href={p.officialUrl} target="_blank" rel="noopener noreferrer">Ресми өтінімге өту <ExternalLink aria-hidden="true" size={18}/>
        </a> : <div className="unavailable">Ресми сілтеме әлі қосылмаған</div>}<p className="small">Тексерілген ақпарат жарияланғаннан кейін, өтінім тек ресми қызмет арқылы беріледі.</p>
    </aside>
    </div>
    </div>;
}
function Favorites() {
    const { ids } = useContext(FavoritesContext);
    const items = programs.filter(p => ids.includes(p.id));
    return <div className="container inner-page">
    <PageIntro label="ӨЗІҢІЗ ҮШІН САҚТАҢЫЗ" title="Таңдаулы мүмкіндіктеріңіз" text="Қызықтырған мүмкіндіктеріңіз осында. Олар осы браузерде сақталады."/>{items.length ? <>
        <DemoNotice />
        <p className="result-count" role="status">{items.length} үлгі сақталды</p>
        <div className="program-grid">{items.map(p => <ProgramCard key={p.id} program={p}/>)}</div>
        </> : <Empty title="Алғашқы мүмкіндікті сақтап қойыңыз" text="Карточкадағы бетбелгіні басыңыз — таңдаған үлгілеріңіз осы жерден табылады."/>}</div>;
}
export default function App() {
    return <BrowserRouter>
    <FavoritesProvider>
    <Layout />
    </FavoritesProvider>
    </BrowserRouter>;
}
