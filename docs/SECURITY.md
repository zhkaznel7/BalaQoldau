# Stage 7 security review — 2026-11-11

## Reviewed boundaries

Browser query/body → Zod → parameterized pg → published-only view; external source
links → HTTPS URL validation + React escaping; environment → Zod → pool/Express;
proxy headers → explicit loopback trust only when enabled. No authentication,
tracking or extra personal-data fields were added. No schema/local role changes.

- Strict query/UUID/body schemas reject unknown/repeated/nested parameters; pagination
  limit 50/page 10000, q 200, age 0–17. SQL data values are `$n` parameters, LIKE
  metacharacters escaped. Dynamic SQL fragments/identifiers are internal constants.
- All public program reads use `published_programs` (`published AND NOT is_demo`).
  Taxonomies only list public-associated entries; details private/absent → 404.
  Contact has POST only; response id only, no read endpoint. Runtime view is not
  a substitute for least-privilege deployment credentials.
- Helmet default CSP/security headers, no-store, exact CORS allowlist, no credential
  cookies. CORS is not authentication; arbitrary origin-less clients can POST contact.
  16 KiB strict JSON/no compression, general 100/min/IP and contact 5/15min/IP limits.
  Disallowed CORS is rejected before app limiter; deploy ingress throttling is required.
- Proxy trust remains false by default. `TRUST_PROXY_LOOPBACK=true` allows same-host
  ingress; non-loopback forwarded hops remain untrusted. Ingress must overwrite headers
  and Node must not be publicly reachable. In-memory limits are not distributed.
- Generic errors/log events omit inputs, SQL errors, credentials and stacks. Existing
  handler delegates headers-already-sent errors to Express; current routes send once
  with no later async work. Future streaming routes must re-review default logging.
- DB verify-full required in production; local pgpass is ignored by Git and was not read.
  `.env`, password files, key/certificate containers and common backup dumps are ignored. .env examples
  contain no actual credentials. Ignore rules do not replace secret scanning/review.
  Local postgres superuser is for isolated development only. pg 8 password-file support
  emits a pg 9 removal warning; plan secure replacement before a major pg upgrade.
- Health is liveness, not readiness. DB startup is lazy and DATABASE_URL optional for
  health-only mode; deployment must require DB env and test real reads before traffic.
- No browser DB credentials, raw HTML rendering, remote image/tracking service or
  automatic contact retries. Favorites store only up to 50 public UUIDs. Free-text
  contact can still contain unsolicited sensitive information despite the UI warning.

## Dependency advisory

Frontend audit: **10 moderate**, high/critical 0; production-only audit checked separately.
One root cause: minimatch 10.2.6, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249),
patched 11.0.1. Attacker-controlled globs with optimizationLevel >=2 can exhaust CPU/memory.
Paths: eslint → minimatch; eslint → @eslint/config-array → minimatch;
typescript-eslint → @typescript-eslint/typescript-estree → minimatch. The other reported
packages inherit that advisory; these are not ten independent runtime vulnerabilities.

Registry checked: latest eslint 10.14.0 still requires minimatch ^10.2.6;
typescript-eslint 8.72.2/typescript-estree still require ^10.2.2; latest 10.x minimatch
is 10.2.6. No compatible patched release available. npm remediation suggests downgrades
outside declared ranges (eslint/@eslint/js 9.39.5, typescript-eslint 8.36.0). Major override
to minimatch 11 is not established non-breaking. No force fix, overrides or dependency
changes were made. UI API requests never reach the lint glob parser.

Risk deferral: keep lint configs trusted, review PR config changes before running tools,
use isolated CI with time/memory budgets and no production secrets on untrusted PRs.
Project maintainer must accept/review this dev-only risk before release; next review
2026-11-18 or immediately when upstream compatible remediation appears.

## Contact-message retention policy (operational proposal; automation NOT implemented)

Purpose: reply to a voluntarily submitted support enquiry. Stored fields are name,
email, message, UUID, created_at. No IIN/medical fields; never ask for them. Users see a
warning not to submit sensitive content. This is not a legal compliance certification;
operator must review Kazakhstan privacy/consent obligations before public launch.

- **Delete every message 30 days after created_at**, including unanswered messages;
  schema has no resolution flag. No indefinite exceptions/exported inbox copies.
- A designated support operator reviews messages with separately controlled access;
  application runtime cannot read personal fields or delete messages. Do not add an
  admin/read endpoint for this policy. Assign a real owner and a safe contact channel
  for verified deletion requests; neither an owner nor a channel is invented here.
- Verified deletion requests: manually remove the matched message earlier after
  proportionate identity verification; no unnecessary IIN collection. Record only
  completion timestamp/count in operational records, never message/email/name/UUID.
- Daily purge by a separately authorized retention operator, using parameterized SQL
  with a server-calculated UTC cutoff, after DB identity verification:

  ```sql
  -- Example statement for an approved job, not executed by this review.
  DELETE FROM balaqoldau.contact_messages WHERE created_at < $1::timestamptz;
  ```

  `$1` = run time minus 30 days; report affected count only. Operator/job credentials
  need SELECT(created_at), DELETE on this table, not schema ownership; manual targeted
  deletion additionally needs SELECT(id). Never use TRUNCATE/reset or expose credentials.
  The created_at index already exists. No deletion command or scheduled job was added/run.
- Encrypted backups expire within **30 days**; no permanent contact exports. A deleted
  message can remain in a protected pre-deletion backup until expiry (up to 30 more days).
  Before reopening a restored database, reapply retention and previously verified
  deletions using a restricted restoration procedure; do not log personal payloads.
- **Launch blocker:** assign owner, publish a clear privacy notice (purpose, 30-day live
  retention, backup window, deletion channel), approve an auditable manual purge until
  a tested scheduled job exists. Automation, deletion-request workflow, backup expiry
  enforcement and operator tooling are not implemented by this repository.

## QA limitations

Browser fixtures are TEST-labelled, never published to the database. Real browser API
smoke is GET-only on balaqoldau_dev; real contact INSERT/RETURNING is tested separately
in a rolled-back balaqoldau_test transaction. Local test credentials are superuser;
production restricted-role, TLS ingress, backup/restore and retention need staging drills.
Automated layout/contrast/keyboard checks are not full WCAG compliance or NVDA/VoiceOver
testing. Local timing is not field Core Web Vitals. Photo license remains unconfirmed.
