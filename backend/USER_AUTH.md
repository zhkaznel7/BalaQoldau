# Stage 11 — User accounts

Stage 15 reuses this exact regular-user session/CSRF mechanism for
[/api/auth/children](CHILD_PROFILES.md). No admin privileges, extra authentication
cookies or child accounts are introduced. Optional child profiles belong to parents.

Stage 12 extends GET /profile and adds protected profile editing/saved-program endpoints:
see [USER_PROFILE.md](USER_PROFILE.md) for migration 008, API contracts and runtime grants.

Independent user_accounts/user_sessions/user_reset_tokens, cookies and principals; no admin
RBAC rights. Only the existing native Argon2id helper is shared (Node >=24.7, 19 MiB, two
passes, random salt, bounded concurrency two). No dependencies/providers were added.
Registration does not verify email ownership or identity; the KZ/RU interface states this.

## Enable locally

Preserve ignored backend/.env and credentials. DATABASE_URL must already target the existing
loopback balaqoldau_dev, never balaqoldau_db. From backend/:

```powershell
$env:USER_AUTH_ENABLED = 'true'
$env:USER_ORIGIN = 'http://localhost:5173'
npm run build
npm run db:migrate
npm run dev
```

Open Vite at exactly http://localhost:5173. USER_AUTH_ENABLED defaults false, independent of
ADMIN_ENABLED. The existing /api proxy works locally. Production requires real same-origin
HTTPS ingress, SPA fallback and /api reverse proxy, not Vite. USER_ORIGIN must be an exact
HTTPS origin in production. No database/mail config is exposed to the frontend.

## API contract

| Endpoint | Input / response |
|---|---|
| GET /api/auth/session | `{data:{authenticated,user:{id,email,language}\|null,csrfToken,resetAvailable}}`; expired/missing cookie creates anonymous 10-minute CSRF session |
| POST /api/auth/register | `{email,password,language?:"kk"\|"ru"}` → 202 `{data:{accepted:true}}`, identical for duplicates; never overwrites or auto-logs-in |
| POST /api/auth/login | `{email,password}` → 200 session envelope; rotates cookie/CSRF and consumes anonymous session |
| POST /api/auth/logout | `{}` → 204, server session deleted and cookie cleared |
| GET /api/auth/profile | `{data:{id,email,language}}` for current active user only, otherwise 401; no ID parameter |
| POST /api/auth/password-reset/request | `{email}` → generic 202 if configured; otherwise 503 RESET_UNAVAILABLE |
| POST /api/auth/password-reset/confirm | `{token,password}` → 204; invalid/used/expired → 400 INVALID_RESET |

POST requires exact Origin, JSON and current X-CSRF-Token; unknown fields/query parameters,
cross-site Fetch Metadata and malformed/duplicate cookies fail closed. Cookies: HttpOnly,
SameSite=Strict, production Secure __Host-balaqoldau_user at / without Domain; development
balaqoldau_user at /api/auth. Responses use no-store/Helmet/safe errors. Never capture auth
bodies, cookies, emails or CSRF/reset values in ingress/APM/application/session-replay logs.

Regular-user registration/login/reset passwords: >=8 Unicode code points, <=256 UTF-8 bytes,
no truncation. Frontend and backend use identical character/byte bounds. Admin password
hashing/provisioning retains its independent minimum of 15 Unicode code points unchanged.
USER_SESSION_SECONDS 300–86400,
default 3600, absolute server-side expiry. Password changes/disable rotate credential_version
via trigger. Reset atomically changes credentials and revokes all sessions/reset tokens under
row locks, without auto-login. Migration 007 is additive and checksummed; no accounts seeded.

IP limits: five attempts/15 minutes per login/register/reset-request/reset-confirm; auth
namespace 120/15 minutes. Persistent account limits: ten login attempts/15 minutes, three
reset issuances/hour. Unknown accounts pay the same KDF cost; registration hashes before
conflict handling. IP stores are process-local; production needs ingress protection across
replicas and capacity checks. Admin hashing shares the bounded KDF capacity.

## Optional reset delivery (not configured or live-tested locally)

