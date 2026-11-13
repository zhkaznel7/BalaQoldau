# Stage 7 security review — 2026-11-11

## Stage 15 update

Optional, parent-owned child profiles now exist: see [current child privacy and API
runbook](../backend/CHILD_PROFILES.md). Earlier "no children" statements describe their
historical stages. Only optional nickname, completed age, existing region and program
category interests are stored; no identity, birth date, address or medical/status fields.
Fresh session ownership is enforced in SQL, mutations reuse CSRF and revisions, and
deletion requires explicit confirmation. Private recommendations do not send child facts
to public search URLs, infer sensitive family eligibility or persist results. Narrow
production grants, infrastructure log redaction, inactivity/backup retention and restored
backup erasure procedures require operator review before launch; no compliance claim,
automated child retention or production infrastructure changes are made here.

## Stage 12 update

User-requested optional full name/location and account-linked saved-program interests now
exist; see [USER_PROFILE.md](../backend/USER_PROFILE.md). No child/IIN/medical fields were
added. Email remains immutable. Every dashboard query derives ownership from an active
session, mutations require CSRF/Origin/JSON, text is normalized/bounded and query values
parameterized. Hidden/DEMO programs never appear in saved lists/counts. Production runtime
needs only the documented narrow profile and saved-table grants; no session UPDATE rights
were introduced. Publish accurate optional-data/interest retention and authorized-erasure
procedures before launch. No automatic erasure or production restricted-role certification
is claimed. Contact retention and admin security remain unchanged.

## Stage 11 update

Historical Stage 7 statements below predate authentication. Regular-user accounts now
exist separately from admin accounts: [current auth/security runbook](../backend/USER_AUTH.md).
Only email, chosen language, Argon2id hash, timestamps/counters and server session/reset
metadata are stored; no IIN, medical information, tracking or real account seeds were added.
Registration is not email/identity verification. Account privacy/deletion policy, expired
token/session physical cleanup, real mail delivery and restricted-role HTTPS staging remain
operator requirements. Reset dispatch is best effort; no automatic delivery promise.

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
- Stage 8.1: health remains liveness. Production requires DATABASE_URL, HTTPS CORS
  origins and verify-full DB TLS; a bounded public-view probe must succeed before
  listening. /api/ready repeats that probe, returning generic 503 on failure/shutdown.
  Development/test retain optional-DB health-only mode. Full runtime grants still need
  staging verification; readiness checks the view, not every write privilege.
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

## Contact-message retention — Stage 8.2

A tested cleanup command now exists: [contact retention runbook](CONTACT_RETENTION.md).
Default 30 days from created_at, configurable 30–365 with privacy-owner approval; batch
1–1000 (default 100), explicit --dry-run or --execute, dedicated retention connection and
verified target identity. Dry-run is read-only; execute is transactional, parameterized
and bounded. Logs contain counts only. Public API runtime deletion rights were not added.

**Scheduling is not configured.** No automatic-deletion promise is made. The runbook
documents least-privilege grants (not executed), authorized early deletion, failure/retry
handling and operator responsibilities. Before launch, appoint an owner and request
channel, publish an accurate policy, configure approved cleanup/backup expiry and test
restore erasures. Proposed protected backup expiry remains 30 days; backup enforcement,
early-deletion tooling and erasure-ledger automation are not implemented. The existing
contact notice remains accurate and does not claim automatic deletion.

## QA limitations

Browser fixtures are TEST-labelled, never published to the database. Real browser API
smoke is GET-only on balaqoldau_dev; real contact INSERT/RETURNING is tested separately
in a rolled-back balaqoldau_test transaction. Local test credentials are superuser;
production restricted-role, TLS ingress, backup/restore and retention need staging drills.
Automated layout/contrast/keyboard checks are not full WCAG compliance or NVDA/VoiceOver
testing. Local timing is not field Core Web Vitals. Photo license remains unconfirmed.

## Stage 16 verification and reports

Independent review requires explicit source/information/eligibility checks and an immutable version-bound approval. Publish/archive require confirmation; only Admin can flag a source because the flag hides public availability. All transitions and report moderation use fresh RBAC, CSRF, row locks, versions and atomic audit writes. Public reports require no account, accept bounded text and have a separate 5-per-15-minute process-local IP limit. Reports never automatically change publication. Notes/explanations are private plaintext, not audit payloads; operators must redact request bodies in proxy/APM logs and establish a retention/erasure procedure for accidentally submitted personal information. No automated report deletion or shared multi-instance limiter is claimed. [Threat boundaries and grants](../backend/VERIFICATION.md).

Admin session reliability: read verification and data GETs use 120/IP/minute independently of 60/IP/15-minute admin writes; the existing global limit, login 5/IP/15-minute limit, account guard, CSRF, RBAC, cookie scope and expiry remain. Transient errors retain only last-verified frontend state, never server privileges. Only actual unauthenticated responses clear it; verification 403 blocks UI access. In-flight deduplication, 10-second request deadlines and Retry-After-gated read retries prevent event storms. Stores remain per-process; distributed ingress/NAT sizing remains an operator responsibility.
