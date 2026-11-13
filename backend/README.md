# BalaQoldau backend — Stage 10.1

Stage 14: [public matching API and deterministic eligibility rules](../docs/MATCHING.md).
Apply additive migration 009 before starting the updated API. Existing programs are
not automatically certified or published. `npm run test:user-db` uses verified local
`balaqoldau_dev` with rollback fixtures (isolated CI database in GitHub Actions).

## Stage 10.1 — Admin Program CRUD

[API fields, workflow, RBAC, migrations/grants and testing](PROGRAM_API.md).
Private program list/create/read/PATCH and submit/approve/reject/publish/unpublish are
implemented; UI and DELETE are not. Apply migration 006 before enabling this version.
The program grants extend (and do not replace) the Stage 9 runtime privilege requirements.

## Stage 9.3 — Security hardening

Append-only `004_admin_hardening.sql` adds persistent login counters and credential versioning;
`005_admin_disable_revocation.sql` ensures disable/re-enable never resurrects old sessions.
001–003 remain unchanged. Apply 004/005 before enabling the updated admin backend.

- Existing IP/process limit remains 5 attempts/15 minutes. Additionally, each enabled account
  gets **10 attempts/15 minutes shared through PostgreSQL**, including successful attempts.
  Atomic counter reservation happens before Argon2. Unknown/disabled/throttled accounts use
  dummy Argon2 and the same generic 401; no account-existence/rate state is disclosed.
  Account budget rolls over automatically, never a permanent lock. An attacker can still
  exhaust a known account's temporary budget: monitoring and recovery ownership are needed.
- Password-hash changes automatically increment credential_version. Existing authenticated
  sessions stop verifying; login captures the current version. The post-KDF SQL checks the
  exact verified hash, active account and unexpired single-use bootstrap before issuance.
  Disabling an account also advances the version; re-enabling requires a fresh login.
- Role changes recheck the active session/credential version in the mutation statement.
  Audit reads recheck current Admin authority/session and write the audit event in the same
  SQL statement as the protected read. User-row locks serialize credential/role changes;
  no UPDATE privilege on sessions is needed. Already-authorized in-flight operations may
  complete concurrently with logout; later requests cannot use a revoked session.
- All session-expiry decisions use database wall-clock time rather than transaction-start
  `now()`. Absolute expiry, cookie flags, CSRF/origin rules, rotation and fail-closed audit stay.
- With ADMIN_ENABLED=true in production, startup performs a read-only catalog privilege check
  before listening. Missing schema/grants, superuser/elevated-role membership, DB/schema
  CREATE/ownership, sensitive user-column writes, session UPDATE and audit mutation/DDL-related
  grants are rejected. The operator must grant SELECT on necessary user fields (including
  credential_version/login counters), UPDATE(role,login_attempts,login_window_ends) only;
  session SELECT/INSERT/DELETE; audit SELECT plus INSERT of allowed event columns.
  No user INSERT/DELETE or password/disabled/credential-version UPDATE for runtime.
  Column-level grants are checked too: audit UPDATE and explicit id/timestamp INSERT are
  forbidden, and audit/password/disable triggers must be enabled. Runtime cannot set
  session_replication_role to bypass triggers. Privilege checks use PostgreSQL's
  [catalog inquiry functions](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE).
  The existing public API grants remain necessary; this admin check does not replace a
  complete infrastructure/role-membership review or monitoring of later grant drift.

The test DB uses a migration/owner connection and correctly fails the runtime privilege check;
unit tests cover a successful safe result, but **a real least-privilege positive staging run is
still required**. No roles/credentials were created or changed to run tests. Provisioner/migrator
credentials must not be used by the production runtime. Migration/auth/retention jobs stay separate.
Node/Argon2 dependencies and CI security thresholds are unchanged. No admin UI/parent accounts/CRUD.

## Stage 9.2 — Server-side RBAC және audit

Append-only migration `003_admin_rbac.sql` adds editor/reviewer/admin application roles.
Existing accounts become **Editor**, not Admin. Fresh offline provisioning defaults to Editor;
the authorized operator explicitly sets `ADMIN_PROVISION_ROLE=admin` to bootstrap the first
Admin. No real accounts/production roles are changed during implementation.

| Role | Capabilities |
|---|---|
| Editor | programs:read, programs:draft:write |
| Reviewer | programs:read, programs:review |
| Admin | all above, programs:publish, taxonomy:manage, users:roles:manage, audit:read |

