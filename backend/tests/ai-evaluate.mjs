import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractIntent} from '../dist/ai/intent.js';

const questions = JSON.parse(await readFile(new URL('./ai-evaluation.json', import.meta.url), 'utf8'));
for (const {query, expected} of questions) {
  assert.deepEqual(extractIntent(query), expected, query);
}
console.log(`Deterministic intent: ${questions.length}/${questions.length} cases passed.`);
