import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../dist/app.js';
import {parseEnvironment} from '../dist/config/env.js';

const intent = {age: 7, region: 'almaty-city', need: 'sports-activities', category: null};
const emptyIntent = {age: null, region: null, need: null, category: null};
const input = {query: 'Алматыда 7 жастағы балаға спорт керек', consent: true};

async function endpoint(t, db) {
  const config = parseEnvironment({NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'https://example.com'});
  const server = createApp(config, db).listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port + '/api/ai/recommendations';
}

function post(url, body, headers = {}) {
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
}

test('ambiguous input asks for clarification before searching; missing catalog is unavailable', async t => {
  const url = await endpoint(t);
  const clarification = await post(url, {...input, query: 'Алматы или Астана, ребёнку 7 лет'});
  assert.equal(clarification.status, 200);
  assert.equal(clarification.headers.get('x-recommendation-mode'), 'clarification');
  assert.deepEqual(await clarification.json(), {intent: emptyIntent, data: []});
  const unavailable = await post(url, input);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, 'AI_UNAVAILABLE');
});

test('an indirect category prediction filters the catalog without sending the question to SQL', async t => {
  const query = 'Государство перечисляет деньги семье новорождённого?';
  let calls = 0;
  const url = await endpoint(t, {async query(_sql, params) {
    calls++;
    assert.equal(params[0], 'benefits');
    assert.ok(!params.includes(query));
    return {rows: [{total: 0, data: []}]};
  }});
  const result = await post(url, {query, consent: true});
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('x-recommendation-mode'), 'model');
  assert.deepEqual(await result.json(), {intent: {...emptyIntent, category:'benefits'}, data:[]});
  assert.equal(calls, 1);
});

test('public assistant is bounded and sends only canonical filters to the catalog', async t => {
  let calls = 0;
  const db = {async query(sql, params) {
    calls++;
    assert.match(sql, /FROM balaqoldau\.published_programs/);
    assert.match(sql, /p\.verified_at IS NOT NULL/);
    assert.doesNotMatch(sql, /FROM balaqoldau\.(programs|child_profiles|program_verifications)\b/);
    assert.equal(params[3], 7);
    assert.equal(params[4], 'almaty-city');
    assert.equal(params[5], 'sports-activities');
    assert.doesNotMatch(JSON.stringify(params), /Jane|example\.org|123456789012/);
    return {rows: [{total: 0, data: []}]};
  }};
  const url = await endpoint(t, db);
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await post(url, input, {Origin: 'https://blocked.example'})).status, 403);
  const result = await post(url, {...input, query: input.query + ' Jane jane@example.org 123456789012'});
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await result.json(), {intent, data: []});
  assert.equal((await post(url, {...input, consent: false})).status, 400);
  assert.equal((await post(url, {...input, profileId: 'private'})).status, 400);
  assert.equal((await post(url + '?status=draft', input)).status, 400);
  assert.equal((await post(url, input, {'Content-Type': 'text/plain'})).status, 415);
  assert.equal((await post(url, {...input, query: 'x'.repeat(401)})).status, 400);
  assert.equal((await post(url, input)).status, 429);
  assert.equal(calls, 1);
});
