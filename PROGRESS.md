# BalaQoldau — даму барысы

Ағымдағы күй: Stage 8.2 Contact Privacy & Retention аяқталды (2026-11-12): cleanup командасы бар, scheduling қосылмаған. Public launch орындалған жоқ; production/оператор талаптары сақталады. Stage 8.3 басталған жоқ. Ертерек жазбалар тарихи есеп ретінде сақталған.

## Stage 1

Тексерілген күн: 2026-11-11 (Asia/Qyzylorda).
Күйі: Stage 1 аяқталды. Backend әзірлеуі басталған жоқ.

## Орындалған жұмыс

- Ағымдағы тармақ: `development`; тармақ ауыстырылмады.
- Бұрынғы `balaqoldau/src/App.tsx` өзгерістері сақталды; үш `react-hooks/set-state-in-effect` қатесі түзетілгені расталды. Бұл тексеруде код қайта өзгертілмеді.
- Таңдаулыларды сақтау оқиға өңдегішінде орындалады; оқу/жазу қатесі өңделеді.
- Мобильді мәзір жол өзгергенде кілт арқылы қайта ашылады; Escape және фокусты қайтару логикасы сақталған.
- Іздеу сұрауы өзгергенде бастапқы жүктеу күйі қалпына келеді; ескі асинхронды нәтиже еленбейді.
- Тәуелділіктер, UI дизайны өзгертілмеді. Push/deploy орындалмады.

## Нақты тексеру нәтижелері

- `npm.cmd run build`: PASS, exit 0.
- `npm.cmd run lint`: PASS, 0 қате, exit 0.
- `npm.cmd test`: PASS, 5/5, exit 0.
- `git diff --check`: PASS; Git LF → CRLF туралы ақпараттық ескерту берді.
- `npm.cmd audit --json`: exit 1; 10 moderate, 0 high, 0 critical. Желі жауабы кешіккенде шектеулі күту уақытымен қайталанған аудит те осы нәтижені берді.

## Қалған мәселелер

- Аудит ескертулері `minimatch@10.2.6` осалдығының ESLint/TypeScript-ESLint әзірлеу құралдары арқылы таралуына қатысты: `@eslint/config-array`, `@eslint/js`, `eslint`, `typescript-eslint`, `@typescript-eslint/{eslint-plugin,parser,type-utils,typescript-estree,utils}`, `minimatch`.
- Advisory: https://github.com/advisories/GHSA-g3hv-75wg-m249. Автоматты түзету немесе пакет жаңарту орындалмады.
- Алдыңғы production-only аудитте 0 осалдық болған; осы Stage 1 тексеруінде `--omit=dev` қайта орындалмады.
- Браузерлік регрессия сценарийлері осы кезеңде орындалмады; бес тест іздеу деректерінің логикасын тексереді, толық UI мінез-құлқын растамайды.
- `App.tsx` түзетулері әлі commit жасалмаған.

## Келесі кезең (басталған жоқ)

Браузерде таңдаулыларды сақтау/өшіру, storage бұғатталуы, мобильді мәзір, Escape/фокус және жылдам іздеу өзгерістерін тексеру. Тәуелділіктерді түзету жоспарын бөлек келісу. Backend тек кейінгі нақты тапсырмамен басталады.

## Stage 2 — Backend Foundation (аяқталды)

Күні: 2026-11-11. Ағымдағы тармақ: `development`; `main` өзгертілмеді.

### Орындалған жұмыс

- Frontend-тен тәуелсіз түбірлік `backend/` npm пакеті, exact dependency нұсқалары және бөлек `package-lock.json` қосылды. Frontend пакет/lockfile және UI өзгертілмеді; бұрынғы `App.tsx` түзетулері сақталды.
- Runtime: Express 5.3.0, Zod 4.6.7, Helmet 8.3.0, CORS 2.8.6, express-rate-limit 8.7.4. TypeScript 5.9.3 және қажетті Node/Express/CORS типтері ғана қосылды.
- Пакеттердің npm registry нұсқа/лицензия/repository мәліметтері ресми жобалармен салыстырылды. Орнату `--ignore-scripts` арқылы жүргізілді; транзитивтік install scripts орындалмады. Metadata мен audit толық supply-chain кепілі емес.
- Strict TypeScript, native Node environment loading, Zod environment тексеруі қосылды. Қате мәндер startup кезінде қабылданбайды және журналға шықпайды.
- `GET /api/health` → 200 `{"status":"ok"}`; query валидациясы және орталық JSON error handler бар. Ішкі қате/stack trace ешбір ортада клиентке берілмейді.
- Helmet, exact environment origin allowlist, credentials-сіз CORS, API IP rate limiting, 16 KiB JSON лимиті, HTTP уақыт шектеулері және graceful shutdown қосылды.
- Түбірлік `.gitignore` environment файлдарын, backend node_modules/dist-ті елемейді; `.env.example` Git үшін ашық. Нақты `.env` жасалмады.
- Іске қосу, API келісімшарты және пайдалану шектері `backend/README.md` ішінде жазылды.
- PostgreSQL, authentication, admin, AI, tracking және frontend API интеграциясы қосылған жоқ. Push/deploy жасалған жоқ.

### Нақты тексеру нәтижелері

- Backend `npm.cmd test`: strict build PASS (exit 0), **39/39 тест PASS**, skipped 0.
- Тесттер: health/headers, query, environment шекаралары, exact CORS және preflight, 404/400/413/500 жауаптары, rate limit/Retry-After, development source loading, қате startup және production HTTP startup.
- TDD: алғашқы тест іске асыру жоқ кезде өтпеді. Алғашқы build Zod `.default().regex()` ретін қабылдамады; түзетілді. Development startup тесті Node strip-only режиміндегі constructor parameter property қатесін анықтады; explicit class fields және `erasableSyntaxOnly` арқылы түзетілді. Соңғы толық suite өтті.
- Frontend `npm.cmd run build`: PASS, exit 0.
- Frontend `npm.cmd run lint`: PASS, exit 0, 0 қате.
- Frontend `npm.cmd test`: PASS, **5/5**, exit 0.
- Backend `npm.cmd audit --json`: **0 осалдық**, exit 0.
- Frontend `npm.cmd audit --json`: **10 moderate**, high/critical 0, exit 1; Stage 1-де жазылған ESLint/minimatch әзірлеу құралдары.
- Frontend `npm.cmd audit --omit=dev --json`: **0 осалдық**, exit 0. Автоматты dependency fix жасалған жоқ.
- Git ignore тексеруі: backend `.env`, `.env.production`, node_modules/dist еленбейді; `.env.example` еленбейді деген ереже жоқ, commit жасауға болады.

### Қалған шектер және келесі кезең

- In-memory limiter бір процеске арналған; restart кезінде тазарады. Көп instance/serverless үшін ортақ store немесе edge limiter қажет.
- `trust proxy=false`; reverse proxy артында нақты topology негізінде бөлек баптау керек. TLS/firewall сыртқы hosting деңгейінде қамтамасыз етіледі. Бұл өзгеріс deploy жасалғанын білдірмейді.
- Health тек процесс liveness көрсетеді, database readiness емес.
- Frontend-тің 10 moderate development finding-ін түзету бөлек келісуді қажет етеді; қайта қарау — келесі dependency-maintenance тапсырмасында, production release алдында.
- Браузерлік frontend регрессия тексеруі және deployment shutdown/proxy/TLS тексеруі әлі қажет.
- Келесі кезең: backend review және frontend регрессиялары; тек бөлек тапсырма мен migration мақұлдауынан кейін PostgreSQL және тексерілген каталог API жоспары. Stage 3 басталған жоқ.

### Қысқа командалар

`cd backend` → `npm.cmd ci --ignore-scripts` → `.env.example` файлын жаңа `.env` ретінде көшіру → `npm.cmd run dev`.
Production: `npm.cmd run build` → environment баптау → `npm.cmd start`.
Қолданыстағы `.env` файлын қайта жазбаңыз. Толық нұсқаулық: `backend/README.md`.

## Stage 2 — Final Review (2026-11-11)

### Қауіпсіздік және регрессия шолуы

- Zod: міндетті exact origin тізімі, HTTP(S) схемасы, порт/IP/сандық шектеулер, бос және жарамсыз мәндерді қабылдамау тексерілді. Config қатесі мәндерді журналға шығармай startup-ты тоқтатады.
- Helmet: CSP, HSTS, nosniff және frame тақырыптары тексерілді; `x-powered-by` жоқ. `GET`/`HEAD` health JSON/body мінез-құлқы, query валидациясы, no-store тексерілді.
- CORS: exact allowlist, рұқсатсыз/suffix/null origin-ге 403, allowed/blocked preflight, credentials жоқ екені тексерілді. Origin жоқ серверлік health clients рұқсат етіледі; CORS auth емес.
- Rate limiting: 429, Retry-After, preflight санауы және `trust proxy=false` тексерілді. Жалған X-Forwarded-For мәнін ауыстыру IP лимитін айналып өтпейтіні жаңа HTTP тестімен расталды.
- Error handling: 400/404/413/415 және жалпы 500 JSON жауаптары тексерілді; production startup/response арқылы stack trace не тест құпиясы шықпайды. Қысылған JSON-ға 415 тесті қосылды.
- `.env`, `.env.production`, frontend `.env`/`.env.local` Git ignore арқылы қорғалған; tracked environment файлдары табылмады. `.env.example` ішінде тек құпия емес мысал конфигурациясы бар.
- Development source import, жарамсыз production startup және нақты production HTTP startup тесттері өтті.

