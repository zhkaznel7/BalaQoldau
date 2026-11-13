# Stage 14 — Explainable search and matching

## Scope and evidence

Anonymous browsing remains public. No child profile, date of birth, income, medical
information or account details are requested or read for matching. Age (integer 0–17),
region slug and optional family/support category slug are transient query inputs.
They are visible in the URL/browser history, are not written to the user profile or
database, and must not be included in access/analytics logs. Configure ingress logs
to omit query strings; retain Helmet's no-referrer policy. Never enter personal data
in keyword search. Program/source names and legal text remain in their source language.

Existing structured data: age_min/age_max, region relations, family-category relations,
category, deadline, source URL/name and verification timestamp. There are no verified
income, citizenship, disability, residence-duration or document rules. City discovery
is supported only if a city is already a verified entry in the region taxonomy; no
geocoding, city inference or new official taxonomy is invented.

Migration `009_program_eligibility.sql` adds `eligibility_complete boolean NOT NULL
DEFAULT false` and appends it to the existing security-barrier public view. No previous
record is certified, overwritten or auto-published. All old migrations remain unchanged.

## Human review prerequisite

Editor/Admin can mark completeness only while editing a draft through the existing
CSRF/version/RBAC-protected API and checkbox. It means **every eligibility condition**
in the cited source is faithfully represented by the existing age, region, family
category and deadline fields. If there are any unsupported conditions or uncertain
values, leave it false. Verify even the default 0–17 age range against the source.
A null deadline means no deadline restriction only when this review is complete.
An empty family-category list means unrestricted only under the same explicit review.
An empty region list never means nationwide; it remains insufficient information.

Reviewer approval (never author/submitter), then Admin publication are still required.
Draft edits invalidate approval; unpublishing removes public visibility. Existing audit
events, transaction boundaries, version conflicts and role permissions are preserved.
Completeness is an editorial assertion, not government certification or automated
source verification. Unsupported complex rules must not be marked complete.

## Deterministic rules

`backend/src/matching/engine.ts` owns the rules; UI components only render returned
codes. `matching/repository.ts` mirrors ranking in parameterized SQL **before** LIMIT /
OFFSET. Database tests compare SQL order with the pure comparator for missing inputs,
inclusive boundaries, incompatible criteria and ties.

1. Incomplete/unverified source requirements, missing regions or invalid age rules:
   `POSSIBLE`, `RULES_UNVERIFIED`. Publication/default fields alone prove nothing.
2. For fully reviewed requirements, compare inclusive age, exact region membership and
   family category (OR within the program's listed categories). Omitted required input
   is unknown; it is never a failed condition.
3. A deadline earlier than today's date in `Asia/Almaty` has passed. Today is inclusive.
4. Any verified failed condition → `NOT_MATCH`; otherwise any missing required input →
   `POSSIBLE`; otherwise → `MATCH`. Missing information does not hide a verified failure.
5. A MATCH is only a comparison with recorded requirements, **not official approval**.
   Every result links its existing source and explains satisfied/failed/missing checks.

Ordering is lexicographic: MATCH, POSSIBLE, NOT_MATCH; selected need relevance; region
compatibility; age compatibility; unexpired/no-restriction deadline; UUID ascending.
No confidence scores or percentages are generated. Only published, non-DEMO records
enter the query. Unpublished/nonexistent details return the same 404 response.

## API contract and filtering modes

| Endpoint | Contract |
|---|---|
| `GET /api/programs` | Existing hard category/region/age/keyword filters unchanged |
| `GET /api/program-matches` | Category/keyword narrow candidates; age/region/need compare and rank, including explained mismatches |
| `GET /api/program-matches/:uuid` | Compare one public program with optional age/region/need |
| `GET /api/family-categories` | Existing taxonomy entries linked to published non-DEMO programs, paginated |

Matching list parameters: `category`, `q` (trimmed max 200), `age` (0–17), `region`,
`need`, `page` (1–10000), `limit` (1–50, default 20). Slugs use the existing strict
ASCII slug validation (max 80). Detail accepts **only** age/region/need. Duplicates,
arrays, unknown fields and invalid route IDs return generic 400. q is literal escaped
ILIKE text; all values are PostgreSQL parameters. Results use the existing
`{data,pagination}` envelope; detail `{data}`. Each result adds:

```json
{"matching":{"status":"POSSIBLE","checks":[{"code":"RULES_UNVERIFIED","result":"missing"}]}}
```

Checks use an allowlisted code and `satisfied`, `not_satisfied` or `missing`. The frontend
validates this contract and maps codes to KZ/RU messages; it never renders backend error
details. Responses are no-store. Existing API rate limits and pool/statement timeouts
apply. The UI's `matching=1` selects comparison mode; it is not sent to the backend.
The distinction from hard filtering is explicitly explained in the UI. Category and
keyword combine with AND in both modes. Detail links carry only comparison inputs,
not keyword searches or account identifiers. Filters/reset/pagination remain URL based.

## Deployment and local verification

Build backend, verify the exact development database identity, then run the existing
migration command. This task applied 009 only to verified local `balaqoldau_dev`;
repeat migration returned zero. Never target `balaqoldau_db`. No credentials, roles or
grants were changed. Test catalog/account fixtures are transactionally rolled back.

Before enabling this version in a separate production environment, an authorized
operator must append `eligibility_complete` to the admin runtime's existing column
INSERT/UPDATE grants. The startup least-privilege check now requires those two column
permissions and still rejects broader privileges. Public runtime reads the existing
published view and taxonomy relations only. Do not automatically grant privileges.
Apply 009 before starting the new backend; an older backend can ignore the added
column, so rollback application code without deleting the column/view history.

```powershell
# Separate terminals; restart any old backend process to load the new API.
cd backend
npm run dev
# From project root in another terminal:
cd balaqoldau
npm run dev
```

Manual URLs with the normal local ports:

- http://localhost:5173/find?lang=kk
- http://localhost:5173/find?lang=ru
- http://localhost:5173/results?matching=1&age=6&lang=kk
- http://localhost:5173/program/ACTUAL_PUBLISHED_UUID?age=6&region=ACTUAL_REGION_SLUG&lang=ru
- http://localhost:5173/admin/programs (existing authorized staff session required)

There are currently **zero published/verified programs** locally, so an honest empty
catalog is expected. Do not insert invented benefits to demonstrate matching. Automated
tests exercise MATCH/POSSIBLE/NOT_MATCH with isolated TEST fixtures only.

Verification: frontend 52/52, backend 136/136, dev rollback integration 29/29,
localization/search browser 61/61, existing browser 29/29, release-policy 15/15 PASS.
Both TypeScript checks, lint and builds passed. Production-volume load testing and
manual screen-reader testing are not claimed. Large catalog ILIKE/candidate-ranking
performance needs measurement before scaling; no heavy search dependency was added.
