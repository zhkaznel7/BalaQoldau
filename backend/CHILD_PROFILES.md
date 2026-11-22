# Stage 15 — Child profiles and private recommendations

Parent-managed, optional profiles reuse regular-user sessions, CSRF and the Stage 14
matching engine. Admin accounts/RBAC and public browsing are unchanged. No profile is
created automatically. Routes use `/api/auth/children` to retain the existing cookie
scope and authentication middleware; there is no duplicate authentication system.

## API

All routes require an active regular-user session and return no-store responses.
Mutations require the existing exact Origin, JSON content type and X-CSRF-Token.
Never send a user ID: every SQL statement derives ownership from a fresh active
session. A different parent's ID and an unknown child ID both return generic 404.

| Endpoint | Result |
|---|---|
| `GET /api/auth/children` | `{data: Child[]}`, at most 20, stable creation/UUID order |
| `GET /api/auth/children/options` | `{data:{regions,categories}}`, existing taxonomy slug/name only |
| `POST /api/auth/children` | 201 `{data: Child}` |
| `GET /api/auth/children/:uuid` | 200 `{data: Child}` or generic 404 |
| `PATCH /api/auth/children/:uuid` | 200 `{data: Child}`, complete editable-field replacement with version |
| `DELETE /api/auth/children/:uuid` | Requires `{version,confirm:true}`; 204 |
| `GET /api/auth/children/:uuid/recommendations?page=1&limit=20` | Existing program/pagination envelope with matching reasons |

Create body: optional `nickname` (null/omitted means none), required `age`, required
`region` slug, optional `preferences` array of **program category** slugs (default []).
PATCH requires nickname/age/region/preferences plus current version; omission is rejected
instead of silently resetting previously stored optional fields. Responses contain only
id, nickname, age, region, preferences, familyContext, fullName, gender, interests and version,
never parent IDs or account details. Stage 18 optional attributes are described below.

- Age: completed years, integer 0–17. No birth date or automatic birthday inference.
- Nickname: NFC, trimmed/collapsed spaces, max 30 Unicode characters; letters/marks,
  numbers, spaces, dot, underscore and hyphen. Control characters, typical email/URL
  punctuation and long digit sequences are rejected. This cannot determine whether a
  parent has entered a legal name; UI explicitly instructs parents to use a nickname.
- Region: existing taxonomy row, mandatory; city only if already represented there.
- Preferences: 0–10 unique, existing program category slugs; max 80 characters each.
  Optional neutral support needs remain in the existing private familyContext.
  Diagnoses/documents and arbitrary support-needs text are not collected; no medical eligibility is inferred.
- 20 profiles per account. A DB slot check and unique owner/slot key enforce the limit
  even during concurrent inserts. A slot collision safely returns CHILD_LIMIT/409;
  refresh before deciding whether to retry. Mutations are never automatically retried.
- Revision conflicts return CHILD_CONFLICT/409. Invalid input/taxonomy returns 400,
  missing/expired sessions 401, CSRF failures 403; errors never echo child data.
- Recommendation pagination: page 1–10000, limit 1–50. Other queries are strict/empty;
  callers cannot override stored child facts through query parameters.
- Options fail safely above 1000 rows per kind rather than silently truncating.

## Matching and privacy

Recommendations use the selected child's stored age and region. Selected program
categories form an OR candidate filter; none selected means all published categories.
The existing deterministic engine/ranking remains authoritative. No recommendation
results are stored. Unknown requirements remain POSSIBLE, including requirements for
family status: category interests never imply that a family satisfies such conditions.
Only published, non-DEMO programs are returned. The parent still receives satisfied,
failed and missing-information explanations and the existing official-source links.
This is not government approval or a formal eligibility decision.

Ownership/session and child revision are checked before and after matching. A changed
profile produces a conflict; a removed profile/session cannot receive a stale result.
The UI keeps selection and forms in memory, scoped to the authenticated account.
Logout/expiry removes private content. Language changes preserve drafts without
reloading or adding another language switcher. Child facts are not put in the public
search URL or localStorage. Opening public program details does not transfer child
facts: the private recommendation explanation stays on the children page.

