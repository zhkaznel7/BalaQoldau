# Stage 10.1 — Admin program API

Stage 16 extends this contract with six states, explicit source attestations, archive/reopen/recheck, history, dashboard, date/category/region filters and report moderation. [Current authoritative workflow, fields, endpoints and runtime grants](VERIFICATION.md). The migration 006 grant list below is historical: also apply migrations 009 and 011 and the documented column-level grants.

Stage 14 adds optional draft field `eligibilityComplete` (boolean, default false for
new/legacy rows). It is readable on admin programs, editable with the same draft-only
RBAC, CSRF and version protection, and takes effect for public matching only after
the existing review/approval/publication workflow. No permissions or transitions were
relaxed. Apply additive migration 009 first. Production operators must explicitly add
this column to the existing column-level INSERT and UPDATE grants; no local grants
were modified. [Matching API, review checklist and limitations](../docs/MATCHING.md).

Same-origin `/api/admin` authentication/CSRF/cookie/limits from Stages 9 apply unchanged.
No registration or parent accounts. Stage 10.2 frontend uses this API; no DELETE endpoint.

| Endpoint | Permission / behavior |
|---|---|
| GET /programs?page=1&limit=20&status=review&q=keyword | All known admin roles; status/search optional, limit 1–50, page 1–10000 |
| GET /programs/taxonomy | All known admin roles; categories/regions/familyCategories slug+name, including unused taxonomy |
| POST /programs | Editor/Admin; creates draft owned by authenticated actor, 201 |
| GET /programs/:uuid | All known admin roles; 200 or 404 |
| PATCH /programs/:uuid | Editor: own draft only; Admin: any draft; requires version |
| POST /programs/:uuid/submit | Editor: own draft; Admin: any draft; requires version |
| POST /programs/:uuid/approve | Reviewer/Admin, never author or submitter; requires version and three explicit review attestations |
| POST /programs/:uuid/reject | Reviewer: another author's review; Admin: review/verified record to rejected; notes required |
| POST /programs/:uuid/publish | Admin only; verified → published |
| POST /programs/:uuid/unpublish | Admin only; published → draft, invalidates approval |

The table uses paths relative to `/api/admin`. Mutation bodies are strict JSON and require
exact Origin plus session-bound X-CSRF-Token. Authenticated reads may see private/draft/DEMO
records; public endpoints use the security-barrier `published_programs` view: published, non-DEMO, unexpired and not flagged for source rechecking.

Stage 10.2 read extensions: q (trimmed 1–200 characters) searches title/description/slug;
SQL wildcards/backslashes are literal escaped parameters, not expressions. Taxonomy endpoint
returns complete arrays up to 1000 per kind; it fails safely rather than silently truncating
larger catalogs. Both go through fresh session/RBAC checks and existing program transactions.
No mutation or public API permissions were relaxed; no new migration is needed.

Create fields: `slug`, existing category slug `category`, `title`, `description` required.
Optional: `sourceUrl`, `sourceName`, `applyUrl`, `ageMin` (0), `ageMax` (17), `deadline`
(ISO calendar date/null), `regions` and `familyCategories` (unique existing slugs, max 50),
`isDemo` (false). URLs HTTPS, credential-free, <=2048 characters; title <=240,
description <=10000; eligible ages 0–17 with min<=max. No source URL is fetched by this API.
Taxonomy management is outside this stage; use existing taxonomy entries.

PATCH accepts only mutable create fields (never `isDemo`) plus required integer `version`.
At least one content field is required. Null clears nullable URLs/sourceName/deadline;
empty arrays clear associations. Status, ownership, review timestamps, IDs and version
increments are server-controlled. Client fields such as role/verifiedAt/createdBy/status
are rejected. Partial age updates are checked against the stored remaining bound.
Program JSON returns camelCase fields, status/version, actor UUIDs, timestamps and slug arrays.
List uses `{data,pagination:{page,limit,total,totalPages}}`; other successes use `{data}`.

