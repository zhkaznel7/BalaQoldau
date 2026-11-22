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

Each question is independent. Age, region and existing eligibility-related filters
come from rules. The model selects a category from an allowlist, or a general
intent that can use existing structured criteria. The top score must be at least
0.45 and its lead over the next class at least 0.12. Conflicts, exclusions,
unsupported age ranges, low scores, and model disagreement with an explicit
category cue trigger clarification. If weights are unavailable or inference
fails, the assistant uses the rules parser. The manual filters remain available.

## Public contract

`POST /api/ai/recommendations` accepts JSON `{"query":"...","consent":true}`
with a nonblank question up to 400 characters and no query-string parameters.
The response contains `{intent, data}`. The nullable fields of `intent` are
`age`, `region`, `need`, and `category`. An all-null intent asks for
clarification. A recognized intent with empty data means there are no matching
catalog results. A missing database connection returns `503 AI_UNAVAILABLE`.
The `X-Recommendation-Mode` response header reports `model`, `clarification`, or
`rules-fallback` for demo and operational verification without exposing the question.

The existing public view excludes unpublished records, DEMO data, expired
programs, and sources flagged for recheck. The assistant additionally requires
source metadata and verification inside the existing `PROGRAM_REVIEW_DAYS`
window. The existing matcher ranks up to five eligible or possible programs.
`MATCH` means the submitted criteria satisfy the recorded requirements.
`POSSIBLE` indicates missing details or incomplete eligibility rules. The
program detail and official source links resolve from the catalog.

The endpoint is anonymous and limited to six POSTs per IP per minute per
process. It accepts opt-in, sets `Cache-Control: no-store`, and passes only
recognized filters to PostgreSQL. The application does not persist questions or
read user profiles. Proxy and APM logging should omit request bodies.

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
