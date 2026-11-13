# Stage 16 — Verification, availability and public reports

This extends the existing admin sessions, RBAC, CSRF, version checks, pool transactions,
append-only audit log, program forms, Stage 14 matcher and Stage 15 recommendations.
No new authentication system, external source crawler, AI service or dependency exists.
An HTTPS URL is syntax, **not proof of an official or trustworthy source**. Staff must
open the source and verify its ownership and actual terms. No source content is fetched
or automatically certified by the server.

## Lifecycle and permissions

Database/API status `review` continues to represent **PENDING**; the list filter also
accepts `pending` as an alias. Existing four-state records are not rewritten.

| Action | From → to | Authorized staff and requirements |
|---|---|---|
| submit | draft → review | Editor owns draft, or Admin; non-DEMO with source URL/name |
| approve | review → verified | Reviewer/Admin, never author or submitter; all review checks |
| reject | review → rejected | Reviewer on another author's submission, or Admin; reason required |
| reject approval | verified → rejected | Admin only; reason required |
| publish | verified → published | Admin only; confirm, fresh recorded approval, no expiry/recheck flag |
| unpublish | published → draft | Admin only; invalidates current approval |
| archive | any non-archived → archived | Admin only, explicit confirmation; preserves the record |
| reopen | rejected → draft | Owning Editor or Admin |
| reopen archive | archived → draft | Admin only; new review/publication required |
| request-recheck | verified/published → same status | Admin only, reason required; hides public availability |

All mutations require current `version`, Origin/JSON/CSRF, a fresh active staff session,
and authorization **inside** the transaction. Row locks serialize transitions; outdated
versions return 409 and are not automatically retried. Unknown fields such as caller-
supplied status, verifiedAt or actor IDs are rejected. No DELETE endpoint is introduced.

Approval requires `sourceReviewed:true`, `informationReviewed:true`, and
`eligibilityReviewed:true`; optional `notes` is bounded to 1000 characters. Source
URL/name, title, description, taxonomy, regions and age bounds must be present/valid;
expired programs cannot be approved. Completeness of structured matching eligibility
is separate: unsupported/incomplete legal conditions must leave `eligibilityComplete`
false even when the cited information has been reviewed. Such programs remain POSSIBLE
where appropriate, never automatically eligible or officially approved.

Publishing additionally requires an immutable approval record for the **current
verified program version**. A status alone, an older approval or a changed source flag
is insufficient. Approval records snapshot source URL/name, checks, actor, version,
decision time and internal notes. Internal history is visible to staff with programs:read,
including Editors who need rejection feedback; it is never returned by public endpoints.
Staff must not enter passwords, tokens, child facts or personal information in notes.

## APIs and compatibility

All admin paths below are relative to `/api/admin`.

| Method/path | Contract |
|---|---|
| GET `/programs/dashboard` | total, six status counts, expired/recheck counts, 10 recently modified records |
| GET `/programs` | Existing q/status/page/limit plus category, region, verifiedFrom, verifiedTo, expiration, needsReview |
| GET `/programs/:uuid/history` | Paginated immutable verification decisions |
| POST `/programs/:uuid/approve` | version + three literal-true review attestations + optional notes |
| POST `/programs/:uuid/reject` | version + nonempty notes |
| POST `/programs/:uuid/publish` or `/archive` | version + `confirm:true` |
| POST `/programs/:uuid/reopen` | version |
| POST `/programs/:uuid/request-recheck` | version + nonempty notes; Admin publication permission |
| GET `/reports` | Reviewer/Admin only; page/limit/status/programId |
| POST `/reports/:uuid` | Reviewer/Admin; version and target status |
| POST `/api/programs/:uuid/reports` | Anonymous; reason + optional explanation; 202 generic acceptance |

Create/edit adds optional nullable ISO date `expiresOn`; source/provider name reuses
`sourceName`. `sourceNeedsRecheck` is read-only and can only be changed by the guarded
workflow, never PATCH. Existing authentication/public search payloads remain compatible.
**Security-sensitive mutation contracts are deliberately stricter:** old approval calls
with only version, rejection without notes, or publication without confirmation return
400. The current UI sends the new fields; update external staff clients before rollout.

Pagination remains page 1–10000, limit 1–50 (default 20). Date filters are inclusive
Kazakhstan calendar dates; reversed ranges, repeated/unknown query parameters and bad
slugs are rejected. `expiration` is `active` (not past either date) or `expired`;
`needsReview=true` selects flagged or stale verified/published records. Filters combine
with AND. All values use PostgreSQL parameters and q uses escaped literal ILIKE search.

## Expiration and re-verification

Optional `deadline` and `expiresOn` each expire **after** the specified date ends in
`Asia/Almaty`; today remains inclusive. The security-barrier `published_programs` view
returns only published, non-DEMO, unexpired and non-flagged records. Catalog/taxonomy,
details, matching, new saves, saved lists/counts and child recommendations all use this
same view. Direct requests to unavailable UUIDs return the same 404 as unknown UUIDs.
No background worker or automatic renewal/publication is needed or introduced.

`PROGRAM_REVIEW_DAYS` is validated (7–730, default 180) and drives stale-review warnings,
filters and the publication freshness gate. A stale verification date is not itself a
program end date: it appears in the staff recheck queue but does not automatically
unpublish an already published record. Its actual verification date remains visible.
An explicit Admin source-recheck flag **does** hide it, without destroying the record.
Published dashboard counts describe stored status, not necessarily public availability;
the expired/recheck counters and filters explain unavailable published rows.