### Расталған ақау және минималды түзету

`backend/src/server.ts`: graceful shutdown сәтті аяқталса да deadline таймері тазаланбайтын. Процесте басқа белсенді жұмыс қалса, кейін жалған `Backend shutdown timed out` және exit 1 туындауы мүмкін еді. Жаңа тест осы қатемен алдымен FAIL болды; close callback ішінде `clearTimeout(deadline)` қосылғаннан кейін PASS болды. Windows OS signal жеткізуін тексеру үшін емес, Node сигнал өңдегішін `process.emit('SIGTERM')` арқылы тексеру және mock timer арқылы deadline-ды жылжыту үшін child process қолданылды.

Осы review өзгерткен файлдар: `backend/src/server.ts`, `backend/tests/startup.test.mjs`, `backend/tests/app.test.mjs`, `PROGRESS.md`. Frontend және dependency файлдары өзгертілмеді.

### Нақты қорытынды тексерулер

- Backend `npm.cmd test`: strict TypeScript build PASS, **43/43 PASS**, exit 0; skipped 0.
- Frontend `npm.cmd run build`: PASS, exit 0.
- Frontend `npm.cmd run lint`: PASS, exit 0.
- Frontend `npm.cmd test`: **5/5 PASS**, exit 0.
- Backend `npm audit --json`: **0 осалдық**, npm exit 0.
- Frontend `npm audit --json`: **10 moderate**, high/critical 0, npm exit 1. Бұрынғы ESLint/minimatch development findings сақталған; automatic fix орындалмады.
- Браузерлік `tests/browser-check.mjs` бөлек headless Chrome профилі және уақытша Vite процесімен іске қосылды, бірақ алғашқы CDP `Page.enable` сұрауында `Detected unsettled top-level await` қатесімен exit 1 аяқталды. Браузерлік QA **PASS емес**. Тек осы тексеруге ашылған процестер тоқтатылды; оқшауланған профиль/артефактілер Git елемейтін `node_modules/.cache` ішінде. Қолданыстағы пайдаланушы браузеріне қосылмады.
- `development` тармағы сақталды, `main` әлі `b84e459c0d808729d606c2dbedfc061bf75aa72e`. PostgreSQL, push/deploy және пакет орнату орындалмады.

### Қалған тәуекелдер

In-memory limiter бір процеске ғана арналған; proxy trust/TLS/edge шектеулері deployment алдында нақты топологиямен тексерілуі керек. Рұқсатсыз Origin CORS қабатында rate limiter-ге жетпей қайтарылады; traffic DoS қорғанысы үшін edge лимиті қажет. Браузерлік CDP QA ақауын бөлек тексеріп, таңдаулылар/мобильді мәзірдің runtime регрессиясын қайта жүргізу қажет. Frontend moderate findings — келесі dependency-maintenance тапсырмасында және release алдында қаралады. Windows-та нақты OS graceful signal жеткізуі және белсенді сұраулармен shutdown deadline бөлек deployment тексеруін қажет етеді. Stage 3 басталған жоқ.

## Stage 3 — PostgreSQL layer (2026-11-11)

### Дайын код

- `pg@8.23.1`, `@types/pg@8.23.1` ресми registry repository/лицензия мәліметтері тексеріліп, exact нұсқалармен `--ignore-scripts` арқылы backend-ке ғана орнатылды.
- `src/db/config.ts`, `pool.ts`: Zod PostgreSQL URL/TLS валидациясы, bounded pool (max 5), connection/statement/query/lock timeout, транзакция/rollback/release. Production сертификатты тексеруді міндеттейді; URL query параметрлері TLS саясатын өзгерте алмайды. Қателер connection string немесе credentials шығармайды.
- `DATABASE_URL` health-only HTTP режимін сақтау үшін жалпы env схемасында optional, берілсе валидацияланады; DB командалары үшін міндетті. `TEST_DATABASE_URL` бөлек `_test` базаға бағытталуы керек және application база атауымен сәйкес келмеуі тиіс.
- `migrations/001_initial.sql`: categories, regions, family_categories, programs, program_regions, program_family_categories, contact_messages; PK/FK/UNIQUE/CHECK/индекстер. Бала жасы 0–17 және min≤max — қолданыстағы өнім ауқымы, мемлекеттік eligibility туралы мәлімдеме емес.
- Draft/verified/published статустары, source_url/source_name/verified_at/age_min/age_max/deadline/apply_url бар. Verified/published жазбаға source+verification міндетті.
- `published_programs` view тек published non-DEMO жазбаларды береді. PUBLIC schema/table рұқсаттары алынған; Stage 4 үшін бөлек runtime role-ға view SELECT ғана беру қажет. Қазір ешқандай program API жоқ.
- `src/db/migrate.ts`, `cli.ts`: version/checksum history, advisory transaction lock, atomic pending migrations, бұрынғы history өзгерсе fail closed. SQL checksum алдында CRLF→LF қалыптандырылады. Автоматты reset/drop жоқ.
- `seed.ts`: екі анық DEMO draft бағдарлама, бөлек DEMO taxonomy, тек example.com HTTPS URL-дері. Parameterized SQL, ON CONFLICT DO NOTHING; нақты жазбаларды қайта жазбайды. DEMO жариялауға SQL CHECK тыйым салады.
- Contact кестесі ғана бар, endpoint те, дерек жинау да жоқ; IIN/медициналық өрістер жоқ.
- `.env.example`, backend package/lockfile және README жаңартылды; setup/migrate/seed/test командалары және қауіпсіздік шектері құжатталды. `ARCHITECTURE.md` түбірде жоқ. Frontend және main өзгертілмеді.

### Нақты тексеру нәтижелері

- Backend `npm.cmd test`: strict build PASS; **54/54 PASS**, skipped 0. Оның ішінде DB URL/TLS, test DB guard, pool bounds, config жоқта және қолжетімсіз localhost портында script fail-safe тексерілді.
- `npm.cmd run test:db`: **FAIL, exit 1**, parent test 0/1; `TEST_DATABASE_URL` жоқ болғандықтан конфигурация шекарасында тоқтады. Миграция/constraints/seed integration assertions нақты PostgreSQL-де орындалған жоқ. PASS деп есептелмейді.
- PostgreSQL 18.6 орнатылған: `C:\Program Files\PostgreSQL\18\bin\psql.exe`. `pg_isready -h 127.0.0.1 -p 5432 -t 2` → accepting connections; `postgresql-x64-18` service Running. PATH-та болмағандықтан алғашқы command lookup таппаған. Қызметті осы тапсырма іске қоспады.
- `DATABASE_URL`, `TEST_DATABASE_URL`, `backend/.env` жоқ. Құпияларды іздеу/болжау не қолданыстағы базаға credentials-пен кіру жасалмады. Нақты базада migration/seed орындалмады, база reset/delete жасалмады.
- Frontend build PASS, lint PASS, tests **5/5 PASS**, exit 0.
- Backend audit: **0 осалдық**, exit 0. Frontend audit: **10 moderate**, high/critical 0, exit 1 (бұрынғы dev tooling); fix/upgrade жасалмады.

### Блокерді шешу және келесі әрекет

Толық оператор командалары: `backend/README.md` → Stage 3 PostgreSQL бөлімі. `psql -W` арқылы бөлек owner/test role және `balaqoldau`/`balaqoldau_test` базаларын қолмен дайындау, `.env` ішіне нақты URL-дерді құпия түрде қою қажет. Миграция SQL-ін мақұлдағаннан кейін backend ішінде `npm.cmd run build`, `npm.cmd run db:migrate`, `npm.cmd run db:seed`, `npm.cmd run test:db` орындау керек. Integration tests dedicated test DB-ге migration/seed қалдырады, constraint тест жазбаларын rollback етеді; басқа базаны тазаламайды.

Stage 3 толық верификацияланған жоқ: нақты DB шектеулері, миграция тарихы, seed idempotency және published view мінез-құлқы integration suite өткеннен кейін ғана расталады. Owner credential-ді кейін public API үшін қолдануға болмайды; арнайы runtime grants қажет. Браузерлік QA және бұрынғы moderate findings Stage 2 есебінде қалады. Stage 4, API endpoint, frontend DB integration, push/deploy басталған жоқ.

## Stage 3 — нақты PostgreSQL verification (2026-11-11)

### Авторизация және target қауіпсіздігі

- `pgpass.conf` бар екені Test-Path арқылы, авторизациясы `psql -X -w` және pg driver арқылы расталды. Мазмұны қолмен оқылған, көрсетілген немесе журналға шығарылған жоқ. Пароль сұралмады/көшірілмеді.
- Екі identity: `balaqoldau_dev` / `balaqoldau_test`, user `postgres`, server `127.0.0.1:5432`. Алғашқы pg тексеруінде inet text `/32` маскасымен келгендіктен assertion өтпеді; SQL `host(inet_server_addr())` арқылы қайта тексеріліп, екі target дәл расталды. Бұл авторизация қатесі емес, дерек өзгерісі болған жоқ.
- Екі target те қолданар алдында бос болды (user tables/views 0). `.env` эксклюзивті жаңа файл ретінде жасалды, бұрынғы файл қайта жазылған жоқ. Онда password-free URL-дер және local `DB_SSL_MODE=disable` бар. Git ignore расталды.
- `balaqoldau_db` немесе басқа базаға қосылу/DDL/DML жасалған жоқ. Ешбір database/role жасалмады, reset/drop/truncate/delete орындалмады.

