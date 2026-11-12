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
