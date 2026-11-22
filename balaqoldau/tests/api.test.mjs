import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, ApiError } from '../src/api/client.ts';
import { resultsUrl, updateFilters } from '../src/api/navigation.ts';
import { validateContact } from '../src/api/contact.ts';

const id = '11111111-1111-4111-8111-111111111111';
const program = { id, slug: 'test-program', category: 'clubs', title: 'TEST бағдарлама', description: 'TEST', sourceUrl: 'https://example.com/source', sourceName: 'TEST', verifiedAt: '2026-11-11T00:00:00Z', ageMin: 0, ageMax: 17, deadline: null, applyUrl: null, isDemo: false, regions: ['test-region'], familyCategories: [] };
const page = (data, number = 1, total = data.length, limit = 20) => ({ data, pagination: { page: number, limit, total, totalPages: Math.ceil(total / limit) } });

test('contact email preserves valid plus addresses and rejects malformed local/domain parts', () => {
  const fields = { senderName: 'TEST', message: 'TEST' };
  for (const email of ['parent+club@example.kz', "o'connor@example.com", 'Parent.Name@Example.KZ']) {
    assert.equal(validateContact({ ...fields, email }).email, undefined);
  }
  for (const email of ['a..b@example.kz', '.a@example.kz', 'a.@example.kz', 'a@-example.kz', 'a@example.c', 'a@exam_ple.kz']) {
    assert.equal(typeof validateContact({ ...fields, email }).email, 'string');
  }
});

test('search URL uses supported API filters only, including zero age and pagination', async () => {
  let requested;
  const api = createApi('/api', async (url, init) => { requested = [url, init]; return Response.json(page([program])); });
  const result = await api.programs('category=clubs&region=test-region&age=0&q=іздеу&page=2&limit=10');
  const url = new URL(requested[0], 'http://localhost');
  assert.equal(url.pathname, '/api/programs');
  assert.equal(url.searchParams.get('category'), 'clubs');
  assert.equal(url.searchParams.get('age'), '0');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(requested[1].credentials, 'omit');
  assert.equal(result.data[0].id, id);
});
test('navigation preserves filters, resets page and category links open results directly', () => {
  assert.equal(resultsUrl({ category: 'clubs' }), '/results?category=clubs');
  const next = updateFilters(new URLSearchParams('region=test-region&page=3'), { q: 'жаңа' });
  assert.equal(next.get('region'), 'test-region');
  assert.equal(next.get('page'), null);
  assert.equal(next.get('q'), 'жаңа');
});
for (const status of [400, 404, 429, 500, 503]) {
  test(`HTTP ${status} produces safe localized errors`, async () => {
    const api = createApi('/api', async () => Response.json({ error: { message: 'private secret' } }, { status }));
    await assert.rejects(api.program(id), error => error instanceof ApiError && error.status === status && !error.message.includes('private'));
  });
}
test('network and malformed JSON failures do not produce DEMO fallback', async () => {
  await assert.rejects(createApi('/api', async () => { throw new Error('secret host'); }).programs(''), ApiError);
  await assert.rejects(createApi('/api', async () => new Response('<html>wrong server</html>')).programs(''), ApiError);
});
test('caller cancellation aborts fetch without automatic retries', async () => {
  const controller = new AbortController();
  let calls = 0;
  const api = createApi('/api', async (_url, init) => {
    calls++;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  });
  const request = api.programs('', controller.signal);
  controller.abort();
  await assert.rejects(request, ApiError);
  assert.equal(calls, 1);
});
for (const changed of [{ isDemo: true }, { status: 'draft' }, { status: 'verified' }, { sourceUrl: 'javascript:alert(1)' }, { applyUrl: 'https://user:secret@example.com/apply' }]) {
  test(`rejects private/unsafe record: ${Object.keys(changed)[0]}`, async () => {
    const api = createApi('/api', async () => Response.json(page([{ ...program, ...changed }])));
    await assert.rejects(api.programs(''), ApiError);
  });
}
test('taxonomy reads all API pages and retains slug/name mapping', async () => {
  let calls = 0;
  const api = createApi('/api', async () => Response.json(page([{ id: String(++calls), slug: 'test-' + calls, name: 'TEST ' + calls }], calls, 2, 1)));
  const result = await api.taxonomy('regions');
  assert.equal(calls, 2);
  assert.deepEqual(result.map(item => item.slug), ['test-1', 'test-2']);
});
test('contact validation matches required fields and length limits', () => {
  assert.deepEqual(validateContact({ senderName: 'TEST', email: 'test@example.com', message: 'Hello' }), {});
  const invalid = validateContact({ senderName: ' ', email: 'invalid', message: 'x'.repeat(2001) });
  assert.deepEqual(Object.keys(invalid), ['senderName', 'email', 'message']);
});
test('contact sends JSON once, without credentials or sensitive data in URL', async () => {
  const input = { senderName: 'TEST', email: 'test@example.com', message: 'Hello' };
  let calls = 0;
  const api = createApi('/api', async (url, init) => {
    calls++;
    assert.equal(url, '/api/contact-messages');
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), input);
    assert.equal(init.headers['Content-Type'], 'application/json');
    return Response.json({ data: { id } }, { status: 201 });
  });
  assert.equal((await api.contact(input)).id, id);
  assert.equal(calls, 1);
});
test('API configuration rejects credential URLs and unsafe protocols', () => {
  for (const base of ['javascript:alert(1)', '//evil.test/api', 'https://user:secret@example.com/api', 'https://example.com/api?token=secret']) {
    assert.throws(() => createApi(base), ApiError);
  }
});