Do not collect IIN, document numbers, legal names, exact addresses, birth dates,
diagnoses, disability status or other sensitive child information. Do not log bodies,
nicknames, session credentials, profile IDs, SQL bind values or recommendation inputs.
Before launch, verify ingress/APM/analytics use route templates instead of private UUID
paths and disable request/response body capture on these endpoints. Application errors
are generic; external infrastructure logging has not been certified by this task.

Age is a manually maintained snapshot. The UI asks parents to update completed age;
without a birth date there is intentionally no automatic aging or expiry calculation.

## Storage, deletion and production permissions

Additive migration `010_child_profiles.sql` creates child_profiles and child_preferences.
FKs bind a child to one user and existing region; preference FKs reference existing
categories. Owner/slot uniqueness indexes owner lookup; region/category reverse indexes
support FK operations. User account deletion cascades to children; deleting one child
cascades only its preferences. Region/category deletion is restricted while referenced.
No existing account, admin, program, migration or saved-program record is rewritten.

DELETE is limited by authenticated owner, exact child UUID, current version and explicit
confirmation. UI provides confirmation/cancellation and focus handling. A deletion
removes live child/preference rows, not parent accounts or saved programs. No soft-delete
copy or recommendation history is retained. Profiles otherwise remain until their
parent deletes them or an authorized account-erasure process removes the account.
No automatic retention/inactivity deletion job is claimed or added. Before public launch,
publish the chosen inactivity policy and backup retention period. Deleted data may exist
in retained backups; restored backups require an authorized erasure reconciliation
procedure without exporting child facts to logs. No production backup was accessed.

An authorized production operator must grant only:

- SELECT/DELETE on child_profiles and child_preferences.
- INSERT on child_profiles(user_id,slot,nickname,age,region_id).
- UPDATE on child_profiles(nickname,age,region_id,version,updated_at).
- INSERT on child_preferences(child_id,category_id); no UPDATE privilege.
- Existing region/category SELECT and matching/public-view reads remain necessary.

No INSERT of IDs/timestamps/revisions, no ownership/slot UPDATE, no TRUNCATE/TRIGGER,
no owner/superuser credentials. The production safety check requires these narrow
permissions and fails closed without them. This implementation changes **no roles,
credentials or grants**. Apply 010 using the separate migration owner before starting
the new backend; an older application can ignore these additive tables. Never roll
back by dropping tables or deleting user data.

## Local safety and verification

Only local balaqoldau_dev was used. URL host/database and actual current_database()
are verified before migration, never inferred or silently replaced. Migration 010 was
applied once; repeats returned zero. Tests use only synthetic rows inside rollback
transactions. balaqoldau_db was never accessed; no real profiles were created for QA.

```powershell
npm run build --prefix backend
npm test --prefix backend
npm run test:user-db --prefix backend
npm run lint --prefix backend
npm run typecheck --prefix backend
npm test --prefix balaqoldau
npm run lint --prefix balaqoldau
npm run typecheck --prefix balaqoldau
npm run build --prefix balaqoldau
npm run test:localization --prefix balaqoldau
npm run test:user-browser --prefix balaqoldau
$env:BROWSER_BUILD='true'
npm run test:browser --prefix balaqoldau
```

With normal local dev servers running:

- http://localhost:5173/profile/children?lang=kk
- http://localhost:5173/profile/children?lang=ru
- http://localhost:5173/profile?lang=kk
- http://localhost:5173/login?returnTo=%2Fprofile%2Fchildren&lang=kk
- http://localhost:5173/find?lang=kk (anonymous search unchanged)

Log in, create a nickname/age/region profile, optionally select categories, save and
refresh, edit, open recommendations, then cancel and confirm deletion. An empty
recommendation list is expected while there are no real published programs. Never
invent catalog entries to make a demonstration look populated.

## Changed modules

