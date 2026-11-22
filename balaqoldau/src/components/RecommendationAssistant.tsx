import {useEffect, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowRight, MessageSquare, Send} from 'lucide-react';
import {Link, useLocation} from 'react-router-dom';
import {ApiError} from '../api/client';
import type {Recommendations} from '../api/client';
import {categoryName} from '../api/categories';
import {referenceName} from '../api/reference-data';
import {api} from '../api/service';
import {tr} from '../i18n/ui';
import {useUi} from '../i18n/useUi';
import MatchingSummary from './MatchingSummary';
import {carryLanguage} from './language';

const suggestions = ['aiPromptSport', 'aiPromptStudy', 'aiPromptCreative'];

type Reply = {result: Recommendations} | {error: string};
type Turn = {id: number; query: string; reply?: Reply};

function ManualSearchLink() {
  const {search} = useLocation();
  return <Link to={'/find' + carryLanguage(search, '')}>{tr('aiManual')} <ArrowRight aria-hidden="true" size={16}/></Link>;
}

function RecommendationReply({reply}: {reply: Reply}) {
  if ('error' in reply) return <>
    <p role="alert">{tr(reply.error)}</p>
    <ManualSearchLink/>
  </>;

  const {intent, data} = reply.result;
  const recognized = Object.values(intent).some(value => value !== null);
  return <>
    <p>{tr(data.length ? 'aiResults' : recognized ? 'aiEmpty' : 'aiClarify')}</p>
    {!!data.length && intent.category === 'clubs' && <p>{tr('aiClubFees')}</p>}
    {recognized && <dl className="ai-intent">
      {intent.category && <div><dt>{tr('m185')}</dt><dd>{categoryName(intent.category)}</dd></div>}
      {intent.age !== null && <div><dt>{tr('m183')}</dt><dd>{intent.age}</dd></div>}
      {intent.region && <div><dt>{tr('m181')}</dt><dd>{referenceName('regions', intent.region, intent.region)}</dd></div>}
      {intent.need && <div><dt>{tr('m327')}</dt><dd>{referenceName('familyCategories', intent.need, intent.need)}</dd></div>}
    </dl>}
    {data.length ? <ul className="ai-programs">
      {data.map(program => <li key={program.id}>
        <h3>{program.title}</h3>
        {!program.matching.checks.some(check => check.code === 'RULES_UNVERIFIED') &&
          <p>{tr('aiAgeRange', {0: program.ageMin, 1: program.ageMax})}</p>}
        <MatchingSummary matching={program.matching} expanded/>
        <div className="ai-program-links">
          <a href={program.sourceUrl} rel="noreferrer">{tr('aiSource')} · {program.sourceName}</a>
          <Link to={'/program/' + program.id}>{tr('aiDetails')} <ArrowRight aria-hidden="true" size={16}/></Link>
        </div>
      </li>)}
    </ul> : <ManualSearchLink/>}
  </>;
}

export default function RecommendationAssistant() {
  useUi();
  const [query, setQuery] = useState('');
  const [consent, setConsent] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const lastTurn = turns.at(-1);
  const pending = Boolean(lastTurn && !lastTurn.reply);

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const log = transcript.current;
    const target = log?.querySelector(lastTurn?.reply ? '.ai-turn:last-child .ai-reply' : '.ai-turn:last-child');
    if (log && target) {
      log.scrollTop += target.getBoundingClientRect().top - log.getBoundingClientRect().top - 16;
    }
  }, [lastTurn]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = query.trim();
    if (active.current || !consent || !question) return;
    const request = new AbortController();
    const id = nextId.current++;
    active.current = request;
    setTurns(previous => [...previous, {id, query: question}]);
    setQuery('');
    input.current?.focus();

    let reply: Reply;
    try {
      reply = {result: await api.recommendations(question, request.signal)};
    } catch (failure) {
      reply = {error: failure instanceof ApiError && failure.code === 'AI_UNAVAILABLE' ? 'aiUnavailable'
        : failure instanceof ApiError && failure.status === 429 ? 'm147' : 'm148'};
    } finally {
      active.current = null;
    }
    if (!request.signal.aborted) {
      setTurns(previous => previous.map(turn => turn.id === id ? {...turn, reply} : turn));
    }
  }

  return <section className="recommendation-assistant" aria-labelledby="ai-assistant-title">
    <header className="ai-header">
      <span className="ai-avatar"><MessageSquare aria-hidden="true" size={22}/></span>
      <h1 id="ai-assistant-title">{tr('aiTitle')}</h1>
      <ManualSearchLink/>
    </header>
    <div ref={transcript} className="ai-transcript" tabIndex={0} role="log" aria-relevant="additions text" aria-labelledby="ai-assistant-title">
      <div className="ai-reply"><p>{tr('aiWelcome')}</p></div>
      {turns.map(turn => <div className="ai-turn" key={turn.id}>
        <div className="ai-question"><strong>{tr('aiYou')}</strong><p>{turn.query}</p></div>
        <div className="ai-reply">
          <strong>{tr('aiTitle')}</strong>
          {turn.reply ? <RecommendationReply reply={turn.reply}/> :
            <p className="ai-pending"><span aria-hidden="true"/>{tr('aiPending')}</p>}
        </div>
      </div>)}
    </div>
    <form className="ai-composer" onSubmit={submit} aria-describedby="ai-privacy">
      <div className="ai-suggestions">
        {suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => {
          setQuery(tr(suggestion));
          input.current?.focus();
        }}>{tr(suggestion)}</button>)}
      </div>
      <div className="ai-input-row">
        <label className="field"><span>{tr('aiQuery')}</span>
          <textarea ref={input} required maxLength={400} rows={2} value={query}
            placeholder={tr('aiExample')} aria-describedby="ai-privacy" onChange={event => setQuery(event.target.value)}/>
        </label>
        <button type="submit" className="button primary" disabled={pending || !consent || !query.trim()}>
          <Send aria-hidden="true" size={17}/>{tr('aiSend')}
        </button>
      </div>
      <label className="ai-consent"><input type="checkbox" required checked={consent}
        onChange={event => setConsent(event.target.checked)}/>{tr('aiConsent')}</label>
      <p id="ai-privacy" className="field-hint">{tr('aiPrivacy')}</p>
    </form>
  </section>;
}
