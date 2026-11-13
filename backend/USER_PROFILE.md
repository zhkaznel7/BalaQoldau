# Stage 12 — Profiles and saved programs

Uses existing Stage 11 user sessions/CSRF, separate from admin RBAC. No children, family
attributes, eligibility claims, application tracking, email changes or external data imports.

## Migration and safety

Migration 008 adds nullable full_name/location (up to 100 Unicode characters) to user_accounts
and user_saved_programs (user_id/program_id composite PK, FKs, timestamp, user/order and
reverse-program indexes). Existing accounts/programs are preserved. No destructive table
changes, role changes, production records or seeds. Local DB name/loopback connection and
current_database() are verified by the user DB runner before existing migrations execute.
Local implementation/testing uses only balaqoldau_dev. Migrations are checksummed/idempotent.
Synthetic TEST programs used by integration/browser tests are rolled back, never published
to the persistent catalog. Do not run the older test:db against another local database.

## API (all under /api/auth)

| Endpoint | Input and result |
|---|---|
| GET /profile | `{data:{id,email,language,fullName,location,savedCount}}`; additions to Stage 11 profile contract |
| PATCH /profile | `{fullName:string|null,location:string|null}`; both fields required, empty strings become null; returns profile envelope |
| GET /saved-programs?page=1&limit=20 | Public program DTO array + standard pagination; limit 1–50, page 1–10000 |
| GET /saved-programs/status?ids=UUID,UUID | `{data:[savedPublishedId,...]}`; 1–50 IDs, duplicates deduplicated |
| POST /saved-programs/:uuid | `{}` → 204; duplicate save also 204; unavailable/draft/DEMO/missing → safe 404 |
| DELETE /saved-programs/:uuid | `{}` → 204, idempotent, removes only current user's association |

All routes require an active regular-user session. PATCH/POST/DELETE require exact Origin,
JSON and current X-CSRF-Token; duplicate/malformed cookies and unknown fields/query inputs
are rejected. Clients never send a user ID, email or role. Every SQL statement independently
derives ownership from the current non-expired/non-disabled session and credential version.
Mutations lock the user row where appropriate; session validity is checked in the same
statement snapshot. No session row lock/UPDATE grant is needed. No personal input appears in logs.
Email cannot be edited by this API; a separately reviewed verification flow is required.

Profile text uses NFC, trims/collapses whitespace, rejects C0/C1 control characters and caps
each normalized field at 100 Unicode code points. Values remain optional and React-escaped.
Saves are unique per user/program through a database constraint. Counts/list/status use only
the existing published AND NOT is_demo view. Hidden programs contribute neither details nor
counts. An unpublished association remains private and can reappear if republished; deletion
of a program cascades its saved links. Removal never reveals another user's association.
Profile updates use last-write-wins for the submitted pair of fields; no revision API added.

## UI and local manual checks

- http://localhost:5173/profile — email, optional profile editor, available saved count,
  saved/search navigation and existing logout.
- http://localhost:5173/profile/saved — paginated saved programs, remove/open/details/back.
- http://localhost:5173/results and /program/:uuid — authenticated save/remove controls.
- Append ?lang=ru for Russian dashboard/auth labels; default kk. Auth pages have no standalone
  language switcher. Program content is returned as stored; no invented Russian translations.

Anonymous browsing remains public and independent of auth availability. Saving offers a login
link containing a validated local returnTo, preserving search filters/page. Login returns to
that page; saving still requires an explicit click. External/admin return targets are denied.
One shared memory-only user session/CSRF client prevents independent bootstrap races. Saved
status is batched per displayed list (<=50), not one API call per card. Private state is
cleared on identity changes/401; profile and list requests cancel stale reads. Mutations
are not automatically retried. Unknown profile-save outcomes require explicit server reload.

Old localStorage favorites are retained under /favorites, accessible from the profile. They
are not silently imported/deleted; the old page remains readable and explicitly clearable.
New saves always use PostgreSQL. No new credentials or database configuration enter VITE_*.

## Production permissions and operations (instructions only)

After migration 008, the DBA must add to the existing approved user runtime role:

```sql
GRANT UPDATE (full_name,location) ON balaqoldau.user_accounts TO balaqoldau_runtime;
GRANT SELECT,INSERT,DELETE ON balaqoldau.user_saved_programs TO balaqoldau_runtime;
```

Existing runtime SELECT on user_accounts, categories, published_programs and program-region/
family joins is required by the reused public DTO query. Never grant table-wide account
UPDATE, email/disabled edits, saved-table UPDATE/TRIGGER/TRUNCATE, ownership or elevated roles.
Production startup now checks these narrow rights, in addition to existing user/admin gates.
Session row locks are deliberately absent: PostgreSQL FOR SHARE requires UPDATE privileges,
which the existing session-table policy forbids ([PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html)).
No grants or role changes were executed; real TLS/restricted-role staging still required.
Rollback application/configuration only; keep additive 008 and all user data.

Publish accurate optional-profile/saved-interest privacy and authorized deletion/backup
procedures before launch. No account/profile erasure automation is claimed; account FK
cascade does not replace an authorized deletion workflow. Stage 11 mail/cleanup/monitoring
requirements remain. Automated browser checks are not full assistive-technology certification.

## Checks

Backend: build/lint/typecheck/test and test:user-db. Frontend: lint/typecheck/test/build,
test:user-browser and BROWSER_BUILD=true test:browser. User DB/browser test fixtures use
BEGIN/ROLLBACK; no existing user/program data is overwritten. GitHub CI already runs the
dedicated user DB command, now including both auth and dashboard suites serially. Only
GitHub Actions uses its existing isolated CI database; it was not run/pushed from this task.