Program/taxonomy capabilities are contracts for future handlers, **not implemented CRUD**.
Future resource handlers must check both permission and resource status/ownership. Reviewer
cannot publish or assign roles; Editor cannot approve/publish. Unknown roles/permissions deny.
No permissions come from body/query/headers or cached cookie claims; each request joins the
live user role. Existing login/session/logout JSON contracts and CSRF/cookie controls remain.

| Endpoint | Authorization |
|---|---|
| GET /api/admin/access | authenticated known role; own id/role/permissions only |
| GET /api/admin/audit-log?page=1&limit=20 | Admin only; max limit 50/page 10000, newest first, no total count |
| POST /api/admin/users/:uuid/role | Admin only, JSON `{role:editor\|reviewer\|admin}`, valid Origin/CSRF |

Unauthenticated access = 401, authenticated but insufficient permission = 403. Strict
query/body/UUID/role validation rejects unknown fields, including privilege-bearing extras.
Self-role changes and unknown/disabled targets return 403. Role mutation locks actor/target
rows in stable order and rechecks current Admin authority in the same SQL statement; role
update and audit INSERT are atomic. A failed audit write prevents successful mutation (503).
An already in-flight request can finish; subsequent requests read the new role immediately.

Audit records login success/failure, logout, RBAC denial, role changes, session-known CSRF
denial, audit-read attempts and offline account creation. Only UUID actor/target, finite event,
permission, old/new role and DB timestamp are stored; no email, password/hash, IP, token,
request URL/body or cookie. Anonymous/pre-auth bootstrap is not logged as a login.
Invalid origin/malformed-cookie/body and rate-limit rejection can happen before session/DB
access and are not all persisted, avoiding an unauthenticated audit-write amplification path.
Audit write failure yields safe 503, never an authorization bypass.

Audit table rejects UPDATE/DELETE/TRUNCATE through a statement trigger, even for application
Admin (which is not a PostgreSQL role). This is append-only application history, **not proof
against a database superuser/owner who can remove triggers**. Audit rows intentionally have
no account FK cascade; historical UUIDs survive future account deletion. UUIDs remain linked
identifiers: privacy owner must define audit retention/access/archive policy before launch.
No audit purge/archive automation is installed; the contact retention job does not touch it.

Runtime grants must be reviewed by the operator: SELECT on needed admin_users columns
(including role/credential version/login counters), UPDATE(role,login_attempts,login_window_ends) only;
SELECT/INSERT/DELETE admin_sessions; SELECT audit log
and INSERT(event,actor_id,target_id,permission,previous_role,new_role) only. No audit
UPDATE/DELETE/TRUNCATE, DDL, table ownership or superuser. Offline provisioner needs user
INSERT and audit INSERT, separately from runtime. PostgreSQL roles/grants were not changed.
Application authorization remains mandatory because one shared runtime DB role cannot itself
distinguish Editor/Reviewer/Admin users. Keep raw audit SQL access restricted.

Migration 002/001 are immutable; apply 003 before enabling auth. Integration tests use only
balaqoldau_test with transaction rollback. Admin UI, user CRUD, program CRUD and RBAC UI
are not part of this stage.

## Stage 11 — User authentication

Stage 12: [profile/saved-program API](USER_PROFILE.md), additive migration 008, optional
profile fields and account-backed saved programs. Run `npm run test:user-db` for both suites.

Stage 11 adds separate regular-user authentication. See [USER_AUTH.md](USER_AUTH.md) for
the API, migration 007, KZ/RU forms, local enablement, optional delivery and runtime grants.
Current dev-only verification command: `npm run test:user-db`. Admin RBAC stays independent.

## Stage 9.1 — Admin authentication