- Backend: migration 010; `src/users/children-{schemas,repository,routes}.ts`,
  `src/users/routes.ts`, `src/users/database-security.ts`, `src/matching/repository.ts`.
- Frontend: `src/account/ChildrenPage.tsx`, `children.ts`, `children.css`,
  `ProfilePage.tsx`, `api.ts`, `translations.ts`, `src/i18n/kk.ts` and `ru.ts`.
- Tests: backend `tests/children.test.mjs`, `tests/users/children.test.mjs`; frontend
  `tests/children.test.mjs`, `tests/localization-browser.mjs`, `tests/user-browser.mjs`.
- Documentation: repository/frontend/backend README files, USER_AUTH.md,
  USER_PROFILE.md, this runbook, docs/SECURITY.md, DEPLOYMENT.md, LOCALIZATION.md,
  MATCHING.md and PROGRESS.md. No dependency, environment, credential or asset changes.

Verified: backend 139/139, frontend 56/56, dev rollback integration 37/37, KZ/RU browser
71/71, actual frontend/backend/DB browser 26/26 and public regression browser 29/29 PASS.
Both lint/TypeScript/build checks and release source/asset/append-only migration and
artifact gates PASS; security-policy tests 15/15. Dependency audit: backend 0 findings,
frontend production 0; 10 existing frontend development-only moderate findings remain.
No full WCAG, production permissions, infrastructure privacy or load-test certification
is claimed. pg emits pgpass and single-client test-harness concurrency deprecation
warnings for a future pg@9 upgrade; dependencies are unchanged.

Private child familyContext optionally stores disabilitySupportEligible and supportNeeds only; household flags/count belong to the parent. Owner/session/CSRF/version rules remain. One explicitly selected neutral support need reuses the existing source-verified single-need matcher; absent/multiple selections remain unknown for that predicate. No disability/household-status rule is inferred. JSON context never enters public URLs, session summaries, admin audit payloads or public APIs; null clears it and omitted updates preserve it.

## Stage 18 — optional enhanced details

Migration `018_enhanced_child_profiles.sql` adds private `full_name` (nullable varchar(100)), `gender` (nullable female/male), and `interests` (default empty array). Existing rows, sessions, users, admins and programs are preserved. Apply only through the verified development migration helper; no resets or role changes. Production operators must extend existing child_profiles column-level INSERT/UPDATE allowlists with `(full_name,gender,interests)`; the fail-closed runtime permission check expects these columns, without broadening other privileges.

Existing create/update routes additionally accept `fullName`, `gender`, `interests`. All are optional; omitted edits preserve them, explicit null clears name/gender and [] clears interests. Full name: NFC, trimmed/collapsed spaces, 100 Unicode characters, letters/marks/spaces/apostrophes/dot/hyphen only; no numbers or controls. Gender may be omitted; it is not an eligibility rule. Interests are unique bounded choices `education`, `creativity`, `sports`, localized in the existing KZ/RU dictionaries. Existing familyContext.supportNeeds remains the single support-needs storage; no duplicate field or sensitive free-text field.

Details and edit forms show full name, gender, interests, age, nickname, localized region/categories, existing support needs and optional family context. Only the owning regular-user session can read/change them; no admin or public child API is added. Name/gender never enter logs, audit payloads, recommendation requests/results or public URLs. Use only a nickname if preferred. IIN, diagnosis, birth date and documents remain unsupported. The frontend does not persist child details in browser storage.

Interests map solely to existing program tags: education→education-support, creativity→creative-development, sports→sports-activities. They break ranking ties in the existing PostgreSQL matching query before pagination; they do not filter programs or establish eligibility. Explicit support needs continue through the existing verified-rule matcher. Missing information stays POSSIBLE. Name and gender are never used in matching. Anonymous public search keeps its original behavior.

Manual UI: `/profile/children?lang=kk` and `/profile/children?lang=ru`. Automated tests use rollback-only synthetic fixtures; no real child records are created or overwritten by QA.
