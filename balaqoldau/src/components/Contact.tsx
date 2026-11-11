import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/service';
import { ApiError } from '../api/client';
import type { ContactInput } from '../api/client';
import { validateContact } from '../api/contact';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, Send } from 'lucide-react';

const labels = { senderName: 'Атыңыз', email: 'Электрондық пошта', message: 'Хабарлама' };

export default function Contact() {
  const [input, setInput] = useState<ContactInput>({ senderName: '', email: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactInput, string>>>({});
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const [invalidAttempt, setInvalidAttempt] = useState(0);
  const errorSummary = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (invalidAttempt > 0) errorSummary.current?.focus(); }, [invalidAttempt]);
  function update(name: keyof ContactInput, value: string) {
    setInput(current => ({ ...current, [name]: value }));
    setErrors(current => { const next = { ...current }; delete next[name]; return next; });
    setStatus('idle');
    setFeedback('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const fields = { senderName: input.senderName.trim(), email: input.email.trim(), message: input.message.trim() };
    const nextErrors = validateContact(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus('idle');
      setFeedback('');
      setInvalidAttempt(current => current + 1);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setStatus('pending');
    setFeedback('');
    try {
      await api.contact(fields, controller.signal);
      if (!controller.signal.aborted) {
        setStatus('success');
        setFeedback('Хабарламаңыз қабылданды. Рақмет!');
        setInput({ senderName: '', email: '', message: '' });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus('error');
        setFeedback(error instanceof ApiError && error.status > 0 && error.status < 500 ? error.message
          : 'Жеткізілгенін растау мүмкін болмады. Қайта жіберу көшірме хабарлама жасауы мүмкін.');
      }
    } finally { if (request.current === controller) request.current = null; }
  }
  return <div className="container inner-page">
    <div className="page-intro"><span className="eyebrow">БАЙЛАНЫС</span><h1 id="contact-heading">Бізге хабарласыңыз</h1><p>Сұрағыңызды немесе ұсынысыңызды жіберіңіз.</p></div>
    <div className="contact-layout"><form className="search-form contact-form" onSubmit={submit} noValidate aria-labelledby="contact-heading" aria-describedby="contact-privacy" aria-busy={status === 'pending'}>
      <p id="contact-privacy">Атыңыз, email және хабарламаңыз серверге жіберіледі. ЖСН, медициналық мәліметтер мен құпия деректерді жібермеңіз.</p>
      <p className="field-hint">Барлық өрісті толтырыңыз.</p>
      {Object.keys(errors).length > 0 && <div className="error-summary" role="alert" tabIndex={-1} ref={errorSummary}>
        <h2>Деректерді тексеріңіз</h2><ul>{(['senderName', 'email', 'message'] as const).filter(name => errors[name]).map(name => <li key={name}><a href={`#contact-${name}`} onClick={event => { event.preventDefault(); document.getElementById(`contact-${name}`)?.focus(); }}>{labels[name]}: {errors[name]}</a></li>)}</ul>
      </div>}
      {(['senderName', 'email', 'message'] as const).map(name => <div className="field" key={name}>
        <label htmlFor={`contact-${name}`}>{labels[name]}</label>
        {name === 'message' ? <textarea id={`contact-${name}`} name={name} rows={6} maxLength={2000} required value={input[name]} disabled={status === 'pending'} aria-invalid={Boolean(errors[name])} aria-describedby={`${errors[name] ? `${name}-error ` : ''}contact-message-hint`} onChange={event => update(name, event.target.value)}/>
          : <input id={`contact-${name}`} name={name} type={name === 'email' ? 'email' : 'text'} autoComplete={name === 'email' ? 'email' : 'name'} maxLength={name === 'email' ? 254 : 100} required value={input[name]} disabled={status === 'pending'} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} onChange={event => update(name, event.target.value)}/>}
        {name === 'message' && <div className="field-hint message-hint"><span id="contact-message-hint">1–2000 таңба.</span><span aria-hidden="true">{[...input.message].length}/2000</span></div>}
        {errors[name] && <small className="field-error" id={`${name}-error`}>{errors[name]}</small>}
      </div>)}
      <button type="submit" className="button primary" disabled={status === 'pending'}><Send aria-hidden="true" size={18}/>{status === 'pending' ? 'Жіберілуде…' : status === 'error' ? 'Қайта жіберу' : 'Жіберу'}</button>
      {feedback && <div className={`form-feedback ${status === 'error' ? 'is-error' : 'is-success'}`} role={status === 'error' ? 'alert' : 'status'} aria-atomic="true">{status === 'error' ? <CircleAlert aria-hidden="true" size={22}/> : <CircleCheck aria-hidden="true" size={22}/>}<p>{feedback}</p></div>}
    </form><aside className="contact-help"><h2>Өтінім туралы сұрағыңыз бар ма?</h2><p>Бұл форма — BalaQoldau-ға хабарласу үшін. Бағдарламаға өтінім беру тәртібін оның дереккөзінен тексеріңіз.</p><Link className="inline-link" to="/results">Бағдарламаларды қарау</Link>{status === 'pending' && <p role="status">Хабарлама жіберілуде…</p>}</aside></div>
  </div>;
}
