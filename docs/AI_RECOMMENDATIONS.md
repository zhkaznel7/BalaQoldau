# BalaQoldau catalog assistant

The assistant on `/ai-assistant?lang=kk` and `/ai-assistant?lang=ru` searches the PostgreSQL
catalog using a supervised Kazakh and Russian category classifier. Model v1 uses hashed
character 3–5-grams and L2-regularized multinomial logistic regression. Node loads the
versioned weights once and runs inference locally on the backend CPU. Deploy the complete
backend `dist` directory, including `dist/ai/category-model.json`. The assistant needs
the normal database connection. It has no model API key or external inference service.

## Supported questions

- Астанада 2 жастағы балаға қандай көмек бар?
- Бала туғанда қандай жәрдемақы беріледі?
- Алматыда тегін үйірмелер бар ма?
- Какие пособия доступны для ребенка до года?
- Государство перечисляет деньги семье новорождённого?

The assistant recognizes an age in completed years, common names of Kazakhstan
regions, benefits, free courses, grants, clubs, and basic education, creative,
and sports needs. Birth and under-one cues map to age zero. Birth benefit
questions search the benefits category for age zero. The catalog taxonomy does
not classify birth-benefit subtypes or club fees. The chat points users to the
official source for club costs.

The browser keeps the current search criteria in memory for follow-up replies.
The assistant asks for one missing field at a time and accepts a whole number
when the parent gives the age. Starting a new search clears the context.
Explicit category cues take precedence over model scores. Explicit sports or
creative requests search clubs, with activity tags required for those requests.
For indirect queries the model score must reach 0.45 with a lead of at least
0.12 over the next class. Conflicts, exclusions and unsupported or uncertain
answers prompt clarification. Rules remain available if inference fails.

## Public contract

`POST /api/ai/recommendations` accepts JSON `{"query":"...","consent":true}`
with a nonblank question up to 400 characters and no query-string parameters.
Send `context: null` to start a conversation or send the previous normalized
`intent` object to continue. The nullable fields are `age`, `region`, `need`,
and `category`. Conversation responses add `followUp`, which is `category`,
`region`, `age`, `clarify`, or `null` for a completed search. An empty completed
search offers a link to browse that category. A missing database connection
returns `503 AI_UNAVAILABLE` when the request is ready to search.
The `X-Recommendation-Mode` header reports `explicit`, `model`, `clarification`, or
`rules-fallback`.

`GET /api/ai/suggestions` returns up to one age and region pair per category
from currently published, source-verified records inside the same freshness
window. The browser formats the prompt in the selected language. If the
catalog yields no suggestions, generic category questions are offered.

The existing public view excludes unpublished records, DEMO data, expired
programs, and sources flagged for recheck. The assistant additionally requires
source metadata and verification inside the existing `PROGRAM_REVIEW_DAYS`
window. Requested category and known age, region and club activity constraints
filter candidates before ranking up to five results.
`MATCH` means the submitted criteria satisfy the recorded requirements.
`POSSIBLE` indicates missing details or incomplete eligibility rules. The
program detail and official source links resolve from the catalog. Benefits
remain possible matches pending confirmation of the full official requirements.

The endpoint is anonymous and limited to six POSTs per IP per minute per
process. It accepts opt-in, sets `Cache-Control: no-store`, and passes only
recognized filters to PostgreSQL. The application does not persist questions or
read user profiles. Proxy and APM logging should omit request bodies.

## Catalog translations

Russian titles and descriptions are editorial presentation records in
`backend/src/api/program-translations.ts`. A translation is served only when the
published program's slug and the SHA-256 of `JSON.stringify([title, description])`
match its record. The API preserves original fields, official names and links.
The frontend shows the original with a translation notice when a Russian record
is missing or out of date. Updating presentation text requires bilingual source
review. Changes to original program facts or eligibility use the existing admin
workflow. The translation registry has no write access to PostgreSQL and needs
no database migration.

## Verification

Run from the repository root with a dedicated `TEST_DATABASE_URL` in
`backend/.env` or the environment. The database integration tests apply
existing migrations and roll back the assistant test records.

```powershell
node backend/scripts/train-intent.mjs
npm.cmd run build --prefix backend
node backend/tests/ai-evaluate.mjs
node backend/tests/ai-model-evaluate.mjs
node --env-file-if-exists=backend/.env --test backend/tests/integration/ai-recommendations.test.mjs
npm.cmd run build --prefix balaqoldau
npm.cmd run test:localization --prefix balaqoldau
```

The training script uses only the train rows in `backend/tests/ai-intent-dataset.txt`.
The fixture contains authored, synthetic questions, including typos and code-switching.
The evaluation compares the deployed decision path with the unchanged rules baseline
on a separate set of paraphrase families. It reports macro-F1 over the four catalog
categories, indirect-query accuracy, clarification and fallback counts, and warmed
intent-processing latency. These measurements do not measure catalog recall or the
performance of the full HTTP and PostgreSQL path.

For manual acceptance, use the application's test or development catalog with
published, recently verified records and try the example questions in both
languages. Check the returned source and detail links, an ambiguous question,
and the manual search link.