### Миграция және seed нәтижелері

- Қолданыстағы `001_initial.sql` екі базаға қолданылды: әрқайсысына 1 migration.
- Әр базаға қайталап орындау: 0 migration; schema_migrations version/checksum/applied_at өзгеріссіз.
- `seedDemo` тек `balaqoldau_dev` ішінде екі рет орындалды. Екі іске қосудың арасында алты каталог/байланыс кестесіндегі жолдар, ID және timestamp өзгеріссіз.
- Development: 2 DEMO, екеуі draft; source/apply host — example.com; published view 0 жол.
- Integration suite DEMO seed-ті test database-ке енгізбейтіндей түзетілді. Оның орнына constraint TEST fixtures бір транзакцияда жасалып, соңында ROLLBACK етіледі. Migration тарихы test базасында қалады.
- Соңғы SQL тексеру: `balaqoldau_test` ішіндегі жеті application кестесінде барлығы 0 дерек жолы; migration history 1 жол. Development history 1, programs 2, DEMO drafts 2, published 0.

### Орындалған verification командалары

- Backend `npm.cmd run build`: PASS, exit 0.
- Backend `npm.cmd test`: strict build PASS, **54/54 PASS**, skipped 0, exit 0.
- Backend `npm.cmd run test:db`: strict build PASS, **4/4 PASS** (3 subtest + parent), skipped 0, exit 0. Checksums/idempotency, test DB-де DEMO жоқтығы, CHECK/FK/duplicate link/publication visibility тесттері нақты PostgreSQL-де өтті.
- Frontend `npm.cmd run build`: PASS, exit 0.
- Frontend `npm.cmd run lint`: PASS, exit 0.
- Frontend `npm.cmd test`: **5/5 PASS**, exit 0.
- Audit бұл verification тапсырмасында қайта орындалмады; соңғы Stage 3 audit: backend 0, frontend 10 moderate dev-tooling findings (жоғарыдағы есеп).
- Өзгерген файлдар: integration test, backend README, PROGRESS.md және Git елемейтін password-free backend/.env. Frontend коды/тәуелділіктер өзгертілмеді. Main әлі `b84e459c0d808729d606c2dbedfc061bf75aa72e`; тармақ `development`.

### Қалған шектер

`pg@8.23.1` pgpass үшін deprecation warning шығарады; pg 9 алдында авторизацияны жаңарту керек. Қазіргі нұсқада қосылым сәтті. `postgres` local setup үшін ғана пайдаланылды; public API алдында least-privilege runtime role/view grants және production TLS қажет. Бұрынғы frontend moderate findings және браузерлік QA мәселесі шешілмеген. Stage 4, API/frontend DB integration, push/deploy басталған жоқ.

## Stage 4 — Backend API (2026-11-11)

### Орындалған жұмыс

- `src/api/schemas.ts`: Zod strict query/UUID/body schemas; category/region slugs, age 0–17, q ≤200, page 1–10000, limit 1–50 (default 20). Unknown keys, arrays/scalar дубликаттар, fractional/negative age және control chars қабылданбайды.
- `src/api/repository.ts`: parameterized pg queries, published_programs view ғана, draft/verified/DEMO ешқашан public list/details-ке шықпайды. Filter intersection, literal ILIKE search (wildcards escaped), бір SQL statement ішінде total/data, бос page metadata бар.
- `src/api/routes.ts`: GET programs, programs/:id, categories, regions; POST contact-messages. Taxonomy тек published-associated rows. Data/error JSON форматы тұрақты, 400/404/405/415/429/500/503 статус кодтары бар.
- Contact тек senderName/email/message қабылдайды, 201 жауабында UUID ғана; request input/PII/DB қате мәліметтері журналға шықпайды. GET/contact admin endpoint жоқ. 5 әрекет / 15 минут / IP бөлек limiter қосылды. CORS POST preflight рұқсаты environment allowlist-пен қорғалған.
- app.ts database dependency қабылдайды; server.ts DATABASE_URL барда pool құрып, shutdown/listen error кезінде жабады. DB конфигурациясы жоқта бұрынғы health режимі сақталады, DB API 503 береді. URI decode қателері generic 400 болды.
- README API query/body/response келісімшартын және өндірістік рұқсат/дерек қауіпсіздігі шектерін сипаттайды.
- Жаңа dependency, schema migration, frontend өзгерісі жоқ. Stage 3 тесттері сақталды. `balaqoldau_db` немесе unrelated базаға қосылу/өзгерту жасалмады.

### Нақты verification

- TDD: API schema тесті код жоқ кезде ERR_MODULE_NOT_FOUND арқылы FAIL болды; іске асырудан кейін толық suite PASS.
- Backend `npm.cmd test`: strict TypeScript build PASS, **71/71 PASS**, skipped 0, exit 0.
- Backend `npm.cmd run test:db`: strict build PASS, **12/12 PASS** (API 7 subtests + parent, Stage 3 3 subtests + parent), skipped 0, exit 0.
- PostgreSQL API integration: successful lists/details/taxonomy/contact, pagination/out-of-range page, age boundaries/filter intersection, unpublished/DEMO exclusion, UUID/query/body validation, literal SQL injection/%/_/backslash inputs, POST CORS, contact limits. Барлық fixtures және contact messages бір test транзакциясында rollback етілді.
- Соңғы read-only SQL: balaqoldau_test ішіндегі жеті application кестесінде барлығы **0 жол**. Қолданыстағы migration history сақталған.
- Нақты server smoke: development .env арқылы start, health/programs/categories/regions 200; DEMO-only development DB үшін public lists бос. SIGTERM handler арқылы HTTP server + pool clean shutdown, exit 0. Windows OS signal delivery емес, Node handler тексерілді.
- Frontend build PASS, lint PASS, tests **5/5 PASS**, exit 0.
- Backend npm audit: **0 осалдық**, exit 0. Frontend audit: **10 moderate**, high/critical 0, exit 1; бұрынғы ESLint/minimatch dev tooling, automatic fix жасалмады.
- git diff --check PASS (бұрынғы App.tsx LF/CRLF ақпараттық ескертуі ғана). Main әлі b84e459c0d808729d606c2dbedfc061bf75aa72e, тармақ development; push/deploy жоқ.

### Өзгерген файлдар және қалған мәселелер

`backend/src/api/{schemas,repository,routes}.ts`, `src/app.ts`, `src/server.ts`, `src/middleware/errors.ts`, `tests/api.test.mjs`, `tests/integration/api.test.mjs`, `tests/app.test.mjs` (CORS POST expectation), `backend/README.md`, `PROGRESS.md`.

Production алдында least-privilege runtime role қажет: public view/taxonomy/links SELECT, contact INSERT + id SELECT ғана; жергілікті postgres superuser production үшін жарамайды. Contact жеке дерек жинауы тек сұралған name/email/message өрістерімен іске қосылды; consent/retention және еркін мәтін sensitive-data саясаты deployment алдында анықталуы тиіс. IIN/медициналық өрістер не frontend form қосылған жоқ. Shared rate limiter/proxy/TLS, pgpass deprecation, бұрынғы frontend dev vulnerabilities және browser QA мәселелері сақталады. Stage 5 басталған жоқ.

## Stage 5 — Frontend and Backend Integration (2026-11-11)

### Орындалған жұмыс

- Frontend api/{client,service,navigation,contact}.ts: typed fetch, response boundary checks, localized safe errors, 15s timeout/abort, credentials omit/no-store. Backend DB configuration browser-ге көшірілмейді.
- App.tsx search/results/details/favorites үшін нақты API қолданады. Documents/eligibility ойдан толтырылмайды; DEMO/private payload пен unsafe external links қабылданбайды. Қазір нақты published record жоқ, honest empty state көрсетіледі.
- Ортақ CatalogProvider API category/region names/slugs жүктейді. Category navigation filtered results ашады. Actual query: category/region/age/q/page/limit; backend қолдамайтын family filter қолдау түрімен алмастырылды, schema өзгерген жоқ.
- Loading/empty/error/retry, pagination/page reset, query/ID keys және AbortController stale нәтижені болдырмайды. Favorites UUID max 50, public detail fetch, unavailable 404 жасыру, storage failure fallback және clear бар.
- Бұрын contact form болмаған: бар стильмен /contact және footer link қосылды. Field validation/errors/focus, pending/duplicate guard, success reset, explicit retry және network/5xx duplicate warning. Inputs URL/logs/storage-ға жазылмайды. IIN/medical құпия жібермеу ескертуі бар.
- .env.example, Vite proxy, strict TypeScript + DOM.Iterable қосылды. Public VITE_API_BASE_URL ғана browser-ге өтеді, API_PROXY_TARGET server-side.
- Kazakh UI/hero/responsive дизайн сақталған; pagination/contact CSS ғана қосылды. Source DEMO fixture тек legacy tests/қолданылмайтын preview-де қалды; runtime беттер импорттамайды, bundle-ға кірмейді. Ескі browser-check entry жаңа suite-ке бағытталды.

### Нақты verification

