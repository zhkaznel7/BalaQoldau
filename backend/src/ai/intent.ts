const regions = {
  abay: ['абай', 'абая', 'абай облысында', 'области абай'],
  akmola: ['ақмола', 'акмолинская', 'акмолинской'],
  aktobe: ['ақтөбе', 'ақтөбеде', 'актобе', 'актюбинская', 'актюбинской'],
  'almaty-region': ['алматы облысы', 'алматы облысында', 'алматинская область', 'алматинской области'],
  atyrau: ['атырау', 'атырауская'],
  'west-kazakhstan': ['батыс қазақстан', 'западно казахстанская'],
  zhambyl: ['жамбыл', 'жамбылская'],
  zhetisu: ['жетісу', 'жетысу'],
  karaganda: ['қарағанды', 'қарағандыда', 'караганда', 'караганде', 'карагандинская', 'карагандинской'],
  kostanay: ['қостанай', 'қостанайда', 'костанай', 'костанае', 'костанайская', 'костанайской'],
  kyzylorda: ['қызылорда', 'қызылордада', 'кызылорда', 'кызылорде', 'кызылординская', 'кызылординской'],
  mangystau: ['маңғыстау', 'мангистауская'],
  pavlodar: ['павлодар', 'павлодарская'],
  'north-kazakhstan': ['солтүстік қазақстан', 'северо казахстанская'],
  turkistan: ['түркістан', 'туркестан', 'туркестанская'],
  ulytau: ['ұлытау', 'улытау'],
  'east-kazakhstan': ['шығыс қазақстан', 'восточно казахстанская'],
  astana: ['астана', 'астане', 'астанада'],
  'almaty-city': ['алматы', 'алматыда'],
  shymkent: ['шымкент', 'шымкентте', 'шымкенте'],
} as const;

const needs = {
  'education-support': /^(?:оқу|оқуға|білім|репетитор[а-я]*|урок[а-я]*|уч[её]б[а-я]*|обучени[а-я]*)$/u,
  'creative-development': /^(?:шығармашылық|сурет|рисовани[а-я]*|рисовань[а-я]*|творчеств[а-я]*|музык[а-я]*|ән)$/u,
  'sports-activities': /^(?:спорт[а-я]*|футбол[а-я]*|жүзу|плавани[а-я]*|секци[а-я]*)$/u,
} as const;
const categories = {
  benefits: /^(?:жәрдемақы[а-яәіңғүұқөһ]*|пособи[а-я]*)$/u,
  'free-courses': /^курс(?:ы|ов|ах|ами|қа|тар(?:ы|ын|ға|ды|да)?)?$/u,
  grants: /^(?:грант[а-яәіңғүұқөһ]*)$/u,
  clubs: /^(?:үйірме[а-яәіңғүұқөһ]*|круж(?:ок|к[а-я]+))$/u,
} as const;

export type Intent = {
  age: number | null;
  region: keyof typeof regions | null;
  need: keyof typeof needs | null;
  category: keyof typeof categories | null;
};

export const clarification: Intent = {age: null, region: null, need: null, category: null};
const regionAliases = new Map<string, keyof typeof regions>(
  (Object.keys(regions) as (keyof typeof regions)[]).flatMap(region =>
    regions[region].map(alias => [alias, region] as const)),
);
const yearUnits = new Set(['жас', 'жаста', 'жастағы', 'жасында', 'жасқа', 'жастан', 'лет', 'год', 'года']);
const ageModifiers = new Set(['до', 'от', 'старше', 'младше', 'около', 'более', 'менее']);
const exclusions = new Set(['не', 'без', 'емес', 'жоқ', 'кроме']);
const conjunctions = new Set(['или', 'и', 'немесе', 'және']);

function readAge(words: string[], index: number): number | undefined {
  const word = words[index]!;
  const next = words[index + 1];
  if (word === 'до' && (next === 'года' || ((next === '1' || next === 'одного') && words[index + 2] === 'года'))) return 0;
  if (word === '1' && next === 'жасқа' && words[index + 2] === 'дейін') return 0;
  if (!next || !yearUnits.has(next) || !/^[+−-]?\d/u.test(word)) return undefined;
  if (word === '1' && words[index - 1] === 'до' && next === 'года') return 0;
  const previous = words[index - 1] ?? '';
  if (ageModifiers.has(previous) || next === 'жастан' || ['дейін', 'бастап', 'асқан'].includes(words[index + 2] ?? '') ||
      (conjunctions.has(previous) && /^\d+$/u.test(words[index - 2] ?? ''))) return NaN;
  return /^(?:[0-9]|1[0-7])$/u.test(word) ? Number(word) : NaN;
}

function labelFor<K extends string>(labels: Record<K, RegExp>, word: string): K | undefined {
  return (Object.keys(labels) as K[]).find(key => labels[key].test(word));
}

export function parseIntentRules(query: string): Intent | null {
  const words = query.normalize('NFC').toLowerCase()
    .replace(/\S+@\S+|(?:https?:\/\/|www\.)\S+/gu, ' ')
    .replace(/(\d)\s*([-–—])\s*(?=\d)/gu, '$1$2')
    .match(/[\p{L}\p{M}]+|[+−-]?\d+(?:[.,/–—:-]\d+)*/gu) ?? [];
  const ages = new Set<number>();
  const locations = new Set<keyof typeof regions>();
  const support = new Set<keyof typeof needs>();
  const types = new Set<keyof typeof categories>();

  for (let index = 0; index < words.length; index++) {
    const word = words[index]!;
    const phrase = regionAliases.get(word + ' ' + words[index + 1]);
    const region = phrase ?? regionAliases.get(word);
    const age = readAge(words, index);
    const need = labelFor(needs, word);
    const category = labelFor(categories, word);
    const following = index + (phrase || age !== undefined ? 2 : 1);
    if ((region || age !== undefined || need || category) &&
        (exclusions.has(words[index - 1] ?? '') || ['емес', 'жоқ'].includes(words[following] ?? ''))) {
      return null;
    }
    if (age !== undefined) ages.add(age);
    if (region) locations.add(region);
    if (need) support.add(need);
    if (category) types.add(category);
    if (phrase) index++;
  }

  const birth = /(?:^| )(?:бала туған(?:да|нан)|бала дүниеге келгенде|при рождени[иия] (?:ребенка|ребёнка)|на рождени[еи] (?:ребенка|ребёнка))(?: |$)/u;
  if (types.has('benefits') && birth.test(words.join(' '))) ages.add(0);
  if (ages.has(NaN) || ages.size > 1 || locations.size > 1 || support.size > 1 || types.size > 1) {
    return null;
  }
  return {
    age: ages.values().next().value ?? null,
    region: locations.values().next().value ?? null,
    need: support.values().next().value ?? null,
    category: types.values().next().value ?? null,
  };
}

export function hasUnresolvedCategoryConstraint(query: string): boolean {
  const words = query.normalize('NFC').toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? [];
  return /(?:^| )(?:или|немесе|кроме|вместо|емес|не (?:хочу|нужен|нужна|нужно|нужны|интересуют))(?: |$)/u.test(words.join(' '));
}

export function extractIntent(query: string): Intent {
  return parseIntentRules(query) ?? clarification;
}