For a flagged published record: Admin unpublishes → author corrects draft → submits →
independent Reviewer completes the checks → Admin confirms publication. For a flagged
verified record: Admin rejects with reason → owner reopens → resubmits and re-verifies.
Approval clears the flag. Archiving is a separate manual action, never an expiry renewal.

Legacy published rows retain their stored verification and follow the new expiry/manual
flag rules; no history or attestations are invented for them. Legacy verified rows with
no current approval certificate cannot be newly published. Review all legacy content
before a public launch. Local catalog currently has no real published records.

## Anonymous reports and moderation

Reasons: incorrect, outdated, source_broken, other. Explanation is optional, max 1000
characters. The form explicitly asks for no contact/IIN/child/medical details; there are
no reporter accounts, identifiers, IPs or email fields in the report table. Reports are
accepted only for currently public program references; hidden IDs return generic 404.
Strict JSON, existing CORS/Helmet, global limits and an independent 5 submissions per IP
per 15 minutes apply, including invalid submissions. Limits currently use process-local
memory; shared enforcement/ingress abuse monitoring is an operator scaling requirement.

Reports do **not** change a program's status, version, source flag or visibility. They
are allegations requiring staff review. Reviewer/Admin can move open → reviewed →
resolved/dismissed. Admin alone can reopen a resolved/dismissed report as reviewed.
CSRF, fresh role checks, report row locks and versions protect moderation. An audit
failure rolls back report state/version changes. Public clients cannot read reports;
Editors cannot access moderation. Report text is rendered as text, never HTML.

Program creation/update, eligibility changes, source decisions, publishing/unpublishing,
archiving/reopening, recheck flags and report moderation reuse admin_audit_log. Events
contain actor/target/time/permission and applicable old/new program status; report
actions identify the report, which retains its program reference. No notes, explanations,
tokens or child data are copied into audit events. Verification decisions are separately
append-only; runtime UPDATE/DELETE and trigger tampering are denied.

## Migration, deployment and privacy operations

Append-only `011_program_verification.sql` adds two program columns, verification/report
tables and indexes; expands status/audit constraints and replaces the public view with
the unified availability predicate. No existing records or earlier migrations are deleted
or rewritten. Rejected/archived programs may lack current approval; DEMO may be draft or
archived but can never enter review/verification/publication.

Apply 011 with the existing migrator **before** starting this backend. Local URL/host and
actual DB identity are verified against balaqoldau_dev; repeats returned zero migrations.
balaqoldau_db was never accessed. All QA program/account/report/history fixtures roll
back; no government catalog was populated. Roll back application code if needed, retaining
the additive tables and history; do not reverse migrations by dropping data or weakening
the public view. Old clients must not be used to bypass the new review requirements.

An authorized production operator must add narrow runtime permissions:

- programs INSERT/UPDATE expires_on; UPDATE source_needs_recheck only.
- program_verifications SELECT and INSERT only on program_id, actor_id, program_version,
  decision, source_reviewed, information_reviewed, eligibility_reviewed, notes, source_url,
  source_name. No explicit ID/time insertion, UPDATE/DELETE/TRUNCATE/TRIGGER.
- program_reports SELECT; INSERT program_id/reason/explanation; UPDATE only
  status/version/moderated_by/updated_at. No DELETE/TRUNCATE/TRIGGER.

No roles, credentials, production grants or infrastructure were modified. Startup fails
closed if required narrow grants are absent/unsafe. Confirm TLS, restricted runtime role,
backups/restore, monitoring and private-route/body/SQL-parameter log redaction in staging.
Internal notes are for non-sensitive source review only. Anonymous explanations may
contain accidentally submitted personal data despite warnings: define retention, handling
and authorized erasure before launch. No report/history cleanup, scheduling or automatic
privacy-erasure service is implemented or claimed. Contact retention is unchanged.

## QA and manual checks

Backend 143/143, frontend 60/60, rollback-safe dev integration 61/61 (users/children/
matching/verification plus legacy public/admin APIs), two-language browser 89/89, real
admin browser 14/14, real user/child/saved/admin browser 26/26 and public browser 29/29 PASS.
Both builds, lint and TypeScript checks pass; security-policy tests 15/15 and release
source/license/append-only migration/artifact gates pass. Dependencies/lockfiles unchanged:
backend/production audit 0, frontend production 0, existing development-only moderate 10.
Dedicated-test-only no-seed/retention suites were not pointed at dev; their safety guards
remain intact. No full WCAG, production load or live GitHub CI certification is claimed.

```powershell
npm test --prefix backend
npm run build --prefix balaqoldau
npm test --prefix balaqoldau
npm run lint --prefix backend
npm run lint --prefix balaqoldau
npm run typecheck --prefix backend
npm run typecheck --prefix balaqoldau
node --env-file=backend/.env --test --test-concurrency=1 backend/tests/users/*.test.mjs backend/tests/integration/api.test.mjs backend/tests/integration/program-admin.test.mjs
npm run test:localization --prefix balaqoldau
npm run test:admin-browser --prefix balaqoldau
npm run test:user-browser --prefix balaqoldau
$env:BROWSER_BUILD='true'
npm run test:browser --prefix balaqoldau
```

Use normal local servers and existing authorized staff accounts:

- http://localhost:5173/admin/login
- http://localhost:5173/admin/overview?lang=kk (or lang=ru)
- http://localhost:5173/admin/programs?needsReview=true&lang=kk
- http://localhost:5173/admin/reports?lang=ru
- http://localhost:5173/find?lang=kk (anonymous browsing preserved)

Prepare a genuine sourced draft, submit, review using a different staff account, and
confirm publication as Admin. Check history and expiry; archive only after confirmation.
Reporting is available under a currently public program's details. No local public
program currently exists, so use rollback QA fixtures rather than inventing a real entry.