Node **24.7+** қажет: [native Argon2 API](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback).
Жаңа dependency жоқ. Argon2id m=19456 KiB, t=2, p=1, salt 16 bytes, tag 32 bytes —
[OWASP baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
Бір process-та ең көбі екі KDF қатар жүреді; overload safe 503 береді.

Auth әдепкіде `ADMIN_ENABLED=false`. Enable үшін DATABASE_URL, exact ADMIN_ORIGIN,
production HTTPS/DB verify-full және migrations 002–005 қажет. Dev schema өзгертілген жоқ;
іске қоспас бұрын operator backup/identity/grants тексеріп, append-only `npm run db:migrate`
орындайды. balaqoldau_db қолданылмайды. Real admin account автоматты жасалмайды.

| Endpoint | Behavior |
|---|---|
| GET /api/admin/session | 200 `{data:{authenticated,admin:{id}\|null,csrfToken}}`; missing/expired cookie → anonymous 10-minute bootstrap |
| POST /api/admin/login | JSON `{email,password}`, exact Origin және X-CSRF-Token міндетті; success 200, generic credentials failure 401 |
| POST /api/admin/logout | JSON `{}`, exact Origin + X-CSRF-Token; server session DELETE, cookie clear, 204 |

Session ID — random 256-bit opaque cookie, DB-де тек SHA-256. CSRF token сессияға байланған,
login кезінде екеуі де ауысады, ескі session жарамсыз. Cookie HttpOnly, SameSite=Strict,
production Secure/__Host prefix/Path=/, dev Path=/api/admin. Domain берілмейді.
Authenticated TTL default 3600s, allowed 300–28800, absolute (sliding жоқ).
Disabled users бірден verify-дан өтпейді. Account existence, password/hash/SQL response/log-қа шықпайды.
Invalid query/body/cookie, CSRF/origin және media type қауіпсіз 4xx; DB/KDF failure 503.

Admin UI/API бір origin-де reverse proxy арқылы қызмет етуі тиіс; cross-origin credentialed
CORS қосылған жоқ. Public CORS/API өзгермейді. Production тек HTTPS сұрауын қабылдайды;
trusted loopback proxy forwarding headers-ті overwrite етуі тиіс.
Login: IP бойынша 5 attempts/15 minutes (success қоса), bootstrap/admin 60/15 minutes.
Limiter memory-based, single-process: multi-instance алдында shared/edge limiter қажет;
distributed credential stuffing үшін account-aware/MFA controls бөлек review күтеді.
RBAC/admin UI/user registration/password reset API бұл кезеңге кірмейді.

### Offline account provisioning (operator only, implementation кезінде орындалмады)

`npm run build` кейін backend cwd-де operator-only database credentials қолданыңыз;
ADMIN_PROVISION_DATABASE нақты target аты болсын. `npm run admin:create` тек stdin JSON
`{email,password}` қабылдайды (TTY/CLI password arguments жоқ), 15 Unicode character minimum,
256 UTF-8 byte maximum; duplicate email safe failure, existing account overwrite жоқ.
Password-ты shell history/arguments/logs-қа салмаңыз. Windows secure prompt үлгісі:

```powershell
$adminCredential = Get-Credential -Message 'New BalaQoldau admin (offline provisioning)'
try {
  @{email=$adminCredential.UserName;password=$adminCredential.GetNetworkCredential().Password} |
    ConvertTo-Json -Compress | node --env-file-if-exists=.env dist/admin/provision.js --create
} finally { Remove-Variable adminCredential }
```

Transcript/debug logging қолданбаңыз; managed plaintext stdin/process memory ішінде уақытша
болады. Target identity insert алдында тексеріледі. Production TLS және бөлек provisioner
INSERT privilege керек; Stage 9.2 runtime/audit grants толық матрицасы жоғарыда берілген.
admin_sessions үшін SELECT/INSERT/DELETE ғана алсын. DB рөлдері автоматты өзгермейді.
Password rotation/disable оператор transaction-ында hash update + сол admin session revocation
арқылы жасалсын; secret/hash-тарды SQL console history-ге жазбаңыз.

Expired sessions әр сұрауда жарамсыз, бірақ автоматты purge әлі іске қосылмаған.
Operator admin_sessions expiry cleanup schedule/monitoring/storage budget бекітсін;
contact retention job өзгермейді. Least-privilege/TLS/real ingress verification — launch gates.
`npm test` — unit/security, `npm run test:db` — dedicated balaqoldau_test, temporary admin
fixtures ROLLBACK. Local test suite migration 002-ні тек test DB-ге қолданады.

## Stage 8.2 — Contact privacy & retention

Қолданыстағы contact API/form/schema өзгермеді. Жаңа cleanup CLI: default **30 күн**,
configurable **30–365**, batch default **100**, maximum **1000**, бір іске қосуда бір batch.
`created_at < PostgreSQL cutoff`: дәл шекарадағы жазба сақталады. Файлға/логқа тек counts
шығады. Scheduling қосылмаған; автоматты жою operational деп мәлімделмейді.

`RETENTION_DATABASE_URL` (бөлек оператор connection, DATABASE_URL fallback жоқ) және
`RETENTION_EXPECTED_DATABASE` қажет. URL және нақты DB атауы сәйкес болуы тиіс;
balaqoldau_db/system DB тыйым салынған. RETENTION_DAYS/RETENTION_BATCH_SIZE bounds
валидациядан өтеді. Нақты .env/credentials-ті қайта жазбаңыз.

```powershell
npm.cmd run build
npm.cmd run contact:cleanup -- --dry-run
# Тек оператор target/dry-run нәтижесін тексеріп, нақты жоюды мақұлдағаннан кейін:
npm.cmd run contact:cleanup -- --execute
```

Execute нақты dev/production дерегінде осы stage кезінде іске қосылған жоқ. Толық
[retention/deletion/scheduling runbook](../docs/CONTACT_RETENTION.md). Production TLS және
least-privilege retention login оператор тарапынан бөлек тексеріледі; рөлдер өзгертілмеді.

Бөлек Node.js + Express API және PostgreSQL дерекқор қабаты. DATABASE_URL берілсе,
HTTP сервері бір pool құрады; shutdown кезінде оны жабады. React frontend API-ге қосылған.
Node.js 24+ қажет. PowerShell-де `npm.cmd`, басқа shell-де `npm` қолданыңыз.

## Іске қосу

Репозиторий түбірінен:

```powershell
cd backend
npm.cmd ci --ignore-scripts
Copy-Item .env.example .env
npm.cmd run dev
```

`.env` бар болса, оны көшіріп қайта жазбаңыз. `.env` Git-тен еленбейді.
Native Node environment loading қолданылады; dotenv/tsx қажет емес.

Production құрастыру және іске қосу:

```powershell
npm.cmd run build
npm.cmd start
```

Production ортасында `NODE_ENV=production`, `HOST`, `PORT`, нақты
`CORS_ALLOWED_ORIGINS` мәндерін environment арқылы беріңіз. `.env` міндетті емес;
process environment файлдағы мәндерден басым. Қате конфигурация сервер іске
қосылмай тұрып exit 1 қайтарады; мәндер мен stack trace журналға шықпайды.

Production үшін `DATABASE_URL` міндетті, CORS origins тек HTTPS болуы тиіс.
DB TLS `verify-full` режимін талап етеді. Алғашқы readiness probe өтпесе сервер
порт ашпайды, pool жабылып exit 1 болады. Development/test health-only режимі сақталған.

```powershell
npm.cmd test
npm.cmd audit
npm.cmd audit --omit=dev
```

`npm test` strict TypeScript build пен native `node:test` тесттерін орындайды.

## Құрылымы және келісімшарт

- `src/config/env.ts`: Zod environment валидациясы.
- `src/app.ts`: желі портын ашпайтын Express factory және middleware реті.
- `src/routes/health.ts`: `GET /api/health` → 200 `{"status":"ok"}`.
- `src/routes/ready.ts`, `src/db/readiness.ts`: bounded PostgreSQL readiness.
- `src/middleware/errors.ts`: орталық JSON error handler.
- `src/server.ts`, `src/lifecycle.ts`: fail-closed startup, HTTP/pool shutdown.
- `tests/`: localhost HTTP, environment және startup тесттері; сыртқы сервис қажет емес.

Health тек процесс жауап бере алатынын көрсетеді; дерекқор readiness тексеруі емес.
`GET /api/ready` → 200 `{"status":"ready"}` тек DB probe сәтті болғанда.
DB жоқ/қолжетімсіз/schema permission қатесі/timeout/shutdown → 503:
`{"error":{"code":"NOT_READY","message":"Service is not ready."}}`.
Probe connection алу мен query үшін жалпы **2000 ms** deadline қолданады. Тек
`SELECT id FROM balaqoldau.published_programs LIMIT 0` орындалады: connection,
view/migration және view SELECT рұқсатын тексереді, бағдарлама дерегін оқымайды.
Бос каталог дайын болып саналады. Қатар келген probes бір in-flight жұмысты бөліседі;
сәтті нәтиже ұзақ сақталмайды. Timeout-та client destroy, кеш checkout та destroy;
күтудегі жұмыс аяқталғанша жаңа checkout жасалмайды. Pool connection timeout қосымша 3s.
Бұл барлық taxonomy/contact құқықтарын не backup күйін толық тексермейді: төмендегі
least-privilege staging drill әлі міндетті. Probe нәтижесі — сол сәттегі күй ғана.
Public requests пен health readiness SQL орындамайды. Operator readiness probe-ін
5–10 секунд аралығымен баптасын; CORS/rate limiting/no-store/security headers сақталған.
SIGTERM/SIGINT: readiness false, HTTP drain, pool.end; қайталанған shutdown idempotent.
10s shutdown deadline асса процесс қауіпсіз жалпы хабармен exit 1 болады. Service manager
SIGTERM және кемінде 15s stop timeout берсін. Windows тесттері process.emit арқылы
signal handlers-ті тексереді; нақты hosting OS signal delivery staging-де тексеріледі.
Query параметрлері қабылданбайды (400); HEAD қолдау бар. Қате форматы:
`{"error":{"code":"VALIDATION_ERROR","message":"Invalid request input."}}`.
Басқа кодтар: 403 `CORS_FORBIDDEN`, 404 `NOT_FOUND`, 413 `PAYLOAD_TOO_LARGE`,
415 `UNSUPPORTED_ENCODING`, 429 `RATE_LIMITED`, 500 `INTERNAL_ERROR`.
JSON синтаксис қатесі 400 `INVALID_JSON` қайтарады. Күтпеген қате мәліметі
ешбір ортада клиентке берілмейді; журналда тек жалпы оқиға жазылады.

## Қауіпсіздік және пайдалану шектері

- Міндетті `CORS_ALLOWED_ORIGINS`: үтірмен бөлінген exact HTTP(S) origin тізімі.
  Path, trailing slash, credentials, wildcard және `null` қабылданбайды.
  Рұқсатсыз Origin — 403. Origin жоқ health probes/curl рұқсат етіледі.
  CORS аутентификация емес. Credentials жіберілмейді; әдістер GET/HEAD/POST/OPTIONS.
- Helmet барлық жауаптарға қауіпсіздік тақырыптарын қосады. Жауаптар `no-store`.
- `/api` үшін әдепкі шек: IP-ге 60 секундта 100 сұрау, OPTIONS та саналады.
  429 жауабында `Retry-After` бар. IP тек limiter жадында уақытша қолданылады;
  request body, query, IP журналдары және tracking қосылмаған.
- JSON көлемі 16 KiB; қысылған body қабылданбайды. HTTP headers/request уақыттары шектелген.
- Әдепкі bind — `127.0.0.1`. Container үшін `HOST=0.0.0.0` қажет болуы мүмкін.
  TLS termination, firewall және сыртқы traffic шектеуі hosting деңгейінде керек.
- Әдепкі `TRUST_PROXY_LOOPBACK=false`: клиенттің `X-Forwarded-For` тақырыбына сенбейді.
  Бір host-тағы proxy үшін ғана `TRUST_PROXY_LOOPBACK=true` қосуға болады; proxy
  forwarding headers-ті қайта жазсын, Node порты сырттан жабық болсын. Басқа
  топологияға бұл баптауды көшірмеңіз: [deployment runbook](../docs/DEPLOYMENT.md).
- In-memory limiter **бір процеске ғана** арналған, restart кезінде тазарады.
  Бірнеше instance/serverless үшін ортақ limiter store немесе edge gateway қажет;
  бұл кезеңде database/Redis қосылмайды.
- Graceful shutdown жаңа қосылымдарды тоқтатады; 10 секундтан кейін қалған
  қосылымдарды жабады. Production іске қосу алдында deployment-тегі shutdown,
  TLS және proxy параметрлерін тексеру керек.

Пакеттер exact нұсқалармен және бөлек lockfile-мен бекітілген. Орнату scripts
өшірулі. Ресми құжаттар:
[Express security](https://expressjs.com/advanced/best-practice-security/),
[CORS](https://expressjs.com/en/resources/middleware/cors/),
[Helmet](https://helmet.js.org/),
[rate limit](https://express-rate-limit.mintlify.app/reference/configuration),
[Zod](https://zod.dev/basics).

## Stage 3 — PostgreSQL

PostgreSQL 15+ және бөлек application/test database қажет. Тексерілген жергілікті
құрылғыда PostgreSQL 18.6 `127.0.0.1:5432` портында жұмыс істейді; құралдар PATH-та
болмаса абсолют жолды қолданыңыз. Төмендегі командаларды тек оператор мақұлдаған
ортада қолмен орындаңыз. Бар database/role болса, қайта жасамаңыз; reset/drop жоқ.

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -U postgres -d postgres -W
```

Ашылған psql сессиясында (парольді `\password` жасырын сұрайды):

```sql
CREATE ROLE balaqoldau_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password balaqoldau_owner
CREATE DATABASE balaqoldau OWNER balaqoldau_owner;
CREATE ROLE balaqoldau_test_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password balaqoldau_test_owner
CREATE DATABASE balaqoldau_test OWNER balaqoldau_test_owner;
\q
```

Жергілікті тексерілген конфигурация: `127.0.0.1:5432`, user `postgres`,
`balaqoldau_dev` және `balaqoldau_test`. Авторизация Windows-тағы
`%APPDATA%\postgresql\pgpass.conf` арқылы жасалады. Файл мазмұнын журналға
шығармаңыз және Git-ке қоспаңыз; қолжетімділігі тек өз аккаунтыңызға берілсін.
Парольсіз `backend/.env`:

```dotenv
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/balaqoldau_dev
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/balaqoldau_test
DB_SSL_MODE=disable
```

`.env` бар болса қайта көшірмеңіз. Миграция алдында `current_database()` пен
`current_user` арқылы екі target-ті тексеріңіз. `balaqoldau_db` бұл жоба
командаларының target-і емес. `postgres` — тек осы мақұлданған жергілікті setup;
production үшін жоғарыдағыдай шектеулі owner/runtime role қолданыңыз.

Миграцияны қолдану алдында SQL-ді қарап, мақұлдаңыз. Содан кейін backend ішінде:

```powershell
npm.cmd run build
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run test:db
```

`db:seed` миграцияны автоматты қолданбайды. `test:db` тек `TEST_DATABASE_URL`
қолданады, атауы `_test` жұрнағымен аяқталуы және application database атауынан
өзгеше болуы міндетті. Test role тек test database-ке рұқсат алсын. Тесттер осы
арнайы базаға миграция қолданады, бірақ DEMO seed шақырмайды. Шектеулерді
тексеретін арнайы TEST fixture жазбалары бір транзакцияда ROLLBACK етіледі.
DEMO seed тек development базасында орындалады. Тесттер ешбір базаны
reset/delete/drop/truncate жасамайды; schema/history test database ішінде
сақталады, test дерек жолдары қалмайды. URL жоқ немесе сервер
қолжетімсіз болса команда exit 1 қайтарады, PASS/skip деп көрсетпейді.

Stage 3 нақты тексеруі: миграция екі базаға қолданылды, rerun 0 өзгеріс;
development seed екі рет орындалғанда барлық кесте жазбалары мен ID өзгермеді.
Development: екі DEMO draft, public view бос. Test database: жеті кестеде 0 дерек
жолы; integration 4/4 PASS. Нақты командалар мен нәтижелер `../PROGRESS.md` ішінде.
`pg@8.23.1` pgpass қолдауына deprecation ескертуін шығарады: pg 9 жаңарту алдында
авторизация жолын қайта қарау керек. Қазіргі pinned нұсқа авторизациядан өтті.

### Құрылымы және деректер қауіпсіздігі

- `src/db/config.ts`: PostgreSQL URL және TLS валидациясы. URL query/fragment
  қабылданбайды: `sslmode` арқылы TLS тексеруін айналып өтуге жол бермейді.
  Production режимінде `DB_SSL_MODE=verify-full` міндетті, certificate verification
  өшірілмейді. Жеке CA үшін `NODE_EXTRA_CA_CERTS` арқылы CA файлын беріңіз.
  HTTP server үшін DATABASE_URL development/test-та optional, production-да міндетті;
  DB командалары үшін міндетті. DB_SSL_MODE DB factory шекарасында тексеріледі.
- `src/db/pool.ts`: бір process үшін қайта қолданылатын pool factory (max 5),
  3 секунд connection timeout, statement/query/lock timeout. Caller pool-ды бір рет
  құрып, shutdown кезінде `pool.end()` шақырады. HTTP server DATABASE_URL барда pool құрады.
  Транзакция бір client қолданады, қате кезінде ROLLBACK, кейін release жасайды.
- `migrations/001_initial.sql`: жеті талап етілген кесте, PK/FK/unique/check және
  FK/filter индекстері. `schema_migrations` — қосымша қызметтік кесте.
- `src/db/migrate.ts`: нұсқаланған SQL, SHA-256 history, transaction advisory lock;
  барлық pending миграциялар бір транзакцияда. Қолданылған SQL өзгерсе не history
  файлдары жоғалса fail closed. Өзгерісті жаңа migration файлына қосыңыз.
- DB объектілері `balaqoldau` schema ішінде; PUBLIC рұқсаттары қайтарылған.
  Trusted DDL файлдары ғана орындалады; барлық seed/history дерек мәндері `$1`
  параметрлері арқылы беріледі. SQL файлдарын untrusted адамдар өзгерте алмауы тиіс.
- `programs`: draft → verified → published күйлері бар. Verified/published үшін
  source URL/name/verified_at міндетті; age 0–17 және min≤max. Бұл жаңадан ойлап
  табылған мемлекеттік eligibility ережесі емес, өнімнің child-age техникалық шегі.
  URL CHECK тек HTTPS форматын шектейді, дереккөздің ресми екенін растамайды.
- `balaqoldau.published_programs` view тек published, non-DEMO жазбаларды береді.
  Program API тек осы view-дан оқиды. Production runtime role-ға schema USAGE,
  осы view және taxonomy/link кестелеріне SELECT қана беріңіз;
  owner credentials-пен production API жасамаңыз.
  Table owner draft деректерін көре алады — view owner/DB admin-нан қорғау емес.
- DEMO seed екі ойдан шығарылған draft жазба, DEMO taxonomy және тек
  `https://example.com/...` сілтемелерін қосады. DEMO жариялауға CHECK тыйым салады.
  Қайта іске қосу бар жазбаларды өзгертпейді, тек жетіспейтін DEMO байланыстарын қосады.
- `contact_messages` Stage 4 contact endpoint арқылы sender name/email/message сақтайды.
  IIN, медициналық не балаға қатысты жеке дерек өрістері жоқ. Production-ға дейін
  consent/retention және еркін мәтінге sensitive-data саясатын анықтау қажет.

Ресми негіздер: [pg pooling](https://node-postgres.com/features/pooling),
[transactions](https://node-postgres.com/features/transactions),
[TLS](https://node-postgres.com/features/ssl),
[PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).

## Stage 4 — Public REST API

| Endpoint | Нәтиже |
| --- | --- |
| `GET /api/health` | Процесс liveness, DB readiness емес |
| `GET /api/programs` | Тек published, non-DEMO бағдарламалар |
| `GET /api/programs/:id` | UUID бойынша published бағдарлама; қалғаны 404 |
| `GET /api/categories` | Published бағдарламаларда қолданылған категориялар |
| `GET /api/regions` | Published бағдарламаларда қолданылған өңірлер |
| `POST /api/contact-messages` | JSON хабарламаны сақтау; тек жаңа UUID қайтады |

List query: `page` (1–10000, default 1), `limit` (1–50, default 20).
Programs қосымша query: `category` және `region` — taxonomy slug; `age` — бүтін
0–17, min/max шекаралары кіреді; `q` — title/description ішінен регистрге тәуелсіз
мәтін іздеу, 200 таңбаға дейін. Бос q барлық нәтижені береді; `%`, `_`, `\`
таңбалары wildcard емес, literal мәтін болып ізделеді. Бар сүзгілер AND арқылы
қиылысады. Белгісіз query keys және қайталанған scalar параметрлер — 400.
Бұл age шегі өнімнің балаға арналған ауқымы, ресми eligibility ережесі емес.

```text
GET /api/programs?category=some-category&region=some-region&age=6&q=іздеу&page=1&limit=20
```

List response: `{"data":[],"pagination":{"page":1,"limit":20,"total":0,"totalPages":0}}`.
Page нәтижесіз болса да total сақталады. Тұрақты id бойынша өсу реті қолданылады.
Total/data бір SQL snapshot-та есептеледі. Taxonomy bigint ID-лері JSON-да string.
Details response: `{"data":{...}}`; program fields: id, slug, category (slug),
title, description, sourceUrl, sourceName, verifiedAt (timestamp), ageMin, ageMax,
deadline (date немесе null), applyUrl, isDemo, regions (slug[]), familyCategories (slug[]).
Public records үшін `isDemo=false`; нақты DEMO-лар draft күйінде қалып, API-ге шықпайды.
Development seed тек DEMO болғандықтан public list/taxonomy қазір бос — бұл қалыпты.
Ешқандай мемлекеттік дерек не жалған published бағдарлама қосылмады.

Contact body (тек осы үш key, қосымша өрістер қабылданбайды):

```json
{"senderName":"TEST sender","email":"test@example.com","message":"TEST message"}
```

Name: trim, 1–100; email: жарамды, ≤254; message: trim, 1–2000 таңба.
Content-Type application/json міндетті. Жауап: 201 `{"data":{"id":"UUID"}}`.
Хабарлама plain text ретінде сақталады; SQL/HTML ретінде орындалмайды.
Message/email/name жауапта не logs ішінде қайтарылмайды. Оқу/list/admin endpoint жоқ.
Contact әр IP үшін 15 минутта ең көбі 5 әрекетпен шектелген (жарамсыз әрекеттер де
саналады), жалпы API лимиті де қолданылады. Шектен асса 429 + Retry-After.
POST автоматты қайталауға қауіпсіз емес: қайталау жаңа хабарлама жасайды.
IIN/медициналық мәлімет немесе құпия жібермеңіз; еркін мәтіннің мазмұнын толық
жіктейтін функция жоқ. Болашақ frontend plain text-ті escape етіп көрсетуі тиіс.

Барлық сыртқы query/UUID/body Zod арқылы тексеріледі. Қате форматы бұрынғыдай
`{"error":{"code":"...","message":"..."}}`; input echo/stack trace жоқ.
400 — invalid input; 404 — жоқ/жарияланбаған program; 405 + Allow — қате әдіс;
415 — қате media type; 429 — rate limit; 500 — ішкі/DB қате.
Development/test-та DATABASE_URL болмаса health жұмыс істейді, ready және жарамды
DB API сұрауы 503 қайтарады; production мұндай конфигурациямен іске қосылмайды.
Барлық SQL дерек мәндері параметрленген; identifiers және SELECT fragments
тек repository ішіндегі тұрақтылар. Schema/migrations өзгертілмеді.

API файлы: `src/api/{schemas,repository,routes}.ts`; pool app factory-ге беріледі.
Production role-ға қосымша contact_messages INSERT және RETURNING үшін id SELECT
қажет; contact message/email/name SELECT бермеңіз. Local postgres суперпайдаланушысын
production-ға қолданбаңыз. Сұрау timeout, TLS, proxy және shared limiter шектері
алдыңғы бөлімдердегідей. Stage 8.2 cleanup командасы бар, scheduling әлі қосылмаған.

Тексеру: `npm.cmd test` және `npm.cmd run test:db`. API integration тек test database-ке
қосылып, published/draft/verified және transient DEMO fixtures қолданады; барлық
fixtures/contact жазбалары rollback болады, DEMO seed шақырылмайды. Stage 3 migration
тесттері де сақталды. Нақты server startup/read/pool shutdown бөлек smoke тексерілді.
Ресми негіз: [pg parameterized queries](https://node-postgres.com/features/queries),
[Express request input](https://expressjs.com/en/5x/api/), [Zod](https://zod.dev/api).

## Stage 5 frontend integration

React frontend public API-ге қосылды: [frontend README](../balaqoldau/README.md).
Development Vite proxy `/api` → `127.0.0.1:3001`; backend келісімшарты/schema
өзгерген жоқ. DEMO draft-тар public endpoint-ке шықпайды, frontend бос күй көрсетеді.
Contact form қолданыстағы POST endpoint-ті қолданады. Backend 71/71, DB integration
12/12 тесті қайта орындалып өтті. Browser suite development backend-ке тек GET
жібереді; contact UI fixture арқылы, нақты SQL/HTTP backend integration арқылы
тексеріледі. Stage 6 frontend UI/accessibility шолуы да аяқталды: API/schema
келісімшарты өзгерген жоқ; backend 71/71 және DB integration 12/12 қайта өтті.
Stage 7: [deployment/least-privilege/migration/rollback](../docs/DEPLOYMENT.md),
[security/contact retention](../docs/SECURITY.md), production env мысалы —
`.env.production.example`. Рөлдер өзгермеді; cleanup command бар, scheduling қосылмады; нақты verification
нәтижесі [PROGRESS](../PROGRESS.md) ішінде. Production іске қосылған жоқ.
