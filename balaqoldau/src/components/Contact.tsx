import {tr} from '../i18n/ui.ts';
import {useUi} from '../i18n/useUi.ts';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/service';
import { ApiError } from '../api/client';
import type { ContactInput } from '../api/client';
import { validateContact } from '../api/contact';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, Send } from 'lucide-react';
import {useUser} from '../account/context';

const labels = { senderName: tr("m239"), email: tr("m027"), message: tr("m240") };

export default function Contact() {
  useUi();
  const {session,api:accountApi}=useUser(),userId=session?.user?.id;
  const edited=useRef({senderName:false,email:false});
  const [input, setInput] = useState<ContactInput>({ senderName: '', email: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactInput, string>>>({});
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const [invalidAttempt, setInvalidAttempt] = useState(0);
  const errorSummary = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const submission = useRef<{ id: string; key: string } | null>(null);
  useEffect(()=>{
    if(!userId)return;
    const controller=new AbortController();
    void accountApi.dashboard(controller.signal).then(profile=>{
      if(!controller.signal.aborted)setInput(current=>({...current,senderName:edited.current.senderName?current.senderName:profile.fullName??'',email:edited.current.email?current.email:profile.email}));
    }).catch(()=>{/* Optional prefill failure leaves the editable public form available. */});
    return()=>controller.abort();
  },[accountApi,userId]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (invalidAttempt > 0) errorSummary.current?.focus(); }, [invalidAttempt]);
  function update(name: keyof ContactInput, value: string) {
    if(name==='senderName'||name==='email')edited.current[name]=true;
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
    const key = JSON.stringify([
      fields.senderName,
      fields.email,
      fields.message,
    ]);

    if (!submission.current || submission.current.key !== key) {
      submission.current = {
        id: crypto.randomUUID(),
        key,
      };
    }
    const controller = new AbortController();
    request.current = controller;
    setStatus('pending');
    setFeedback('');
    try {
      await (userId?accountApi:api).contact(
        { ...fields, submissionId: submission.current!.id },
        controller.signal
      );
      if (!controller.signal.aborted) {
        setStatus('success');
        submission.current = null;
        setFeedback(tr("m241"));
        setInput({ senderName: '', email: '', message: '' });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus('error');
        setFeedback(error instanceof ApiError && error.status > 0 && error.status < 500 ? error.message
          : tr("m242"));
      }
    } finally { if (request.current === controller) request.current = null; }
  }
  return <div className="container inner-page">
    <div className="page-intro"><h1 id="contact-heading">{""+tr("m243")+""}</h1><p>{""+tr("m244")+""}</p></div>
    <div className="contact-layout"><form className="search-form contact-form" onSubmit={submit} noValidate aria-labelledby="contact-heading" aria-describedby="contact-privacy" aria-busy={status === 'pending'}>
      <p id="contact-privacy">{tr('m245')}{userId&&<> {tr('m494')}</>}</p>
      <p className="field-hint">{""+tr("m246")+""}</p>
      {Object.keys(errors).length > 0 && <div className="error-summary" role="alert" tabIndex={-1} ref={errorSummary}>
        <h2>{""+tr("m122")+""}</h2><ul>{(['senderName', 'email', 'message'] as const).filter(name => errors[name]).map(name => <li key={name}><a href={`#contact-${name}`} onClick={event => { event.preventDefault(); document.getElementById(`contact-${name}`)?.focus(); }}>{tr(labels[name])}: {tr(errors[name])}</a></li>)}</ul>
      </div>}
      {(['senderName', 'email', 'message'] as const).map(name => <div className="field" key={name}>
        <label htmlFor={`contact-${name}`}>{tr(labels[name])}</label>
        {name === 'message' ? <textarea id={`contact-${name}`} name={name} rows={6} maxLength={2000} required value={input[name]} disabled={status === 'pending'} aria-invalid={Boolean(errors[name])} aria-describedby={`${errors[name] ? `${name}-error ` : ''}contact-message-hint`} onChange={event => update(name, event.target.value)}/>
          : <input id={`contact-${name}`} name={name} type={name === 'email' ? 'email' : 'text'} autoComplete={name === 'email' ? 'email' : 'name'} maxLength={name === 'email' ? 254 : 100} required value={input[name]} disabled={status === 'pending'} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} onChange={event => update(name, event.target.value)}/>}
        {name === 'message' && <div className="field-hint message-hint"><span id="contact-message-hint">{""+tr("m247")+""}</span><span aria-hidden="true">{[...input.message].length}/2000</span></div>}
        {errors[name] && <small className="field-error" id={`${name}-error`}>{tr(errors[name])}</small>}
      </div>)}
      <button type="submit" className="button primary" disabled={status === 'pending'}><Send aria-hidden="true" size={18}/>{status === 'pending' ? tr("m248") : status === 'error' ? tr("m249") : tr("m250")}</button>
      {feedback && <div className={`form-feedback ${status === 'error' ? 'is-error' : 'is-success'}`} role={status === 'error' ? 'alert' : 'status'} aria-atomic="true">{status === 'error' ? <CircleAlert aria-hidden="true" size={22}/> : <CircleCheck aria-hidden="true" size={22}/>}<p>{tr(feedback)}</p></div>}
    </form><aside className="contact-help"><h2>{""+tr("m251")+""}</h2><p>{""+tr("m252")+""}</p><Link className="inline-link" to="/results">{""+tr("m253")+""}</Link>{status === 'pending' && <p role="status">{""+tr("m254")+""}</p>}</aside></div>
  </div>;
}