- TDD: API tests implementation жоқ кезде FAIL болды. Соңғы frontend npm test: **23/23 PASS**, skipped 0, exit 0 (18 жаңа contract/navigation/contact + 5 legacy fixture).
- Frontend build PASS, lint PASS, exit 0. Алғашқы DOM iterable/control-regex қателері тип/character-code validation арқылы түзетілді, lint rules өшірілмеді.
- Browser npm run test:browser: **11/11 PASS**, exit 0, бөлек owned Chrome profile/ports/servers. Sandbox ішінде CDP Page.enable timeout болды; sandbox-тен тыс рұқсат етілген іске қосу өтті. Personal browser/session қолданылмады.
- Browser PowerShell ASCII pipeline кесірінен жаңа App copy ішіндегі '?' регрессиясын тапты; UTF-8 patch арқылы түзетілді. Interception scope және retry fixtures React StrictMode-ға сәйкестендірілді; соңғы suite түгел қайта өтті.
- Нақты **React → Vite proxy → Express → PostgreSQL** GET ағыны расталды. Development public list бос; DEMO draft мемлекеттік мүмкіндік ретінде көрсетілмейді. Ешқандай published бағдарлама базаға қосылмады.
- Browser TEST HTTP fixtures: category/region slugs, age 0, pagination/reset, error/retry, stale abort, favorites persistence/removal, DEMO reject/detail 404, catalog retry, contact pending/errors/manual retry/success/duplicate guard, 4 viewport/menu/Escape/focus.
- Browser contact POST mock болды; UI→real contact write-through бір browser сценарийінде орындалмады. Нақты POST/SQL backend integration арқылы бөлек тексерілді. Development database-ке browser хабарлама жазбады.
- Backend npm test: strict build PASS, **71/71 PASS**, skipped 0, exit 0.
- Backend npm run test:db: strict build PASS, **12/12 PASS**, skipped 0, exit 0. Соңғы SQL: test DB-нің жеті application кестесінде 0 fixture/contact жолы.
- Backend audit **0 осалдық**, exit 0. Frontend audit **10 moderate**, high/critical 0, exit 1 (бұрынғы dev tooling). Dependencies/lockfiles жаңартылмады.
- Frontend dist scan: PostgreSQL connection string, DATABASE_URL, balaqoldau_db reference табылмады. Бүлінген '?' тізбектері жоқ. git diff --check PASS (App.tsx LF/CRLF ақпараттық warning ғана).

### Өзгерген файлдар және қалған шектер

