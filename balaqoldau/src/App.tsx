import {tr,dateLocale} from './i18n/ui.ts';
import {useUi} from './i18n/useUi.ts';
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, Heart, MapPin, Menu, Search, Info, Users, X, SlidersHorizontal, ArrowLeft, FileText, ExternalLink, Phone, Mail } from 'lucide-react';
import { ApiError, isProgramId } from './api/client';
import { loadPrograms, loadFavorites, api } from './api/service';
import { resultsUrl, updateFilters } from './api/navigation';
import { useCatalog } from './hooks/useCatalog';
import { useResource } from './hooks/useResource';
import CatalogProvider from './components/CatalogProvider';
import Contact from './components/Contact';
import { Loading, RequestError, CatalogStatus } from './components/RequestState';
import RouteAccessibility from './components/RouteAccessibility';
import type { Taxonomy } from './api/client';
import Home from './components/Home';
import DiscoverySearch from './components/DiscoverySearch';
import UserProvider from './account/UserProvider';
import { ProgramGrid } from './components/ProgramCard';
import { SaveProgramButton, SavedProgramsScope } from './account/SavedProgramsScope';
import LanguageSwitcher, { LanguageNavigation } from './components/LanguageSwitcher';
import { carryLanguage, withoutLanguage } from './components/language';
import ContentLanguageNotice from './i18n/ContentLanguageNotice';
import ReportProgram from './components/ReportProgram';
import MatchingSummary from './components/MatchingSummary';
import {matchingContext} from './api/matching';
import {catalogCategories,categoryName} from './api/categories';
import {referenceName} from './api/reference-data';
import './refinements.css';
// PLACEHOLDERS: no verified public project contact details yet. Never invent numbers/addresses.
const footerContacts:{phone:string|null;email:string|null}={phone:null,email:null};
const FavoritesContext = createContext<{
    ids: string[];
    clear: () => void;
}>({ ids: [], clear: () => { } });
function FavoritesProvider({ children }: {
    children: ReactNode;
}) {
  useUi();
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
    const clear = useCallback(() => {
        let failed = storageError;
        try { localStorage.setItem('balaqoldau:favorites', '[]'); } catch { failed = true; }
        setFavorites({ ids: [], storageError: failed });
        setAnnouncement(tr("m154"));
    }, [storageError]);
    const context = useMemo(() => ({ ids, clear }), [ids, clear]);
    useEffect(() => { if (!announcement) return; const timer = window.setTimeout(() => setAnnouncement(''), 3500); return () => window.clearTimeout(timer); }, [announcement]);
    return <FavoritesContext.Provider value={context}>{storageError && <div className="storage-notice" role="status">{""+tr("m155")+""}</div>}{children}<div className="favorite-status" role="status" aria-live="polite" aria-atomic="true">{tr(announcement)}</div></FavoritesContext.Provider>;
}
function Logo() {
  useUi();
    return <Link to="/" className="logo" aria-label={tr("m156")}>
    <span className="logo-symbol">
    <Heart aria-hidden="true" size={23} strokeWidth={2.5}/>
    <span />
    </span>Bala<span>Qoldau</span>
    <span className="logo-period">.</span>
    </Link>;
}
function Header() {
  useUi();
    const [open, setOpen] = useState(false);
    const {search}=useLocation(),target=(path:string)=>path+carryLanguage(search,'');
    useEffect(() => {
        function closeMenu(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('.mobile-toggle')?.focus(); } }
        if (open) document.addEventListener('keydown', closeMenu);
        return () => document.removeEventListener('keydown', closeMenu);
    }, [open]);
    return <header className="header">
    <div className="container nav">
    <Logo />
    <nav id="primary-navigation" className={open ? 'nav-links is-open' : 'nav-links'} aria-label={tr("m158")} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget) && !(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest('.mobile-toggle'))) setOpen(false);
    }}>
    <NavLink to={target('/')} end>{""+tr("m159")+""}</NavLink>
    <NavLink to={target('/results')}>{""+tr("m160")+""}</NavLink>
    <NavLink to={target('/contact')}>{""+tr("m162")+""}</NavLink>
    <NavLink to={target('/profile')}>{""+tr("m163")+""}</NavLink>
    </nav>
    <div className="nav-actions">
    <NavLink to={target('/profile/saved')} className="favorites-nav" aria-label={tr("m164")}>
    <Bookmark aria-hidden="true" size={19}/>
    <span>{""+tr("m164")+""}</span></NavLink>
    <LanguageSwitcher/>
    <button type="button" className="mobile-toggle icon-button" onClick={() => setOpen(!open)} onKeyDown={event => {
        // Navigation precedes the visual toggle in DOM order; Tab enters the open links.
        if (open && event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            document.querySelector<HTMLAnchorElement>('#primary-navigation a')?.focus();
        }
    }} aria-controls="primary-navigation" aria-expanded={open} aria-label={open ? tr("m165") : tr("m166")}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
    </div>
    </div>
    </header>;
}
function Layout() {
  useUi();
    const location = useLocation();
    return <>
    <a href="#main" className="skip-link">{""+tr("m167")+""}</a>
    <RouteAccessibility/>
    <Header key={location.pathname} />
    <main id="main" tabIndex={-1}>
    <p id="external-link-note" className="sr-only">{""+tr("m168")+""}</p>
    <Routes>
    <Route path="/" element={<Home />}/>
    <Route path="/find" element={<Find key={withoutLanguage(location.search)} />}/>
    <Route path="/results" element={<Results />}/>
    <Route path="/program/:id" element={<Details />}/>
    <Route path="/favorites" element={<Favorites />}/>
    <Route path="/contact" element={<Contact />}/>
      <Route path="/profile/*" element={<Suspense fallback={<Loading/>}><ProfilePage/></Suspense>}/>
      {['/login','/register','/forgot-password','/reset-password'].map(path => <Route key={path} path={path} element={<Suspense fallback={<p role="status">{""+tr("m169")+""}</p>}><AccountPage key={location.pathname}/></Suspense>}/>)}
    <Route path="*" element={<div className="container inner-page"><PageIntro label="404" title={tr("m170")} text={tr("m171")}/><Empty title={tr("m172")} text={tr("m173")}/></div>}/>
    </Routes>
    </main>
    <footer>
    <div className="container footer-top">
    <div className="footer-brand">
    <Logo />
    <p>{tr('m525')}</p>
    </div>
    <section className="footer-contacts" aria-labelledby="footer-contact-heading">
      <h2 id="footer-contact-heading">{tr('m526')}</h2>
      <ul><li><Phone size={20} aria-hidden="true"/><div><span className="footer-contact-label">{tr('m531')}</span>{footerContacts.phone?<a href={'tel:'+footerContacts.phone.replace(/[\s()-]/g,'')}>{footerContacts.phone}</a>:<span className="footer-placeholder">{tr('m527')}</span>}</div></li>
      <li><Mail size={20} aria-hidden="true"/><div><span className="footer-contact-label">{tr('m027')}</span>{footerContacts.email?<a href={'mailto:'+footerContacts.email}>{footerContacts.email}</a>:<span className="footer-placeholder">{tr('m528')}</span>}</div></li></ul>
    </section>
    <nav className="footer-navigation" aria-label={tr("m174")}>
    <h2>{tr('m529')}</h2><p>{tr('m530')}</p>
    <Link to="/contact">{tr("m162")}<ArrowUpRight aria-hidden="true" size={16}/></Link>
    </nav>
    </div>
    <div className="container footer-bottom">
    <span>© {new Date().getFullYear()} BalaQoldau</span>
    </div>
    </footer>
    </>;
}
function PageIntro({ title, text }: {
    label: string;
    title: string;
    text: string;
}) {
  useUi();
    return <div className="page-intro">
    <h1>{tr(title)}</h1>
    <p>{tr(text)}</p>
    </div>;
}
function SelectField({ label, name, value, options, placeholder, onChange, disabled = false }: {
    label: string; name: string; value: string; options: Taxonomy[]; placeholder: string;
    onChange: (value: string) => void; disabled?: boolean;
}) {
  useUi();
    return <label className="field"><span>{tr(label)}</span><div className="select-wrap">
      <select name={name} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">{tr(placeholder)}</option>{options.map(option => <option key={option.id} value={option.slug}>{name==='category'?categoryName(option.slug,option.name):name==='region'||name==='need'?referenceName(name==='region'?'regions':'familyCategories',option.slug,option.name):option.name}</option>)}
      </select><ChevronDown aria-hidden="true" size={17}/></div></label>;
}
function Find() {
  useUi();
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const catalog = useCatalog();
    const [filters, setFilters] = useState({ region: params.get('region') || '', age: params.get('age') || '', category: params.get('category') || '', q: params.get('q') || '',need:params.get('need')||'',matching:'1' });
    function submit(event: FormEvent) { event.preventDefault(); navigate(resultsUrl(filters)); }
    const disabled = catalog.loading || Boolean(catalog.error);
    return <div className="container inner-page">
      <PageIntro label={tr("m177")} title={tr("m178")} text={tr("m179")}/>
      <div className="search-layout"><form onSubmit={submit} className="search-form">
        <div className="form-title"><Search aria-hidden="true" size={23}/><h2>{""+tr("m180")+""}</h2></div>
        <SelectField label={tr("m181")} name="region" value={filters.region} options={catalog.regions} disabled={disabled} placeholder={tr("m182")} onChange={region => setFilters({ ...filters, region })}/>
        <label className="field"><span>{""+tr("m183")+""}</span><input type="number" name="age" min="0" max="17" step="1" placeholder={tr("m184")} value={filters.age} onChange={event => setFilters({ ...filters, age: event.target.value })}/></label>
        <SelectField label={tr("m185")} name="category" value={filters.category} options={catalog.categories} disabled={disabled} placeholder={tr("m186")} onChange={category => setFilters({ ...filters, category })}/>
        <SelectField label={tr("m327")} name="need" value={filters.need} options={catalog.needs} disabled={disabled} placeholder={tr("m328")} onChange={need=>setFilters({...filters,need})}/><p className="field-hint">{tr("m330")}</p><label className="field"><span>{""+tr("m187")+""}</span><input name="q" type="search" maxLength={200} value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })}/></label>
        <button className="button primary" type="submit">{""+tr("m188")+" "}<ArrowRight aria-hidden="true" size={19}/></button>
        <p className="form-privacy">{""+tr("m189")+""}</p>
      </form><aside className="search-aside"><Info aria-hidden="true" size={28}/><h2>{""+tr("m190")+""}</h2>
        <p>{""+tr("m191")+""}</p><div><Check aria-hidden="true" size={19}/>{" "+tr("m192")+""}</div>
        <div><Check aria-hidden="true" size={19}/>{" "+tr("m193")+""}</div><CatalogStatus/><ContentLanguageNotice/>
      </aside></div>
    </div>;
}
function Empty({ title, text }: { title: string; text: string }) {
  useUi();
    return <div className="empty"><span><Search aria-hidden="true" size={31}/></span><h2>{tr(title)}</h2><p>{tr(text)}</p><Link to="/find" className="button primary">{""+tr("m194")+" "}<ArrowRight aria-hidden="true" size={18}/></Link></div>;
}
function Results() {
  useUi();
    const [params] = useSearchParams();
    return <SearchResults key={withoutLanguage(params.toString())}/>;
}
function SearchResults() {
  useUi();
    const [params, setParams] = useSearchParams();
    const catalog = useCatalog();
    const query = withoutLanguage(params.toString());
    const state = useResource(query, loadPrograms);
    const summary = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        const active = document.activeElement;
        if (!state.loading && (active === document.body || active?.id === 'main')) summary.current?.focus({ preventScroll: true });
    }, [state.loading]);
    function categoryFilter(category: string) { setParams(updateFilters(params, { category })); }
    return <div className="container inner-page">
      <PageIntro label={tr("m177")} title={tr("m195")} text={tr("m196")}/>
      <CatalogStatus/><DiscoverySearch key={query}/><label className="matching-toggle"><input type="checkbox" checked={params.get('matching')==='1'} onChange={e=>setParams(updateFilters(params,{matching:e.target.checked?'1':'',need:''}))}/>{tr("m329")}</label>{params.get('matching')==='1'&&<><p className="field-hint">{tr("m330")}</p><SelectField label={tr("m327")} name="need" value={params.get('need')||''} options={catalog.needs} disabled={catalog.loading||!!catalog.error} placeholder={tr("m328")} onChange={need=>setParams(updateFilters(params,{need}))}/></>}
      <div className="results-toolbar"><div className="filter-chips" aria-label={tr("m197")}>
        <button className={!params.get('category') ? 'chip selected' : 'chip'} aria-pressed={!params.get('category')} onClick={() => categoryFilter('')}>{""+tr("m186")+""}</button>
        {catalogCategories().map(item => <button key={item.id} className={params.get('category') === item.slug ? 'chip selected' : 'chip'} aria-pressed={params.get('category') === item.slug} onClick={() => categoryFilter(item.slug)}>{item.name}</button>)}
      </div><Link to={`/find?${query}`} className="inline-link"><SlidersHorizontal aria-hidden="true" size={17}/>{" "+tr("m198")+""}</Link></div>
      <div className="results-summary"><h2 className="result-count" id="results-heading" ref={summary} tabIndex={-1} aria-live="polite" aria-atomic="true">{state.loading ? tr("m199") : state.error ? tr("m200") : tr("m201", {"0":state.data?.pagination.total ?? 0})}</h2>
      {query && <button type="button" className="reset-filters" onClick={() => setParams({})}><X aria-hidden="true" size={14}/>{" "+tr("m202")+""}</button>}</div>
      {state.loading ? <Loading/> : state.error ? <RequestError error={state.error} retry={state.retry}/> : state.data?.data.length ? <ProgramGrid programs={state.data.data}/> : <div className="empty-results"><Empty title={tr("m203")} text={tr("m204")}/></div>}
      {state.data && state.data.pagination.totalPages > 1 && <nav className="pagination" aria-label={tr("m205")}>
        <button type="button" className="button text-button" disabled={state.data.pagination.page <= 1} onClick={() => setParams(updateFilters(params, { page: String(state.data!.pagination.page - 1) }))}>{""+tr("m072")+""}</button>
        <span aria-current="page">{state.data.pagination.page} / {state.data.pagination.totalPages}</span>
        <button type="button" className="button text-button" disabled={state.data.pagination.page >= state.data.pagination.totalPages} onClick={() => setParams(updateFilters(params, { page: String(state.data!.pagination.page + 1) }))}>{""+tr("m073")+""}</button>
      </nav>}
    </div>;
}
function Details() {
  useUi();
    const { id = '' } = useParams();
    return <ProgramDetails key={id} id={id}/>;
}
function ProgramDetails({ id }: { id: string }) {
  useUi();
    const [detailParams]=useSearchParams();
    const detailQuery=matchingContext(detailParams);
    const loadDetail=useCallback((_key:string,signal:AbortSignal)=>api.match(id,detailQuery,signal),[id,detailQuery]);
    const state = useResource(id+'?'+detailQuery, loadDetail);
    const catalog = useCatalog();
    const location = useLocation();
    const routeState: unknown = location.state;
    const from = routeState && typeof routeState === 'object' && 'from' in routeState ? routeState.from : null;
    const back = typeof from === 'string' && /^\/(results|favorites|profile\/saved)(\?|$)/.test(from) ? from : '/results';
    useEffect(() => { if (state.data) document.title = `${state.data.title} — BalaQoldau`; }, [state.data]);
    if (state.loading) return <div className="container inner-page"><PageIntro label={tr("m206")} title={tr("m207")} text={tr("m208")}/><Loading/></div>;
    if (state.error) return <div className="container inner-page"><PageIntro label={tr("m206")} title={tr("m207")} text={tr("m209")}/>{state.error instanceof ApiError && state.error.status === 404 ? <Empty title={tr("m210")} text={tr("m211")}/> : <RequestError error={state.error} retry={state.retry}/>}</div>;
    const p = state.data;
    if (!p) return null;
    const category = categoryName(p.category,catalog.categories.find(item => item.slug === p.category)?.name || p.category);
    const regionNames = p.regions.map(slug => catalog.regions.find(region => region.slug === slug)?.name || slug);
    return <div className="container inner-page">
      <Link className="inline-link back-link" to={back}><ArrowLeft aria-hidden="true" size={17}/> {back.startsWith('/favorites') ? tr("m212") : tr("m213")}</Link>
      <div className="details-heading"><div><span className="program-category">{category}</span><h1>{p.title}</h1>
        <div className="program-meta"><span><MapPin aria-hidden="true" size={17}/>{regionNames.join(', ') || tr("m214")}</span><span><Users aria-hidden="true" size={17}/>{p.ageMin}–{p.ageMax}{" "+tr("m215")+""}</span></div>
      </div><SavedProgramsScope ids={[p.id]}><SaveProgramButton id={p.id} title={p.title}/></SavedProgramsScope></div>
      <ContentLanguageNotice/>{p.matching&&<MatchingSummary matching={p.matching} expanded/>}<div className="details-layout"><div className="details-content">
        <section><h2>{""+tr("m216")+""}</h2><p>{p.description}</p></section>
        <section><h2>{""+tr("m217")+""}</h2><p>{""+tr("m218")+" "}{p.ageMin}–{p.ageMax}{" "+tr("m219")+""}</p>{p.familyCategories.length > 0 && <p>{""+tr("m220")+" "}{p.familyCategories.join(', ')}.</p>}<p>{""+tr("m221")+""}</p></section>
        <section><h2>{""+tr("m222")+""}</h2><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" aria-describedby="external-link-note">{p.sourceName} <ExternalLink aria-hidden="true" size={16}/></a><p>{""+tr("m223")+" "}{new Date(p.verifiedAt).toLocaleDateString(dateLocale())}</p>{p.deadline && <p>{""+tr("m224")+" "}{p.deadline}</p>}</section>
      </div><aside className="application-aside"><FileText aria-hidden="true" size={30}/><h2>{""+tr("m225")+""}</h2><p>{""+tr("m226")+""}</p>
        {p.applyUrl ? <a className="button primary" href={p.applyUrl} target="_blank" rel="noopener noreferrer" aria-describedby="external-link-note">{""+tr("m227")+" "}<ExternalLink aria-hidden="true" size={18}/></a> : <div className="unavailable">{""+tr("m228")+""}</div>}
        <p className="small">{""+tr("m229")+""}</p>
      </aside></div><ReportProgram programId={p.id}/>
    </div>;
}
function Favorites() {
  useUi();
    const { ids } = useContext(FavoritesContext);
    return <FavoriteResults key={ids.join(',')}/>;
}
function FavoriteResults() {
  useUi();
    const { ids, clear } = useContext(FavoritesContext);
    const state = useResource(ids.join(','), loadFavorites);
    return <div className="container inner-page"><PageIntro label={tr("m230")} title={tr("m231")} text={tr("m232")}/>
      {state.loading ? <Loading/> : state.error ? <RequestError error={state.error} retry={state.retry}/> : state.data?.length ? <><p className="result-count" role="status">{state.data.length}{" "+tr("m233")+""}</p><ProgramGrid programs={state.data}/></> : <Empty title={ids.length ? tr("m234") : tr("m235")} text={tr("m236")}/>}
      {ids.length > 0 && <button type="button" className="button text-button" onClick={clear}>{""+tr("m237")+""}</button>}
    </div>;
}
const AdminApp = lazy(() => import('./admin/AdminApp'));
const AccountPage = lazy(() => import('./account/AccountPage'));
const ProfilePage = lazy(() => import('./account/ProfilePage'));
export default function App() {
    return <BrowserRouter><LanguageNavigation/><Routes><Route path="/admin/*" element={<Suspense fallback={<main><p role="status">{""+tr("m238")+""}</p></main>}><AdminApp/></Suspense>}/>
      <Route path="*" element={<CatalogProvider><UserProvider><FavoritesProvider><Layout/></FavoritesProvider></UserProvider></CatalogProvider>}/></Routes></BrowserRouter>;
}
