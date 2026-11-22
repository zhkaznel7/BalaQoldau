import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {labels} from '../src/ai/category-features.ts';

export function loadDataset() {
  const families = new Set();
  const queries = new Set();
  const lines = readFileSync(new URL('./ai-intent-dataset.txt', import.meta.url), 'utf8').trim().split(/\r?\n/);
  return lines.filter(line => !line.startsWith('#')).flatMap(line => {
    const [split, family, language, label, style, examples] = line.split('|');
    assert.ok(['train', 'eval'].includes(split) && family && ['kk', 'ru'].includes(language) &&
      labels.includes(label) && ['direct', 'indirect'].includes(style) && examples, line);
    assert.ok(!families.has(family), 'Duplicate family: ' + family);
    families.add(family);
    return examples.split('~').map(query => {
      const normalized = query.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      assert.ok(normalized && !queries.has(normalized), 'Duplicate or empty query: ' + query);
      queries.add(normalized);
      return {split, family, language, label, style, query};
    });
  });
}
