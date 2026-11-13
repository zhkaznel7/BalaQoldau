import {tr,dateLocale} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { useAdmin } from './context';
import { AdminError } from './api';
import type { Program, Access, Taxonomy, Action } from './types';
import { statuses, actions, canEdit, permittedActions } from './types';
import { initialForm, validateProgramForm, programPayload } from './form';
import type { FormValues } from './form';
import {withoutLanguage} from '../components/language';

function Failure({ error, retry }: { error: Error; retry: () => void }) {
  useUi();
  const { refresh } = useAdmin();
  return <div className="admin-error" role="alert"><p>{tr(error.message)}</p><button type="button" onClick={retry}>{""+tr("m053")+""}</button>
    {error instanceof AdminError && error.status === 403 && <button type="button" onClick={() => void refresh()}>{""+tr("m054")+""}</button>}</div>;
}
export function ProgramList() {
  useUi();
  const { api, access } = useAdmin();
  const [params, setParams] = useSearchParams();
  const query = withoutLanguage(params.toString());
  const loader = useCallback((key: string, signal: AbortSignal) => api.programs(key, signal), [api]);
  const state = useResource(query, loader);
  return <section><div className="admin-page-heading"><div><h1>{""+tr("m012")+""}</h1><p className="admin-muted">{""+tr("m055")+""}</p></div>
    {access.permissions.includes('programs:draft:write') && <Link className="admin-primary" to="/admin/programs/new">{""+tr("m015")+""}</Link>}</div>
    <form className="admin-filters" onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); const next = new URLSearchParams();
      const q = String(values.get('q') || '').trim(), status = String(values.get('status') || ''); if (q) next.set('q', q); if (status) next.set('status', status); setParams(next); }} key={query}>
      <div><label htmlFor="admin-search">{""+tr("m056")+""}</label><input id="admin-search" name="q" type="search" maxLength={200} defaultValue={params.get('q') ?? ''}/></div>
      <div><label htmlFor="admin-status">{""+tr("m057")+""}</label><select id="admin-status" name="status" defaultValue={params.get('status') ?? ''}><option value="">{""+tr("m058")+""}</option>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{tr(label)}</option>)}</select></div>
      <button>{""+tr("m059")+""}</button><button type="button" onClick={() => setParams({})}>{""+tr("m060")+""}</button>
    </form>
    {state.loading ? <p role="status">{""+tr("m061")+""}</p> : state.error ? <Failure error={state.error} retry={state.retry}/> : <>
      <p role="status">{state.data?.pagination.total ?? 0}{" "+tr("m062")+""}</p>
      {!state.data?.data.length ? <p className="admin-empty">{""+tr("m063")+""}</p> : <div className="admin-table-wrap" role="region" aria-label={tr("m064")} tabIndex={0}><table><caption className="admin-visually-hidden">{""+tr("m065")+""}</caption><thead><tr><th scope="col">{""+tr("m066")+""}</th><th scope="col">{""+tr("m057")+""}</th><th scope="col">{""+tr("m067")+""}</th><th scope="col">{""+tr("m068")+""}</th></tr></thead><tbody>
        {state.data.data.map(program => <tr key={program.id}><td><Link to={'/admin/programs/' + program.id}>{program.title}</Link>{program.isDemo && <strong className="admin-demo">DEMO</strong>}</td><td>{tr(statuses[program.status])}</td><td>{program.version}</td><td>{canEdit(access, program) ? <Link to={'/admin/programs/' + program.id + '/edit'}>{""+tr("m069")+""}</Link> : <Link to={'/admin/programs/' + program.id}>{""+tr("m070")+""}</Link>}</td></tr>)}
      </tbody></table></div>}
      {state.data && state.data.pagination.totalPages > 1 && <nav className="admin-pagination" aria-label={tr("m071")}><button disabled={state.data.pagination.page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(state.data!.pagination.page - 1)); setParams(next); }}>{""+tr("m072")+""}</button>
        <span aria-current="page">{state.data.pagination.page} / {state.data.pagination.totalPages}</span><button disabled={state.data.pagination.page >= state.data.pagination.totalPages} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(state.data!.pagination.page + 1)); setParams(next); }}>{""+tr("m073")+""}</button></nav>}
    </>}
  </section>;
}
export function ProgramDetails() {
  useUi();
  const { id = '' } = useParams(), { api } = useAdmin();
  const loader = useCallback((_key: string, signal: AbortSignal) => api.program(id, signal), [api, id]);
  const state = useResource(id, loader);
  if (state.loading) return <p role="status">{""+tr("m074")+""}</p>;
  if (state.error) return <Failure error={state.error} retry={state.retry}/>;
  return state.data ? <Detail key={state.data.id} initial={state.data}/> : null;
}
function Detail({ initial }: { initial: Program }) {
  useUi();
  const { api, access } = useAdmin();
  const [program, setProgram] = useState(initial), [pending, setPending] = useState(false), [confirm, setConfirm] = useState<Action | null>(null);
  const [ack, setAck] = useState(false), [error, setError] = useState<Error | null>(null), [stale, setStale] = useState(false), [notice, setNotice] = useState('');
  const alive = useRef(true), previousVersion = useRef(program.version), actionTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (confirm) document.getElementById('admin-confirm-heading')?.focus(); }, [confirm]);
  useEffect(() => { if (previousVersion.current !== program.version) document.getElementById('admin-detail-title')?.focus(); previousVersion.current = program.version; document.title = program.title + tr("m075"); }, [program.title, program.version]);
  async function act() {
    if (!confirm || pending) return; setPending(true); setError(null);
    try { const result = await api.action(program.id, confirm, program.version); if (alive.current) { setProgram(result); setConfirm(null); setNotice(tr("m076")); } }
    catch (failure) { if (alive.current) { const next = failure instanceof Error ? failure : new AdminError(503); setError(next); setStale(next instanceof AdminError && [0,409].includes(next.status)); } }
    finally { if (alive.current) setPending(false); }
  }
  async function reload() { setPending(true); try { const result = await api.program(program.id); if (alive.current) { setProgram(result); setStale(false); setError(null); setConfirm(null); setNotice(tr("m077")); } } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure : new AdminError(503)); } finally { if (alive.current) setPending(false); } }
  return <section><Link to="/admin/programs">{""+tr("m078")+""}</Link><div className="admin-page-heading"><h1 id="admin-detail-title" tabIndex={-1}>{program.title}</h1>{canEdit(access, program) && <Link to={'/admin/programs/' + program.id + '/edit'}>{""+tr("m069")+""}</Link>}</div>
    <p><strong>{tr(statuses[program.status])}</strong>{" "+tr("m079")+" "}{program.version} {program.isDemo && <strong className="admin-demo">{""+tr("m080")+""}</strong>}</p>
    {notice && <p role="status" className="admin-success">{tr(notice)}</p>}{error && <Failure error={error} retry={() => void reload()}/>}
    {stale && <p role="alert">{""+tr("m081")+""}</p>}
    <p>{tr("m332")}{tr(program.eligibilityComplete?"m333":"m334")}</p><dl className="admin-facts"><dt>{""+tr("m082")+""}</dt><dd>{program.category}</dd><dt>{""+tr("m083")+""}</dt><dd>{program.ageMin}–{program.ageMax}</dd><dt>{""+tr("m084")+""}</dt><dd>{program.regions.join(', ') || tr("m085")}</dd><dt>{""+tr("m086")+""}</dt><dd>{program.deadline || tr("m085")}</dd></dl>
    <h2>{""+tr("m087")+""}</h2><p className="admin-description">{program.description}</p><h2>{""+tr("m088")+""}</h2>
    <p>{program.sourceUrl ? <a href={program.sourceUrl} target="_blank" rel="noopener noreferrer">{program.sourceName || tr("m089")}{" "+tr("m090")+""}</a> : tr("m091")}</p>
    <p>{""+tr("m092")+" "}{program.verifiedAt ? new Date(program.verifiedAt).toLocaleString(dateLocale()) : tr("m093")}{""+tr("m094")+""}</p>
    {program.applyUrl && <p><a href={program.applyUrl} target="_blank" rel="noopener noreferrer">{""+tr("m095")+""}</a></p>}
    <div className="admin-actions">{permittedActions(access, program).map(action => <button key={action} disabled={pending || stale} onClick={event => { actionTrigger.current = event.currentTarget; setConfirm(action); setAck(false); setError(null); }}>{tr(actions[action])}</button>)}<button disabled={pending} onClick={() => void reload()}>{""+tr("m096")+""}</button></div>
    {confirm && <section className="admin-confirm" aria-labelledby="admin-confirm-heading"><h2 id="admin-confirm-heading" tabIndex={-1}>{tr(actions[confirm])}</h2>
      <p>{confirm === 'publish' ? tr("m097") : confirm === 'unpublish' ? tr("m098") : tr("m099")}</p>
      {confirm === 'approve' && <label className="admin-check"><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)}/>{" "+tr("m100")+""}</label>}
      <button disabled={pending} onClick={() => { setConfirm(null); queueMicrotask(() => actionTrigger.current?.focus()); }}>{""+tr("m101")+""}</button> <button className="admin-primary" disabled={pending || stale || (confirm === 'approve' && !ack)} onClick={() => void act()}>{pending ? tr("m102") : tr("m103")}</button>
    </section>}
  </section>;
}
export function ProgramFormPage() {
  useUi();
  const { id } = useParams(), { api, access } = useAdmin();
  const loader = useCallback(async (_key: string, signal: AbortSignal) => {
    const [taxonomy, program] = await Promise.all([api.taxonomy(signal), id ? api.program(id, signal) : Promise.resolve(undefined)]);
    return { taxonomy, program };
  }, [api, id]);
  const state = useResource(id ?? 'new', loader);
  if (!access.permissions.includes('programs:draft:write')) return <><h1>{""+tr("m104")+""}</h1><p role="alert">{""+tr("m105")+""}</p></>;
  if (state.loading) return <p role="status">{""+tr("m106")+""}</p>;
  if (state.error) return <Failure error={state.error} retry={state.retry}/>;
  if (!state.data) return null;
  if (state.data.program && !canEdit(access, state.data.program)) return <><h1>{""+tr("m107")+""}</h1><p role="alert">{""+tr("m108")+""}</p></>;
  return <ProgramForm key={(id ?? 'new') + ':' + (state.data.program?.version ?? 0)} {...state.data} access={access} reload={state.retry}/>;
}
function ProgramForm({ program, taxonomy, reload }: { program?: Program; taxonomy: Taxonomy; access: Access; reload: () => void }) {
  useUi();
  const { api } = useAdmin(), navigate = useNavigate();
  const [values, setValues] = useState(() => initialForm(program)), [errors, setErrors] = useState<Partial<Record<keyof FormValues,string>>>({});
  const [error, setError] = useState<Error | null>(null), [pending, setPending] = useState(false), [stale, setStale] = useState(false);
  const alive = useRef(true), summary = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (Object.keys(errors).length) summary.current?.focus(); }, [errors]);
  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) { setValues(previous => ({ ...previous, [key]: value })); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (pending || stale) return;
    const invalid = validateProgramForm(values); setErrors(invalid); if (Object.keys(invalid).length) return;
    setPending(true); setError(null);
    try {
      const payload = programPayload(values);
      let result: Program;
      if (program) { const { isDemo, ...fields } = payload; if (isDemo !== program.isDemo) throw new AdminError(400); result = await api.update(program.id, { ...fields, version: program.version }); }
      else result = await api.create(payload);
      if (alive.current) navigate('/admin/programs/' + result.id);
    } catch (failure) { if (alive.current) { const next = failure instanceof Error ? failure : new AdminError(503); setError(next); setStale(next instanceof AdminError && (next.status === 0 || (!!program && next.status === 409))); } }
    finally { if (alive.current) setPending(false); }
  }
  const fields = [ ['title',tr("m066"),240], ['slug',tr("m109"),120], ['sourceName',tr("m110"),200], ['sourceUrl',tr("m111"),2048], ['applyUrl',tr("m112"),2048], ['deadline',tr("m113"),10], ['ageMin',tr("m114"),2], ['ageMax',tr("m115"),2] ] as const;
  return <section><Link to={program ? '/admin/programs/' + program.id : '/admin/programs'}>{""+tr("m116")+""}</Link><h1>{program ? tr("m117") : tr("m015")}</h1>
    <p>{""+tr("m118")+""}</p>
    {error && <div role="alert" className="admin-error">{!program && error instanceof AdminError && error.status === 409 ? tr("m119") : tr(error.message)}</div>}
    {stale && <p role="alert">{""+tr("m120")+""}</p>}
    {error && <button type="button" disabled={pending} onClick={reload}>{""+tr("m121")+""}</button>}
    {!taxonomy.categories.length && <p role="status">{tr('m305')}</p>}<form noValidate onSubmit={event => void save(event)} aria-busy={pending}>
      {Object.keys(errors).length > 0 && <div ref={summary} tabIndex={-1} role="alert" className="admin-error"><h2>{""+tr("m122")+""}</h2><ul>{Object.entries(errors).map(([key,message]) => <li key={key}><a href={'#program-' + key}>{tr(message)}</a></li>)}</ul></div>}
      <fieldset disabled={pending || stale}><legend className="admin-visually-hidden">{""+tr("m123")+""}</legend><div className="admin-form-grid">
        {fields.map(([key,label,max]) => <div key={key}><label htmlFor={'program-' + key}>{tr(label)}{['title','slug','ageMin','ageMax'].includes(key) ? ' *' : ''}</label><input id={'program-' + key} name={key} required={['title','slug','ageMin','ageMax'].includes(key)} type={key === 'deadline' ? 'date' : key === 'ageMin' || key === 'ageMax' ? 'number' : 'text'} min={key.startsWith('age') ? 0 : undefined} max={key.startsWith('age') ? 17 : undefined} maxLength={max} value={values[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? key + '-error' : undefined} onChange={event => update(key, event.target.value)}/>{errors[key] && <p id={key + '-error'} className="admin-field-error">{tr(errors[key])}</p>}</div>)}
        <div><label htmlFor="program-category">{""+tr("m124")+""}</label><select id="program-category" required value={values.category} aria-invalid={!!errors.category} aria-describedby={errors.category ? 'category-error' : undefined} onChange={event => update('category', event.target.value)}><option value="">{""+tr("m125")+""}</option>{taxonomy.categories.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>{errors.category && <p id="category-error" className="admin-field-error">{tr(errors.category)}</p>}</div>
        <div className="admin-form-wide"><label htmlFor="program-description">{""+tr("m126")+""}</label><textarea id="program-description" required rows={8} maxLength={10000} value={values.description} aria-invalid={!!errors.description} aria-describedby={errors.description ? 'description-error' : undefined} onChange={event => update('description', event.target.value)}/>{errors.description && <p id="description-error" className="admin-field-error">{tr(errors.description)}</p>}</div>
      </div>
      {(['regions','familyCategories'] as const).map(key => <fieldset key={key} id={"program-" + key} tabIndex={-1} aria-describedby={errors[key] ? key + "-error" : undefined}><legend>{key === 'regions' ? tr("m084") : tr("m127")}</legend><div className="admin-checks">{taxonomy[key].map(item => <label className="admin-check" key={item.slug}><input type="checkbox" checked={values[key].includes(item.slug)} onChange={event => update(key, event.target.checked ? [...values[key], item.slug] : values[key].filter(value => value !== item.slug))}/>{item.name}</label>)}</div>{!taxonomy[key].length && <p>{""+tr("m128")+""}</p>}</fieldset>)}
      <label className="admin-check"><input type="checkbox" checked={values.eligibilityComplete} onChange={event=>update('eligibilityComplete',event.target.checked)}/>{tr("m331")}</label>
      {!program && <label className="admin-check"><input type="checkbox" checked={values.isDemo} onChange={event => update('isDemo', event.target.checked)}/>{" "+tr("m129")+""}</label>}
      {program?.isDemo && <p className="admin-demo">{""+tr("m130")+""}</p>}
      </fieldset><button className="admin-primary" disabled={pending || stale || !taxonomy.categories.length}>{pending ? tr("m131") : tr("m132")}</button>
    </form>
  </section>;
}