Frontend App.tsx, SupportFinder/DiscoverySearch, жаңа CatalogProvider/Contact/RequestState, api/*, hooks/*, refinements.css, vite.config.ts, tsconfig.app.json, .env.example, package.json scripts, tests/api.test.mjs, tests/browser-integration.mjs, legacy browser-check entry, frontend/backend README және PROGRESS.md. Backend source/API/schema өзгертілмеді.

Production reverse proxy/public API base/CORS баптауы бөлек қажет. Least-privilege DB role/TLS/shared limiter/contact consent-retention және pgpass deprecation — бұрынғы deployment шектері. Frontend 10 moderate dev findings сақталған. Main b84e459c0d808729d606c2dbedfc061bf75aa72e және development тармағы өзгермеді; balaqoldau_db/unrelated базаларға қосылу/өзгерту, Stage 6, push/deploy болған жоқ.

## Stage 6 — UI/UX, Mobile Responsiveness, Accessibility (2026-11-11)

### Бастапқы шолу және тәсіл

- README, project frontend/TDD/security/review/performance нұсқаулары оқылды. Installed UI/UX Pro Max existing-UI checklist қолданылды; Python CLI search/design-system генерациясы қажет болмады. Unslop skill қолжетімді каталогтардан табылмады.
- Өзгерістерден бұрын алты беттің desktop/320px baseline скриншоттары және DOM өлшемдері алынды, суреттер визуалды қаралды. Бар purple/mint, Segoe UI, logo және hero photograph сақталды; stock SaaS/dashboard элементтері қосылмады.
- Бастапқы computed text contrast тексеруінде AA қатесі болмады. Desktop footer links 21px биіктік, skip-link main focus ақауы, қайталанатын category grid placement қаупі және SPA context мәселелері анықталды.

### Өзгерістер

- App/RouteAccessibility: focusable main, route title/focus, hash target focus, header Contact link, mobile/tablet disclosure (Enter/Tab/Escape/focus-out), external-link description, decorative icons aria-hidden.
- Search completion polite count хабарлайды; background response пайдаланушы жазып отырған input-тен focus ұрламайды. Detail back link category/region/page контекстін сақтайды. Loading/detail error/404 беттерінде бір h1 бар.
- Contact: explicit htmlFor/id labels, focusable linked error summary, aria-invalid/describedby, hints/counter, pending және icon+text success/error feedback. Privacy copy сақталды; API body өзгерген жоқ. Desktop form/help және mobile single-column layout жасалды.
- RequestState: skeleton decorative, loading live status бөлек; error panel анық heading/icon/retry қолданады. Home duplicate live/catalog alerts қысқартылды.
- CSS: typography/spacing/wrapping, footer/primary touch targets, focus-visible, form/error/success semantic surface tokens, variable-count editorial category grid. 6 category/ұзын атаулар қабаттаспайды. 320px–desktop layout және reduced-motion сақталған; forced-colors state affordance қосылды.
- Favorites context және retry callbacks memoized/stable болды: announcement-only өзгеріс context value-ді қайта таратпайды. Heavy dependency, external font, analytics қосылған жоқ. RUM/INP өнімділік өлшемі жүргізілді деп мәлімделмейді.

### Нақты тексерулер

- Frontend npm run build: **PASS**, exit 0. JS gzip ~97.35 kB (Stage 5 ~95.71 kB), CSS gzip ~12.20 kB; жаңа package жоқ.
- Frontend npm run lint: **PASS**, exit 0; suppressions қосылған жоқ.
- Frontend npm test: **26/26 PASS**, skipped 0, exit 0. Жаңа 3 test WCAG contrast формуласының reference/boundary/semantic colors есептеуін тексереді.
- Backend npm test: strict build **PASS**, **71/71 PASS**, exit 0.
- DB integration: strict build **PASS**, **12/12 PASS**, exit 0; test DB-нің жеті application кестесінде соңғы read-only тексеруде **0 fixture/contact жолы**.
- Browser npm run test:browser: **20/20 PASS**, exit 0, isolated Chrome + owned Vite/Express processes. Native Tab/Enter (char semantics қоса)/Escape, skip link, route focus/title, disclosure, linked form errors/Chrome AX textbox names, input focus retention, back context, reduced motion және Stage 5 functional flows өтті.
- 10 бет/күй × 5 ен (320, 375, 768, 1024, 1440) = **50 комбинация**: horizontal overflow 0, unlabelled input 0, әрқайсысында h1/main 1, lang kk. **1413 computed text check, 0 contrast failure**, skipped background-image cases 0; normal 4.5:1, large 3:1 thresholds қолданылды. Бұлар қайталанатын rendered text тексерулері, unique text саны емес.
- Error/empty/details 404/route 404/favorites/contact/search/results matrix қамтылған. 6 long-label category бес енде бөлек overlap тексеруінен өтті. Input border бастапқы palette-де ~3.07:1, сақталған; focus/action және error colors reference tests-тен өтті.
- TDD: skip-link фокусы тестте алдымен FAIL болды. Native mobile Tab link тәртібі мен background result focus stealing жеке тестте FAIL болып, кейін нақты code fixes арқылы PASS болды. Test harness Enter char event/selector түзетілді; assertions өшірілген жоқ.
- Baseline/final desktop/320px screenshot finish review жасалды, desktop hero line breaks бастапқы композицияға қайтарылды. Артефактілер: frontend node_modules/.cache/stage6-baseline-*.png, stage6-final-*.png, stage6-accessibility.json (Git ignored).
- Backend npm audit: **0**, exit 0. Frontend audit: **10 moderate**, high/critical 0, exit 1 — бұрынғы ESLint dev tooling; dependency upgrade/fix жасалмады.

### Файлдар, шектеулер, келесі кезең

Frontend App.tsx, жаңа components/RouteAccessibility.tsx, Contact.tsx, RequestState.tsx, hooks/useResource.ts, refinements.css, tests/browser-integration.mjs, жаңа tests/helpers/accessibility.mjs және tests/accessibility.test.mjs; frontend/backend README және PROGRESS.md.

Custom DOM/computed color + Chrome AX tree тексерулері толық WCAG certification емес. axe-core және NVDA/VoiceOver қолмен сынағы орындалмады; pixel-based image/pseudo-element contrast толық талданбады. Бұрынғы 10 moderate dev vulnerabilities және production role/TLS/shared limiter/contact-retention/pgpass шектері сақталады.

Backend API contract/schema және dependency lockfiles өзгерген жоқ. Нақты published бағдарлама ойдан қосылмады, DEMO/draft көрсетілмейді. balaqoldau_db немесе unrelated базаға қосылу/өзгерту жасалған жоқ; main b84e459c0d808729d606c2dbedfc061bf75aa72e және development branch сақталды. Stage 7, push/deploy басталған жоқ.

## Stage 7 — Final QA, Security, Deployment Readiness (2026-11-11)

### Шолу және минимал түзету

- Repository inventory, README/PROGRESS, security/review/shipping/performance/TDD/Git және
  documentation skill нұсқаулары қаралды. Frontend/API/DB trust boundaries, SQL,
  validation, CORS/preflight, limiter, errors, env/ignore және production баптауы тексерілді.
- Расталған production proxy ақауы: бұрын proxy артындағы клиенттер бір IP limiter-іне
  жиналатын. `TRUST_PROXY_LOOPBACK` strict true/false env қосылды, әдепкі false сақталды;
  true тек loopback proxy-ге сенеді. Deployment proxy forwarding headers-ті қайта жазуы
  және Node портын жасыруы тиіс. Екі жаңа regression тест алдымен FAIL, түзетуден кейін PASS:
  config opt-in/rejection, бөлек клиенттер және forged leftmost IP bypass-ты болдырмау.
- `.gitignore`: password files/private keys/common backup dumps еленбейді;
  credentials-free production env example рұқсат етіледі. Нақты .env/pgpass оқылмады,
  парольдер шығарылмады. Package manifests/lockfiles және DB schema өзгертілмеді.
- Root README, production env, Nginx template, deployment/least-privilege/migration/
  rollback және contact retention құжаттары қосылды. Жергілікті DB рөлдері өзгермеді.
  Nginx executable жоқ: template syntax/TLS ingress нақты серверде тексерілмеді.
- Built-site browser QA adapter: dist + жергілікті HTTP API proxy, Vite қажет емес;
  source/env/missing asset 404 және SPA deep routes тексерілді. Бұл adapter production
  сервері емес. Бар дизайн/API/frontend functionality сақталды.

### Нақты verification

- Frontend `npm run build`: **PASS**, exit 0. JS gzip **97.35 kB**, CSS gzip **12.20 kB**.
- Frontend `npm run lint`: **PASS**, exit 0; browser helper/performance қосылғаннан кейін
  қайта тексерілді, suppressions жоқ. `npm test`: **26/26 PASS**, skipped 0, exit 0.
- Backend `npm test` (strict build қоса): **73/73 PASS**, skipped 0, exit 0; бұрынғы
  71 + екі proxy regression. Күтілетін synthetic 500 тек жалпы error оқиғасын шығарады.
- Backend `npm run test:db` (strict build қоса): **12/12 PASS**, skipped 0, exit 0.
  Нақты PostgreSQL `balaqoldau_test`: migration idempotency, constraints, published-only
  list/detail/taxonomy, filtering, SQL injection, contact INSERT және CORS тексерілді.
  Test fixtures transaction rollback; соңғы read-only count жеті application кестесінде **0**.
- Browser development mode: **20/20 PASS**, exit 0. Built dist mode: **21/21 PASS**,
  0 runtime exception; нақты React → test HTTP reverse proxy → Express → PostgreSQL GET
  растады. Contact browser HTTP fixture, нақты SQL/HTTP POST бөлек DB integration-де.
- Layout: **50 бет/ен комбинациясы**, 320/375/768/1024/1440; overflow/unlabelled field 0,
  main/h1 біреу, lang kk. **1413 computed text checks**, contrast failure 0; keyboard
  Tab/Enter/Escape, skip/focus, form summary, reduced motion және functional flows өтті.
  Desktop/mobile screenshots визуалды қаралды; browser TEST fixture-тері жарияланбады.
- Local unthrottled built home соңғы sample: FCP/LCP **176 ms**, TTFB **4.2 ms**, CLS **0**,
  long task **1**; алдыңғы sample LCP 140 ms. Артефакт
  `balaqoldau/node_modules/.cache/stage7-performance-built.json`. Бұл field CWV/INP,
  slow-network/load test немесе production performance кепілдігі емес.
- Backend толық audit **0**, production-only audit **0**, exit 0. Frontend толық audit
  **10 moderate**, high/critical 0, exit 1; `--omit=dev` **0**, exit 0.
- 10 finding — бір minimatch 10.2.6 advisory-інің ESLint/TypeScript-ESLint dev graph-ы.
  Registry/upstream тексерілді: compatible 10.x fix жоқ, patch 11.0.1. Force downgrade/
  major override қауіпсіз деп дәлелденбегендіктен қолданылмады. Risk/review date **2026-11-18**
  және paths `docs/SECURITY.md` ішінде; dependencies өзгерген жоқ.
- Source/docs credential-pattern scan: **76 text files**, private-key/token pattern
  match 0 (env/dependencies/Git internals excluded; толық secret-history audit емес).
  Frontend bundle DB URL/config leak scan: **0**. `.env` ignored екені расталды.
- Dev read-only identity/count: **balaqoldau_dev**, public programs **0**, DEMO draft **2**.
  DEMO/private бағдарламалар public endpoint-терде жоқ; жаңа ресми дерек ойдан қосылмады.
- `git diff --check` PASS (бұрынғы екі файлға line-ending warning ғана). Branch development,
  main **b84e459c0d808729d606c2dbedfc061bf75aa72e** сақталды. balaqoldau_db/unrelated DB-ге
  қосылу, дерек жою, рөл/схема өзгерту, push/deploy орындалмады.

### Stage 7 өзгерген файлдар

`.gitignore`, жаңа `README.md`, `docs/{DEPLOYMENT,SECURITY}.md`,
`deploy/nginx.conf.example`, `backend/.env.example`, жаңа `backend/.env.production.example`,
`backend/README.md`, `backend/src/{app.ts,config/env.ts}`,
`backend/tests/{app,config}.test.mjs`, `balaqoldau/README.md`,
`balaqoldau/tests/browser-integration.mjs`, жаңа `balaqoldau/tests/helpers/built-site.mjs`,
`PROGRESS.md`. Бұрынғы кезеңдердің uncommitted өзгерістері сақталды.

### Қалған launch gates / мәртебе

Жергілікті Stage 7 QA аяқталды; **public production-ready деп жарияланбайды**.
Оператор TLS/DNS/firewall/Nginx staging, restricted runtime DB grants, backup/restore,
PII-сыз uptime/error бақылауы және екі real client IP throttling drill-ін орындауы керек.
Local pgpass үшін pg 9 deprecation warning бар; major upgrade алдында шешу қажет.
Contact retention: created_at-тен **30 күн**, protected backup expiry **30 күн**; нақты
owner/privacy notice/deletion channel және күнделікті manual purge бекітілуі тиіс.
**Automation, deletion workflow және backup expiry enforcement енгізілмеген**; осы
шектеуді қабылдамай public contact launch жасалмайды. Purge/DELETE орындалған жоқ.
Фото лицензиясы/бейне пайдалану құқығы расталмаған; NVDA/VoiceOver қолмен тексеруі
және production mobile performance қажет. Толық WCAG сәйкестігі мәлімделмейді.
Dev-only audit deferral maintainer review-ды талап етеді; тәуелсіз release review қажет.
Stage 7-ден кейінгі әзірлеу, push/deploy басталған жоқ.

## Stage 7.5 — Independent Kazakhstan GovTech UI (2026-11-12)

### Дизайн және іске асыру

- README/PROGRESS және frontend UI Engineering, installed UI/UX Pro Max, TDD/review
  нұсқаулары қаралды. Бұрынғы desktop UI screenshot бағаланды. eGov public reference
  ашылды, бірақ text-only response шектеулі болды: дизайн берілген талаптарға сай
  дербес жасалды, eGov layout/logo/seal көшірілген жоқ. Unslop бұрынғыдай қолжетімді емес.
- White/navy/blue/gray tokens, 4–6px corners, restrained borders, Segoe UI/system sans,
  бірізді typography/spacing. Барлық маршруттар: home/find/results/details/favorites/
  contact, loading/empty/error/success күйлері ортақ стильге көшті.
- Header/footer: «Тәуелсіз ақпараттық платформа. Мемлекеттік органның ресми сайты емес».
  Мемлекеттік рәміз/endorsement, жалған verification badge/санақ/бағдарлама қосылған жоқ.
  Lucide кәсіби белгішелері және бұрынғы өз heart branding-і сақталды, favicon көкке көшті.
- Home бөлек Home.tsx компонентіне шығарылды. Prominent keyword search қазір `q` береді;
  өңір/жас/category фильтрлері бірге жұмыс істейді. Төрт support direction тек q shortcut:
  жәрдемақы / тегін курс / үйірме / грант. Backend category slug ойдан жасалмады;
  нақты category/region тізімдері API-ден келеді, public record жоқта honest empty state бар.
- Source URL/sourceName және нақты verifiedAt details-та сақталған; source link пен
  тексерілген күн browser regression assertion арқылы тексерілді. Published label
  тек API visibility-ді білдіреді, мемлекеттік мақұлдау емес.
- Ескі photo/atlas layout пен қайталанған styling қабаты reset + ортақ stylesheet-пен
  алмастырылды; декоративті reveal observer App-тан алынды. CSS gzip **12.20 → 6.23 kB**,
  JS gzip **97.35 → 96.84 kB**. Жаңа dependency/font/image жоқ.
- Фото енді DOM-да жоқ және жүктелмейді. Public файл/credits өзгертілмеген: Vite public
  assets көшіретіндіктен фото лицензиясын растау не approved removal әлі launch gate.

### Нақты тексерулер

- Frontend `npm run build`: **PASS**, exit 0; соңғы JS 310.48 kB / gzip 96.84 kB,
  CSS 26.95 kB / gzip 6.23 kB.
- `npm run lint`: **PASS**, exit 0. Ешбір lint rule/suppression өшірілмеді.
- `npm test`: **27/27 PASS**, skipped 0, exit 0. GovTech notice/text/field contrast test
  қосылды, palette AA token assertions жаңартылды; API/contact/navigation tests сақталды.
- Browser development mode: **22/22 PASS**, exit 0. Built dist (Vite-сіз) mode:
  **23/23 PASS**, exit 0. Нақты React → Express/PostgreSQL GET және бос public result
  расталды. Browser contact fixture, бұрынғы integration contracts сақталған; бұл кезең
  нақты DB contact жазбасын жасаған жоқ.
- Жаңа behavioral test notice жоқта алдымен **FAIL** болды; кейін notice/home keyword
  search/q-direction implementation арқылы PASS. q + region + category + age 0 бірге
  тексерілді. Existing filters/pagination/reset, favorites, retry/stale abort, form pending/
  validation/error/manual retry/success, DEMO/draft rejection, details/back navigation өтті.
- 10 бет/күй × 5 ен **320/375/768/1024/1440 = 50** комбинация: overflow/label/heading
  regression жоқ, **1490 computed text checks**, contrast failures 0. Тәуелсіздік
  ескертуі барлық 50 жағдайда көрінеді. Алты ұзын API category атауы overlap жасамады.
- Keyboard Tab/Enter/Escape, skip-link, route focus/title, contact error summary,
  focus retention, Chrome AX names, reduced motion тексерулері өтті. Бұл full WCAG
  certification емес; NVDA/VoiceOver қолмен сынағы орындалған жоқ.
- Алты маршруттың 1440/320 screenshots жасалды және визуалды шолу өтті. Artifacts:
  `balaqoldau/node_modules/.cache/stage6-govtech-final-*.png`,
  `stage6-govtech-final.json`, `stage6-accessibility.json` (ignored).
- Built home жергілікті unthrottled sample: LCP/FCP **112 ms**, CLS **0**, long tasks **0**;
  field CWV/INP немесе production performance кепілдігі емес.
- `git diff --check`: **PASS**, тек line-ending ақпараттық warnings. Backend source/API,
  SQL/schema, env, dependencies/lockfiles өзгерген жоқ; DB migration/seed/integration
  жазбалары іске қосылған жоқ. Backend tests/audits бұл frontend-only кезеңде қайта
  орындалмады, Stage 7 нәтижелері тарихи есепте қалады.
- Branch **development**, main **b84e459c0d808729d606c2dbedfc061bf75aa72e** сақталды.
  balaqoldau_db/unrelated DB-ге қосылу/өзгерту, push/merge/deploy болмады.

### Өзгерген файлдар және шектеулер

`balaqoldau/src/App.tsx`, жаңа `src/components/Home.tsx`, `SupportFinder.tsx`,
`src/index.css`, `src/refinements.css`, `index.html`, `public/balaqoldau.svg`,
`tests/{accessibility.test,browser-integration}.mjs`, `README.md`, `DESIGN_DIRECTION.md`,
`design-system/balaqoldau/MASTER.md`, root `PROGRESS.md`.

Stage 7.5 аяқталды. API келісімшарттары мен existing functionality сақталған.
Stage 7 dev-only dependency risk/production TLS/least-privilege/retention/manual
accessibility launch gates сақталады; public production readiness жаңадан мәлімделмейді.

## Stage 7.6 — GovTech Design Refinement (2026-11-12)

- Current frontend/README/PROGRESS, UI/UX Pro Max typography/layout/accessibility
  нұсқаулары және Stage 7.5 screenshot қаралды. GOV.UK search/topic-directory құрылымы
  зерттелді; eGov public page қайта ашылды, text response шектеулі. Брендинг/layout
  көшірілмеді. Unslop қолжетімсіз, қолданылды деп мәлімделмейді.
- Үлкен marketing hero, eyebrow labels, иконка-тақырып санат карточкалары, төмендегі
  қайталанған steps/CTA панельдері алынды. Home: сол жақта ықшам search + filters,
  оң жақта semantic ordered үш қадамдық «Қалай жұмыс істейді?»; <=960px бір баған.
  #how навигациясы guide-қа focus береді, hash/back behavior сақталған.
- Қолдау бағыттары және API санаттары мәтіндік каталог болды; program results
  карточкалары шекарамен бөлінген ықшам list rows-қа көшті. Ішкі беттерде heading
  24–32px, whitespace азайтылды, негізгі panel corners 2px. Contact/details сыртқы
  nested box азайды; field labels, source/date, error/success және favorite controls сақталды.
- White/navy/blue сақталып, шағын түпнұсқа SVG оюға ғана muted teal #197d89 accent
  қосылды. Ою aria-hidden/noninteractive, мемлекеттік рәміз емес. Фото/font/package
  қосылған жоқ; independence disclaimer әр бетте көрінеді, жалған статистика/бағдарлама жоқ.
- Home.tsx, SupportFinder.tsx, App.tsx, Contact.tsx, refinements.css, browser suite,
  frontend README/DESIGN_DIRECTION/MASTER және PROGRESS жаңартылды. Бұрынғы Stage 7.5
  uncommitted жұмысы сақталды; backend/API/schema/env/dependency файлдары өзгерген жоқ.

### Нақты verification

- Frontend `npm run build` **PASS**, `npm run lint` **PASS**, exit 0.
- `npm test` **27/27 PASS**, skipped 0, exit 0.
- Development browser suite **23/23 PASS**, exit 0; соңғы built-dist suite (Vite-сіз)
  **24/24 PASS**, exit 0. Guide layout тесті implementation алдында 0 vs 3 қадаммен
  **FAIL** болды, түзетуден кейін өтті. Desktop қатар/mobile төмен орналасуы және
  #how focus жеке тексерілді. Ешбір бұрынғы regression assertion өшірілмеді.
- Нақты backend GET smoke, q/region/category/age, pagination/reset, source/date,
  favorites/back navigation, retry/stale cancellation, contact validation/pending/
  error/success және DEMO/draft rejection өтті. Contact browser fixtures арқылы,
  development database-ке хабарлама жазылған жоқ.
- 10 бет/күй × 320/375/768/1024/1440 = **50** комбинация: overflow/label/heading
  қатесі 0; **1390 computed text contrast checks**, failure 0. Native Tab/Enter/Escape,
  skip/route focus, Chrome AX names, form error summary және reduced motion өтті.
- Алты маршруттың desktop/mobile screenshot-тары визуалды қаралды. Ignored artifacts:
  `balaqoldau/node_modules/.cache/stage6-portal76-final-*.png`,
  `stage6-portal76-final.json`, `stage6-accessibility.json`.
- Соңғы bundle: JS **308.37 kB / gzip 96.34 kB**, CSS **25.71 kB / gzip 6.12 kB**.
  Built home local unthrottled sample: LCP/FCP **104 ms**, CLS **0**, long tasks **0**;
  бұл production field CWV емес.
- `git diff --check` соңғы тексеруде PASS; табылған бір whitespace жолы түзетілді.
  Branch development және main b84e459c0d808729d606c2dbedfc061bf75aa72e сақталды.
  Backend/DB өзгерісі, record publication, push/merge/deploy орындалған жоқ.

Stage 7.6 аяқталды. Full WCAG сәйкестігі мәлімделмейді: NVDA/VoiceOver қолмен тексеруі
және бұрынғы Stage 7 production/security launch gates әлі қажет. Backend tests/audits
бұл frontend-only кезеңде қайта іске қосылмады; бұрынғы нәтижелер тарихи есепте.

## Қосымша UI/UX — hero, сары акцент, күйлер, footer (2026-11-12)

- Hero-ның екі бағаны сақталды; guide астына шағын original `family-reading.svg`
  қосылды. Коммерциялық қолдануға рұқсат беретін толық MIT license SVG ішінде;
  сыртқы stock/photo қолданылмады. Alt, width/height және responsive max-width бар.
- Негізгі көк сақталып, жалғыз қосымша accent #F4B942 болды. Іздеу CTA-сына navy
  мәтін/шекара қолданылды; normal/hover text contrast AA unit test өтті.
- Loading «Деректер жүктелуде…», empty «Қазір бұл санатта бағдарламалар жоқ»,
  нақты error «Деректерді жүктеу мүмкін болмады. Қайталап көріңіз.» бөлек көрсетіледі.
  Home error кезінде empty hint шықпайды; retry және status-specific safe detail сақталды.
- Footer қайталанған description/disclaimer-ден тазартылды; semantic navigation,
  Байланыс, copyright және дереккөз ескертпесі сақталды. Header independence notice орнында.
- Өзгерістер: Home.tsx, RequestState.tsx, App.tsx, refinements.css, жаңа SVG,
  tests/accessibility.test.mjs, tests/browser-integration.mjs, MASTER.md, PROGRESS.md.
- Build **PASS**, lint **PASS**, unit tests **28/28 PASS**, built browser **24/24 PASS**,
  exit 0. Алдымен empty-copy regression test FAIL болды, іске асырудан кейін өтті.
  50 page/width layout/contrast checks, keyboard, navigation, filters, favorites және
  contact suite өтті; 12 screenshot review-де computed contrast failure 0.
- Backend/API/DB/dependencies өзгерген жоқ; branch development, push/deploy жоқ.

## Stage 8.1 — Database Readiness & Fail-Closed Reliability (2026-11-12)

### Іске асыру

- README/PROGRESS, backend config/server/pool/tests, TDD және security нұсқаулары оқылды.
  Өзгерістер тек backend reliability және құжаттарға қатысты; frontend-тің бұрынғы
  uncommitted жұмысы сақталды. Ешқандай package орнатылған жоқ.
- `GET /api/health` бұрынғы 200 `{status:"ok"}` liveness күйінде қалды, SQL орындамайды.
  Жаңа `GET /api/ready`: 200 `{status:"ready"}` немесе 503 generic NOT_READY JSON.
  Қате query → 400, HEAD қолдау, CORS/Helmet/no-store/rate limiting сақталған.
- Readiness pool checkout + public view probe үшін **2000ms жалпы deadline** қолданады.
  `SELECT id FROM balaqoldau.published_programs LIMIT 0` connection/view/SELECT рұқсатын
  тексереді, дерек қайтармайды. Бос каталог дайын болып саналады. Timeout-та client
  destroy, кеш checkout discard; concurrent probes бір pending жұмысты бөліседі.
- Production DATABASE_URL және HTTPS CORS origins міндетті; DB parser verify-full
  талабын сақтайды. Алғашқы probe өтпесе порт ашылмайды, pool жабылып exit 1 болады.
  Development/test health-only режимі сақталды. Connection string, DB error, stack және
  pgpass мазмұны клиентке/журналға берілмейді.
- Startup/shutdown тесттелетін lifecycle.ts модуліне бөлінді. SIGTERM/SIGINT кезінде
  ready false, HTTP drain, pool.end; repeated shutdown idempotent. 10s deadline асса
  remaining HTTP connections жабылып, entry point generic хабармен exit 1 жасайды.
- Readiness жүріп жатқанда shutdown басталса, probe аяқталған соң да күй қайта
  тексеріледі. Бұл race тестте алдымен 200 vs 503 FAIL болып, кейін түзетілді.
- Қалыпты public API requests readiness query орындамайды. Pool/schema/migration,
  production рөлдері мен credentials өзгертілмеді; жаңа SQL migration жоқ.

### Нақты тексерулер

- Backend `npm run build` және `npm test`: **PASS**, **94/94**, skipped 0, exit 0.
  Available/missing/unavailable DB, pool checkout/query timeout, late-client cleanup,
  recovery, production missing/invalid config/TLS/http-origin, safe errors, health
  independence, SIGTERM/SIGINT, in-flight HTTP drain, idempotency және shutdown deadline
  қамтылды. Startup signal tests Windows-та process.emit арқылы handler-ді тексереді.
- Алғашқы жаңа tests implementation жоқта FAIL болды. Strict TS resolver assignment
  диагностикасы түзетілді; lint suppression/any/new dependency енгізілген жоқ.
- Password file бар екені contents оқылмай тексерілді. Read-only identity:
  **balaqoldau_dev / postgres**, **balaqoldau_test / postgres**. Auth сәтті болды;
  elevated privilege сұрауы не credential өзгерту қажет болмады.
- `npm run test:db`: build **PASS**, **14/14 PASS**, skipped 0, exit 0. Нақты test DB
  readiness 200, ended pool 503, unreachable local PostgreSQL connection 503 тексерілді.
  PostgreSQL service тоқтатылған жоқ. Existing integration fixtures rollback болды;
  test DB-нің жеті application кестесінде соңғы read-only count **0**.
- Frontend `npm test`: **28/28 PASS**, exit 0; frontend source бұл кезеңде өзгермеді.
  Frontend build/browser және dependency audits қайта іске қосылған жоқ.
- Test output-та pgpass қолдауы pg 9-да алынатыны туралы бұрынғы deprecation warning
  сақталған; жасырылмады. Пароль/connection string шығарылған жоқ.
- Git diff whitespace check PASS; branch development, main
  b84e459c0d808729d606c2dbedfc061bf75aa72e сақталды. balaqoldau_db/unrelated DB-ге
  қосылу/өзгерту, drop/reset/destructive migration, push/merge/deploy болмады.

### Файлдар және қалған талаптар

Backend src/app.ts, config/env.ts, server.ts; жаңа src/lifecycle.ts,
src/db/readiness.ts, src/routes/ready.ts; tests/app/config/startup.test.mjs;
жаңа tests/readiness.test.mjs, tests/lifecycle.test.mjs,
tests/integration/readiness.test.mjs; backend README және env examples;
root README/PROGRESS; docs/DEPLOYMENT.md, docs/SECURITY.md.

Stage 8.1 аяқталды. Readiness — point-in-time public-view тексеруі, барлық taxonomy/
contact write grants не backup күйінің толық кепілдігі емес. Production TLS cert/CA,
least-privilege runtime login (local postgres суперпайдаланушысы емес), нақты ingress,
hosting OS signal delivery және restore drill staging-де бөлек орындалуы тиіс.
Бұл review рөлдерді/grants/credentials өзгертпеді. Production-ready деп мәлімделмейді;
Stage 8.2 автоматты басталған жоқ.

## Stage 8.2 — Contact Privacy & Retention (2026-11-12)

### Іске асыру және қауіпсіздік

- Contact schema/API/repository, pool, privacy құжаттары және tests қаралды; TDD және
  Security нұсқаулары қолданылды. POST/form/schema және Stage 8.1 өзгертілмеді.
- Жаңа retention/config.ts, cleanup.ts, cli.ts және `npm run contact:cleanup` script.
  Міндетті explicit `--dry-run` не `--execute`; басқа/қосарланған flag rejected.
- Default 30 күн, allowed 30–365; batch default 100, allowed 1–1000, бір invocation
  тек бір batch орындайды. Unsafe config DB қосылымына дейін rejected.
- Dedicated RETENTION_DATABASE_URL қажет, DATABASE_URL fallback жоқ. URL path,
  RETENTION_EXPECTED_DATABASE және нақты current_database() сәйкес болуы тиіс;
  balaqoldau_db және system DB тыйым салынған. Password/PII console-ға шықпайды.
- Cutoff PostgreSQL transaction уақытынан days × 24 сағатпен UTC-де есептеледі;
  микросекунд precision сақталады. `created_at < cutoff`: дәл 30 күндік boundary сақталады.
- Dry-run SELECT count және bounded wouldDelete береді, DELETE орындамайды;
  CLI қосымша READ ONLY transaction қолданады. Execute parameterized CTE DELETE,
  stable oldest-first LIMIT, transaction/advisory lock және actual rowCount cap қолданады.
  Қателерде rollback; overlapping job қауіпсіз тоқтайды. Logs: mode/config/counts қана.
- docs/CONTACT_RETENTION.md: operator identity/permission review, manual early deletion
  (UUID bound parameter, бір record), scheduling/failure/retry/backlog және backup/restore
  рәсімі. Retention role grants тек құжатталды; рөл/credential өзгертілмеді.
- Contact form notice қарап тексерілді: ол нақты жиналатын fields пен sensitive-data
  warning береді, automatic deletion туралы мәлімдемейді; frontend өзгерту қажет болмады.
  Public launch алдында толық privacy notice/нақты deletion channel бекітілуі тиіс.
- External scheduler/service қосылған жоқ; автоматты жою operational деп мәлімделмейді.

### Нақты verification

- Жаңа unit tests implementation жоқта FAIL болды. Backend `npm run build` **PASS**,
  `npm test` **102/102 PASS**, skipped 0, exit 0. Mode/config/target validation,
  dry-run SQL/parameter binding, identity mismatch, busy lock және unavailable DB failure
  тесттері бар; бұрынғы contact API және Stage 8.1 tests өтті.
- `npm run test:db`: build **PASS**, **20/20 PASS**, skipped 0, exit 0. Жаңа tests:
  newer/older, exact boundary және ±1 microsecond, configurable 35-day period,
  dry-run no-deletion, oldest-first/batch=1, repeated execution → 0 және CLI dry-run.
- Нақты DELETE SQL тек balaqoldau_test ішіндегі synthetic fixtures transaction-ында
  орындалды және **ROLLBACK** болды. Existing test contact dataset бос болмаса test
  тоқтайды. CLI --execute dev/production-да іске қосылған жоқ; шынайы хабарламалар жойылмады.
- Соңғы read-only тексеру: balaqoldau_test.contact_messages **0**. Pgpass contents
  оқылмады/шығарылмады; pg 9 deprecation warning бұрынғыдай бар, жасырылмады.
- Schema/migrations/dependencies/lockfile/public API/frontend өзгермеді. Package.json
  өзгерісі script қосу ғана. Git diff whitespace check PASS; main және development
  branch сақталды, push/merge/deploy жоқ. balaqoldau_db/unrelated DB қолданылған жоқ.

### Файлдар және операциялық талаптар

Жаңа backend/src/retention/{config,cleanup,cli}.ts,
backend/tests/retention.test.mjs, backend/tests/integration/retention.test.mjs,
docs/CONTACT_RETENTION.md; backend/package.json, env examples/README,
docs/SECURITY.md, docs/DEPLOYMENT.md және PROGRESS.md жаңартылды.

Stage 8.2 код/тест/құжат көлемінде аяқталды. Бөлек least-privilege retention login,
production TLS, privacy owner, нақты өтініш арнасы, scheduling/monitoring/backlog capacity,
backup expiry және restore erasure рәсімі әлі оператор тарапынан бекітілуі керек.
Restricted role тесті рөл өзгертуге рұқсатсыз орындалмады. Күнделікті manual cleanup
не approved schedule іске қосылмайынша automatic 30-day deletion туралы уәде берілмейді.
Public production-ready деп мәлімделмейді; Stage 8.3 басталған жоқ.

## Stage 8.3 — CI/CD & Release Security (2026-11-12)

### Орындалды

- `.github/workflows/ci.yml`: pull request/development/main push checks, Ubuntu/Node 24,
  read-only token, SHA-pinned checkout/setup-node, credentials persistence жоқ, 20-minute
  timeout және concurrency cancellation. Production secrets/deploy/privileged PR trigger жоқ.
- Frontend/backend build, lint, TypeScript, unit tests; PostgreSQL 18.6 service ішіндегі
  isolated `balaqoldau_test`, екі migration run, integration suite. CI тек жаңа ephemeral DB
  қолданады, DEMO seed/real contact cleanup іске қосылмайды.
- `scripts/{release-policy,check-release,audit-dependencies}.mjs`: Git inventory және нақты
  production dist secret/env/credential checks; migration baseline checksum/order/deletion
  checks; full/prod audit. Production high/critical немесе audit unavailable болса FAIL.
- `release-assets.json` және Vite build: public directory толық көшірілмейді, тек reviewed
  license/hash бекіткен logo және MIT family-reading SVG шығарылады. Лицензиясы белгісіз
  family.jpg және қажетсіз public files production build-ке кірмейді; source жойылған жоқ.
- Backend lint frontend-тегі existing ESLint арқылы қосылды. Ол анықтаған үш control-regex
  ескертуі same-behavior character validation-ға ауыстырылды; барлық C0/DEL және allowed
  message tab/newline boundary regression тесті қосылды. ESLint rules өшірілген жоқ.
- README, DEPLOYMENT және жаңа RELEASE_CHECKLIST: staging TLS, least privilege roles,
  backups/isolated restore drill, monitoring, retention schedule, manual review және rollback.

### Нақты жергілікті тексерулер

- Frontend lint, typecheck, build **PASS**; tests **28/28 PASS**, skipped 0.
- Backend lint, typecheck, build **PASS**; tests **103/103 PASS**, skipped 0.
- PostgreSQL integration **20/20 PASS**, тек balaqoldau_test; temporary fixtures ROLLBACK.
- Built-dist Chrome browser **24/24 PASS**: real GET-only dev API smoke, synthetic UI
  fixtures, responsive/focus/navigation/contrast/form/error tests. CI browser run қосылмаған.
- Release policy tests **6/6 PASS**, source scan trusted HEAD migration baseline-мен PASS;
  production artifact scan және private build canary build/scan PASS. Root .gitignore .env,
  node_modules және dist-ті ignore ететіні тексерілді. Lockfiles өзгермеді.
- Audit: backend full/prod **0**; frontend full **10 moderate**, high/critical **0**;
  frontend production **0**. Existing minimatch dev-tool chain тәуекелі қалды, packages
  орнатылған/жаңартылған жоқ. Алғашқы audit network failure fail-closed болды; registry
  access-пен қайталау exit 0. Full findings audit exit code 1 counts арқылы өңделеді.
- Алғашқы PowerShell npm.ps1 execution-policy қатесі npm.cmd арқылы шешілді, system policy
  өзгермеді. Алғашқы sandbox Chrome connection closed; isolated browser қайта іске қосылып
  24/24 өтті. pgpass support deprecation warning бар (болашақ pg 9 migration талабы).
- git diff whitespace check PASS (Windows LF/CRLF warnings ғана); development/main hash
  сақталды. Existing unrelated changes сақталды. balaqoldau_db қолданылған жоқ;
  real messages cleanup, roles/credentials changes, install/push/merge/deploy болған жоқ.

### Файлдар және қалған міндеттер

Жаңа: .github/workflows/ci.yml, scripts/release-policy.mjs, scripts/check-release.mjs,
scripts/audit-dependencies.mjs, scripts/release-policy.test.mjs, release-assets.json,
balaqoldau/eslint.backend.config.js, docs/RELEASE_CHECKLIST.md.
Өзгерген: frontend/backend package.json scripts, backend/src/api/schemas.ts,
backend/tests/api.test.mjs, balaqoldau/vite.config.ts, balaqoldau/tsconfig.node.json,
README.md, docs/DEPLOYMENT.md, PROGRESS.md.

Stage 8.3 repository implementation және жергілікті verification аяқталды. GitHub Actions
әлі іске қосылған жоқ (push жасалмады); Linux/Node 24 clean install/service workflow
нақты GitHub run-да тексерілуі тиіс. Branch protection/required check/reviewer және secret
scanning оператор арқылы орнатылады. Pattern/DDL/license checks manual review-ды алмастырмайды.
Staging HTTPS/DB TLS/restricted roles, backup restore, monitoring, retention scheduling және
assistive-technology manual testing әлі operational gates. Public production-ready деп
мәлімделмейді; Stage 8.4 басталған жоқ.

## Stage 8.4 — Asset Licensing & Security Cleanup (2026-11-12)

### Өзгерістер

- Frontend public/src assets, CSS/font imports, inline SVG және installed Lucide license
  тексерілді. Белсенді екі artwork: project-owned logo және embedded full MIT notice бар
  family-reading.svg. Font files/web-font downloads жоқ, Segoe UI/Arial/system fallback.
- Unused әрі лицензия дәлелі жоқ family.jpg және hero.png алынды. Қолданылмайтын starter
  vite.svg/react.svg/favicon.svg/icons.svg те алынды; олардың құқықтары ойдан белгіленбеді.
- Import/reference тексеруінен кейін HeroFamilyPhoto.tsx/.css, ProductPreview.tsx/.css,
  FamilyAtlas.tsx, Illustration.tsx, useScrollReveal.ts және импортталмайтын App.css алынды.
  DEMO data module legacy tests қолданатындықтан сақталды. Active routes/UI өзгертілмеді.
- Public THIRD_PARTY_NOTICES.txt installed lucide-react/LICENSE-тен сөзбе-сөз көшірілді:
  ISC және inherited icon MIT copyright/permission notices. Manifest-ке exact SHA-256
  қосылды, Vite notices-ті production dist-ке шығарады. CREDITS inventory жаңартылды.
- approvedAssets енді public және src ішіндегі manifest-тен тыс image/font/media assets-ті
  source guard/build кезінде қабылдамайды. Unknown public JPG, source WOFF2, unknown license,
  changed bytes және escaped path regression checks бар. Source guard Git-те әлі tracked,
  бірақ working tree-де жойылған файлдарды дұрыс өңдейді; secrets тексерісі сақталды.
- Frontend email regex authoritative backend Zod policy-мен сәйкестендірілді. Backend schema,
  API contract, valid plus/apostrophe/case behavior және contact submit trimming өзгермеді.
  Cross-layer test malformed local/domain, whitespace және 254/255 length boundary қамтиды.

### Тексерулер

- Email parity және unreviewed-asset regression алдымен FAIL, түзетуден кейін PASS.
- Frontend build/lint/typecheck PASS; tests **29/29 PASS**, skipped 0.
- Backend build/lint/typecheck PASS; tests **104/104 PASS**, skipped 0.
- Release policy **6/6 PASS**; source scan trusted HEAD baseline-мен және actual production
  artifact scan PASS. Tracked real .env/credentials/build artifacts анықталған жоқ;
  тек env examples tracked, real env/node_modules/dist Git арқылы ignored.
- Built-dist Chrome **24/24 PASS**, responsive/focus/navigation/contrast/contact және API
  scenarios. Dev backend-ке тек GET сұраулары жетті, POST browser fixtures ішінде өңделді.
- Audit: backend full/prod **0**; frontend prod **0**, full **10 moderate** (dev toolchain),
  high/critical **0**. Dependencies/lockfiles орнатылған не өзгертілген жоқ.
- Бірінші frontend lint unnecessary regex escapes тапты; redundant escapes алынып,
  lint қайта PASS болды, ережелер өшірілген жоқ. git diff --check PASS (LF/CRLF warnings).
- DB integration tests бұл кезеңде орындалмады: user constraint бойынша ешбір database-ке
  жазба/fixture енгізілген жоқ. Migration/seed/retention commands іске қосылмады.

### Файлдар және аяқталу мәртебесі

Өзгерген: balaqoldau/src/api/contact.ts, frontend/backend tests/api.test.mjs,
scripts/release-policy.mjs, scripts/check-release.mjs, scripts/release-policy.test.mjs,
release-assets.json, balaqoldau/public/images/CREDITS.md, balaqoldau/README.md,
docs/RELEASE_CHECKLIST.md, docs/DEPLOYMENT.md, PROGRESS.md.
Жаңа: balaqoldau/public/THIRD_PARTY_NOTICES.txt. Алынған 6 assets және 8 legacy UI/style
файлы жоғарыда тізілген. Қалған бұрынғы uncommitted өзгерістер сақталды.

Stage 8.4 implementation/local verification аяқталды. Stage 8.1–8.4 repository жұмыстары
аяқталды, бірақ Stage 8 public release operational gates жабылған жоқ: нақты GitHub CI run,
branch protection, manual ownership/license review, staging TLS/restricted roles,
backup restore, monitoring/retention scheduling және assistive-technology checks қажет.
Pattern/hash scan заңды құқықты немесе барлық secret форматтарын дәлелдемейді.
Frontend dev-only 10 moderate және болашақ pgpass/pg 9 transition тәуекелдері сақталады.
Main hash/development branch сақталды; DB/credentials/infrastructure өзгермеді;
push/merge/deploy жоқ. Stage 9 басталған жоқ. Production-ready деп мәлімделмейді.