Stage 16 action bodies require `{version}` plus action-specific safeguards: approval needs three review attestations, rejection/recheck needs notes, and publish/archive needs `confirm:true`. Submit/unpublish/reopen still accept only version. Approval maps to the existing `verified`
status (not a new public state). Submit requires non-DEMO and source URL/name. Reviewer
approval explicitly represents a human source/eligibility/deadline check, not automatic
government verification. Server supplies verifiedAt only on approval. Publishing requires
recorded reviewer provenance; legacy verified records without it must be returned to draft
via Admin reject, explicit reopen and independent review again. No fabricated official sources/programs are seeded.

Draft edits clear previous submission/approval metadata. Records under review, verified or
published cannot be patched: reject then reopen, or unpublish first. Every successful mutation increments
version; stale revisions and invalid transitions return 409 without changes. Actor/session/
credential version is revalidated inside the transaction and user/program rows are locked.
Editor cannot edit/submit another author's drafts; legacy owner-null drafts are Admin-only
for editing/submission. Reviewers cannot edit content or publish. Admin cannot self-approve.

Create/update/association changes/state transition and audit insertion share one transaction.
Audit failure rolls everything back and returns generic 503. Denials are logged outside the
rolled-back transaction. Audit events record UUID actor/target, permission and previous/new
status, never titles/descriptions/URLs/request bodies. Audit reads expose new status fields
additively; existing role history remains unchanged. Private program reads are authorized
but not individually audit-logged; all successful mutations and authorization denials are.

Status codes: 400 validation/taxonomy, 401 inactive/missing session, 403 authorization/CSRF,
404 missing program/route, 405 unsupported method, 409 stale version/invalid state/duplicate
slug/retryable DB conflict, 413 body limit, 415 content type, 429 rate limit, generic 503
DB/transaction/audit unavailable. Program JSON body limit is 64 KiB; auth bodies remain 2 KiB.
No blind automatic mutation retries: reload state/version after 409.

## Migration / deployment

Apply append-only 006 with the migrator after backup/identity checks. 001–005 unchanged.
The migration adds review status/ownership/revisions and status audit fields, preserving
verification and DEMO constraints and the public view. Published rows reject ordinary DELETE
through a trigger; API DELETE is always 405, and runtime must have no program DELETE/TRUNCATE.
DB owners can bypass triggers/DDL: privileged destructive maintenance stays separately approved.

Production startup gate additionally requires the deletion guard and narrow CRUD grants:

- SELECT programs and taxonomy tables.
- Program INSERT: slug,category_id,title,description,is_demo,source_url,source_name,apply_url,
  age_min,age_max,deadline,created_by,status only.
- Program UPDATE: slug,category_id,title,description,source_url,source_name,apply_url,age_min,
  age_max,deadline,submitted_by,reviewed_by,verified_at,updated_at,version,status only.
- Associations program_regions/program_family_categories: SELECT/INSERT/DELETE; no UPDATE,
  TRUNCATE, TRIGGER or ownership. Taxonomy needs SELECT only (no extra UPDATE for locks).
- Audit INSERT additionally previous_status/new_status; existing restricted audit grants stay.

No role/grants are modified by application startup. Real restricted-role HTTPS staging
verification remains required. Never use migrator credentials as runtime. Rate limits are
unchanged; expire/revoke/CSRF protections and production dependency gates stay enabled.

`npm run test:db` uses dedicated balaqoldau_test. Files run serially because audit-failure
tests create transactional triggers on a shared schema; otherwise DDL lock upgrades can
deadlock. All assertions run, including concurrent revision requests within the program
test. Fixtures/triggers roll back; only append-only migrations persist. Pool commit/rollback
path is separately unit-tested; multi-connection/load tests under real staging grants are
still required. No dev/production program was created or published during implementation.

Reference data update: [20 Kazakhstan regions, neutral support needs, localization and migration 013](REFERENCE_DATA.md). Nationwide is stored as 20 explicit region associations, so API payloads and matching contracts do not change. Real draft create/PATCH and approval reject DEMO category/region/support references. DEMO drafts remain private; no reference is automatically assigned to an existing program.
