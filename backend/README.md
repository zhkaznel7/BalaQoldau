# BalaQoldau backend — Stages 2–7

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
- `src/middleware/errors.ts`: орталық JSON error handler.
- `src/server.ts`: HTTP startup, уақыт шектеулері, SIGINT/SIGTERM shutdown.
- `tests/`: localhost HTTP, environment және startup тесттері; сыртқы сервис қажет емес.

Health тек процесс жауап бере алатынын көрсетеді; дерекқор readiness тексеруі емес.
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
  HTTP server үшін DATABASE_URL optional (health-only жұмысын сақтау үшін);
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
DATABASE_URL болмаса health жұмыс істейді, жарамды DB API сұрауы 503 қайтарады.
Барлық SQL дерек мәндері параметрленген; identifiers және SELECT fragments
тек repository ішіндегі тұрақтылар. Schema/migrations өзгертілмеді.

API файлы: `src/api/{schemas,repository,routes}.ts`; pool app factory-ге беріледі.
Production role-ға қосымша contact_messages INSERT және RETURNING үшін id SELECT
қажет; contact message/email/name SELECT бермеңіз. Local postgres суперпайдаланушысын
production-ға қолданбаңыз. Сұрау timeout, TLS, proxy және shared limiter шектері
алдыңғы бөлімдердегідей. Contact retention policy автоматты түрде жасалған жоқ.

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
`.env.production.example`. Рөлдер/retention automation жасалған жоқ; нақты verification
нәтижесі [PROGRESS](../PROGRESS.md) ішінде. Production іске қосылған жоқ.