Set BOTH USER_MAIL_COMMAND (absolute trusted sendmail-compatible executable) and
USER_MAIL_FROM (valid sender), or neither. Example only: /usr/sbin/sendmail and
support@example.com. No MTA, external service or credentials were installed/provisioned.
The existing MTA must accept -i -t and read headers/body from stdin. No shell or personal
data in process arguments; output discarded; five-second deadline. Configure MTA TLS,
sender authentication, queue/retries and delivery monitoring separately.

Without mail config, resetAvailable=false and UI states no mail is sent. With config, 202
only accepts a request, never asserts account existence/delivery. Lookup/delivery dispatch
is asynchronous (maximum two in flight), so HTTP timing does not await account/mail outcome.
Failures log only `Password reset delivery failed`. Dispatch is best effort, not a durable
application outbox: process exit may lose an accepted request. After MTA acceptance its own
queue applies. Monitor failures and test actual delivery before launch; request again within
rate limits if needed. No external scheduler/background service was introduced.

Tokens: random 256 bits, SHA-256 digests only in DB; USER_RESET_SECONDS 300–3600, default1800.
Links use configured USER_ORIGIN, never Host: /reset-password#token=... . Fragment is removed
by UI and token kept in memory, never storage/logs/API responses. Same-page new links work.
Basis: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Production database role — instructions only, not executed

Use a non-owner runtime role, no superuser/BYPASSRLS, elevated memberships, role/database/
schema creation, TRIGGER/TRUNCATE or session UPDATE. Startup fails closed on unsafe/missing
user-table rights or disabled rotation trigger. Existing admin gate remains unchanged.
Example DBA grants after migration 007, additional to existing public/admin rights:

```sql
GRANT USAGE ON SCHEMA balaqoldau TO balaqoldau_runtime;
GRANT SELECT ON balaqoldau.user_accounts TO balaqoldau_runtime;
GRANT INSERT (email,password_hash,language) ON balaqoldau.user_accounts TO balaqoldau_runtime;
GRANT UPDATE (password_hash,credential_version,login_attempts,login_window_ends,
              reset_attempts,reset_window_ends) ON balaqoldau.user_accounts TO balaqoldau_runtime;
GRANT SELECT,INSERT,DELETE ON balaqoldau.user_sessions,balaqoldau.user_reset_tokens TO balaqoldau_runtime;
```

Never grant account DELETE or table-wide INSERT/UPDATE. DB_SSL_MODE=verify-full and protected
backups are required. Local owner rejection is tested; positive restricted-role HTTPS
staging certification is pending. No roles/credentials changed. Expired sessions/tokens are
immediately unusable, but physical cleanup is not scheduled: arrange approved bounded
expired-row cleanup/backup expiry without logging addresses/tokens. Account deletion and
retention need a published privacy policy and authorized operator; no automatic/self-service
account deletion is claimed. Existing contact retention is unchanged.

## Verification

Backend: build/lint/typecheck/test and `npm run test:user-db`. Frontend: build/lint/typecheck/
test and `npm run test:user-browser` (after both builds). Local Stage 11 DB/browser tests
verify loopback balaqoldau_dev; synthetic user/admin/session/audit writes use BEGIN/ROLLBACK.
Do not run the older full test:db/admin-browser locally under this stage's dev-only scope;
they target balaqoldau_test. Only GitHub Actions uses its existing isolated loopback
balaqoldau_test service for the new dedicated CI step; existing gates are unchanged.
No GitHub CI execution/push is claimed. Browser tests need installed Chrome or CHROME_PATH
and an owned profile. Automated layout/contrast/keyboard tests are not full WCAG certification.

## Friendly password validation messages

Regular-user rules remain >=8 Unicode code points and <=256 UTF-8 bytes; admin minimum remains 15. Registration/login/reset now return PASSWORD_TOO_SHORT or PASSWORD_TOO_LONG for those boundary failures, with PASSWORD_POLICY retained as a generic malformed-password fallback. The frontend maps codes to Kazakh/Russian messages without byte/encoding jargon or raw backend details. Invalid credentials remain a generic 401 independent of account existence. No hashing/session/CSRF/rate-limit changes.
