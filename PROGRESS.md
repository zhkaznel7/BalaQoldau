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

## Stage 8 CI source-policy failure — түзету

- Root cause жергілікті working bytes пен Git blob арқылы дәлелденді: balaqoldau.svg
  Windows-та CRLF (manifest 66ac5741…), ал Git blob/Ubuntu checkout LF (31e383b8…).
  MIGRATION_BASE емес, asset exact-byte hash mismatch generic catch артында жасырылған.
- .gitattributes үш approved text asset үшін LF бекітеді; logo working copy LF және manifest
  Git LF bytes hash-ына сәйкестендірілді. Hash/license/migration checks әлсіреген жоқ.
- check-release phase және allowlisted safe reason шығарады. Malformed JSON contents,
  arbitrary error messages, Git stderr және stack traces шығарылмайды. Missing baseline
  commit бөлек actionable error береді; valid full SHA үшін Git commit existence тексеріледі.
- Release-security 10/10 PASS: LF attributes/hash, safe diagnostics, CLI invalid/missing
  baseline, hash mismatch және malformed JSON redaction regression tests. Frontend build
  (TypeScript қоса), lint, tests 29/29 PASS; actual artifact/source checks full HEAD SHA-мен
  PASS. git diff --check PASS. Backend/DB өзгермегендіктен олардың тесттері қайталанбады.
- Commit/push/main өзгерісі жоқ. Нақты GitHub Actions қайта іске қосылған жоқ; патч
  жарияланғаннан кейін CI нәтижесі тексерілуі керек.

## Stage 8 CI dependency-audit timeout — түзету

- scripts/audit-dependencies.mjs, workflow, npm registry configuration және екі lockfile
  тексерілді: lockfileVersion 3, backend 100/frontend 224 package entries; resolved hosts
  тек registry.npmjs.org. Project/root .npmrc жоқ, registry URL credentials жоқ.
- Ескі CI flags cold isolated npm cache-пен дәл қайталанды: frontend process **25 011ms**
  кейін ETIMEDOUT/SIGTERM, status null, stdout 0 bytes. Generic catch process timeout-ты
  жасырып тұрған. Warm-cache full audit exit 1 толық 10 moderate report-пен қалыпты өтті;
  vulnerability exit code мен infrastructure error бір жағдай емес.
- Process deadline 90s; fetch timeout 30s, npm network retry 1, 1–2s backoff. Timeout/explicit
  transient registry errors үшін толық command қосымша бір рет қана қайталанады. Auth,
  missing lockfile, malformed JSON/counts және vulnerability findings retry жасамайды.
  Persistent unavailable audit әлі exit 1; production high/critical gate өзгерген жоқ.
- Safe diagnostics project/scope және typed reason кодтарын береді: timeout, executable,
  output buffer, process exit, registry/auth, JSON/report. Raw stdout/stderr/registry contents,
  npm config және credentials шығарылмайды. Үлкейтілген report buffer да bounded (4 MiB).
- Жаңа scripts/audit-dependencies.test.mjs, CI security tests командасы scripts/*.test.mjs;
  release checklist timeout/failure semantics сипаттайды. Dependencies/lockfiles өзгермеді.
- Verification: **15/15 security tests PASS**, source/full HEAD baseline және artifact checks
  PASS, node syntax/diff whitespace checks PASS. Exact CI audit command NODE_ENV=test/CI=true
  ортасында exit 0: backend full/prod 0, frontend full 10 moderate және prod 0, high/critical 0.
- Түзетілген full frontend audit жаңа cold cache-пен **45 554ms**, attempts 1, толық жарамды
  10 moderate report алды. Бұл workload ескі 25s budget-тен ұзақ екенін дәлелдейді.
- GitHub Actions public API 404 берді; private/run logs алынбады, нақты CI rerun расталмады.
  Репродукция жергілікті original flags/cold cache арқылы расталған. npm cache diagnostics
  OS temporary directories ішінде, package install жасалған жоқ. Backend/frontend application
  code/DB өзгермегендіктен unrelated app suites қайта орындалмады. Commit/push/main өзгерісі жоқ.

## Stage 9.1 — Secure backend admin authentication

- Express architecture/public API/CORS және CI security gates сақталды. Жаңа same-origin-only
  `/api/admin/session` GET, `/api/admin/login` POST, `/api/admin/logout` POST. ADMIN_ENABLED
  default false; enabling requires DATABASE_URL/exact ADMIN_ORIGIN, production HTTPS.
- Opaque random 256-bit session cookie; DB-де SHA-256 identifier ғана. HttpOnly,
  SameSite=Strict, production Secure/__Host prefix/host-only Path=/; dev /api/admin.
  Session-bound CSRF header + exact Origin + Fetch Metadata checks; login session/CSRF
  rotation, server-side logout revocation, disabled-user and absolute expiry enforcement.
  Bootstrap TTL 10 minutes, authenticated default 1h, configurable 5min–8h.
- Native Node Argon2id m=19456 KiB/t=2/p=1, 16-byte random salt, 32-byte tag,
  timingSafeEqual; unknown/disabled users dummy KDF. Max two concurrent KDF operations.
  New passwords 15 Unicode characters minimum/256 UTF-8 bytes maximum. No default password.
  Native API requires Node 24.7+, package/lock root engines metadata updated only;
  dependency versions/integrity entries unchanged, no package installed.
- IP login limiter 5/15min including success; admin/bootstrap limiter 60/15min.
  Zod strict JSON/query checks, bounded body, parameterized SQL and generic 4xx/503 errors;
  email/password/hash/cookie/CSRF/DB details logs-қа шығарылмайды.
- Append-only 002_admin_auth.sql: admin_users/admin_sessions, constraints/indexes/FK,
  PUBLIC access revoked. 001 unchanged. Local migration applied only to balaqoldau_test;
  synthetic admin fixtures transaction ROLLBACK. Dev/unrelated/balaqoldau_db unchanged.
- Offline `npm run admin:create` accepts stdin JSON only, explicit ADMIN_PROVISION_DATABASE
  and actual identity confirmation, fail-safe errors, no overwrite/registration endpoint.
  Provisioning command success path was not run on real data; no real accounts created.

### Файлдар

New backend/src/admin/{password,repository,routes,provision}.ts,
backend/migrations/002_admin_auth.sql, backend/tests/admin.test.mjs,
backend/tests/integration/admin.test.mjs. Updated backend/src/app.ts/config/env.ts,
backend/package.json/package-lock.json (engine metadata), both env examples,
backend/README.md, README.md, docs/DEPLOYMENT.md, PROGRESS.md.

### Verification / remaining launch gates

- Initial auth tests failed before implementation. Final backend build/lint/typecheck PASS,
  **111/111 unit tests PASS**, skipped 0; dedicated DB integration **28/28 PASS**, skipped 0.
  Tests cover Argon2 salts/verification/overload, disabled/expired/rotated/revoked sessions,
  HttpOnly/Secure/SameSite, origin/CSRF/input/media validation, unknown-account uniform error,
  rate limit, SQL injection, migration idempotency/constraints and safe provisioning failures.
- Frontend build (tsc included), lint, **29/29 tests PASS**; release security **15/15 PASS**.
  Full-HEAD migration baseline source guard, built artifact guard, diff whitespace PASS.
- Audits exit 0: backend all/prod 0; frontend prod 0, all 10 moderate dev-tool findings.
  Existing pgpass deprecation warning remains. Browser suite not rerun: frontend unchanged.
- Auth stays disabled until operator migration/grants/offline provisioning and real HTTPS
  ingress tests. Runtime SELECT admin identity/hash and SELECT/INSERT/DELETE sessions only;
  separate provisioner privileges documented, roles/credentials not modified. Session expiry
  purge scheduling/storage monitoring not operational; multi-instance needs shared/edge
  limiter, distributed account-abuse/MFA controls need a later security review.
- Stage 9.1 implementation/local verification complete; no admin UI/RBAC implemented.
  No commit/push/main/deploy, no Stage 9.2. Main hash unchanged.

## Stage 9.2 — Server-side RBAC және append-only security audit

- Stage 9.1 inspected and preserved. Roles: Editor (program read/draft write), Reviewer
  (program read/review), Admin (listed capabilities plus publish/taxonomy/role management/audit).
  Unknown/missing role/permission denies; no wildcard Admin grant. Program/taxonomy permissions
  are contracts only: CRUD/admin UI is not implemented. New authorization.ts owns the matrix.
- GET /api/admin/access returns own role/capabilities; GET /api/admin/audit-log is Admin-only,
  bounded page/limit; POST /api/admin/users/:uuid/role is Admin-only + Origin/CSRF/strict JSON.
  Authenticated forbidden = 403, unauthenticated = 401. No client/header/cookie role claims.
- Live role joins on every request, no privilege cached in sessions. Role mutation locks actor
  and target rows in stable order, rechecks current Admin authority, denies self-role changes
  (UUID case included), missing/disabled targets and unauthorized actors. Grant/revoke affects
  existing cookies immediately on subsequent requests. Role mutation/audit INSERT atomic.
- Append-only 003_admin_rbac.sql: constrained role column default Editor (no automatic Admin),
  immutable audit table with statement UPDATE/DELETE/TRUNCATE rejection trigger and indexes.
  Migrations 001/002 remain unchanged. No FK rewrite/cascade of historical audit UUIDs.
- Audit events: login success/failure, logout, RBAC denials, role changes, known-session CSRF
  denials, audit reads and offline provisioning. Finite event/permission/roles, actor/target UUID,
  timestamp only; no emails/passwords/hash/tokens/IP/body/cookies. Audit failure denies access
  or mutation with generic 503. Pre-session malformed/origin/rate-limit failures are not all
  persisted (documented amplification/privacy boundary).
- Offline provisioning default Editor, explicit ADMIN_PROVISION_ROLE=admin for operator
  bootstrap; user creation/audit is one SQL statement. No real account/role/grants changed.

### Файлдар

New backend/src/admin/authorization.ts, backend/migrations/003_admin_rbac.sql,
backend/tests/rbac.test.mjs, backend/tests/integration/rbac.test.mjs.
Updated backend/src/admin/{routes,repository,provision}.ts, integration/admin.test.mjs,
both env examples, backend/README.md, docs/DEPLOYMENT.md, PROGRESS.md.
Existing uncommitted Stage 9.1 work preserved. No dependency/version/CI gate changes.

### Verification

- Initial RBAC unit test failed before implementation. Final backend build/lint/typecheck
  PASS; **113/113 unit tests PASS**, skipped 0. Matrix/prototype/unknown permission/default
  denial, defensive policy copy, 403/audit and audit-unavailable 503 tests included.
- Dedicated PostgreSQL **36/36 PASS**, skipped 0. 401/403 role matrix, Editor/Reviewer
  self/other-user escalation attempts, forged headers, CSRF/UUID/body validation, Admin self
  protection, live promotion/demotion with same cookie, DB actor authority recheck,
  role constraints, immutable audit and log redaction tested. Audit-insert rejection triggers
  SQL statement rollback: role remains unchanged. Temporary test-only triggers/fixtures
  rolled back; append-only migration persisted only in balaqoldau_test.
- Existing Stage 9.1 auth tests still pass and assert successful login/logout audit events.
  Frontend build/lint/typecheck and **29/29 tests PASS**; release security **15/15 PASS**;
  full-HEAD migration policy/source and actual artifact guards PASS. Whitespace check PASS.
- npm audit gate exit 0: backend all/prod 0; frontend prod 0, all 10 moderate dev-tool findings.
  No installed/updated packages. Existing pgpass deprecation warning remains.
- Dev/balaqoldau_db/unrelated DB not modified; no actual contact cleanup, real user role
  changes or DB role grants. No commit/push/merge/main/deploy; no next stage started.

Stage 9.2 implementation/local verification complete. Auth remains disabled by default.
Runtime column grants, authorized initial Admin bootstrap, HTTPS staging verification,
audit retention/archive/privacy policy and owner/superuser separation remain operator launch
gates. Append-only trigger is not tamper-proof against a DB owner/superuser who can remove it.
Multi-instance/shared limiting and future program ownership/status guards remain future scope.

## Stage 9.3 — Final admin security hardening / validation

### Confirmed findings and fixes

- IP/process-only login limits were bypassable across instances/restarts/IPs. Migration 004
  adds shared per-enabled-account counters (10 attempts/15 minutes, successes included),
  reserved atomically before Argon2. Existing 5/IP/15min limiter remains. Unknown/disabled/
  throttled accounts still perform dummy KDF and return the same generic 401. No email/IP
  or account throttle state is added to logs; temporary budget exhaustion remains monitorable
  operational risk, not a permanent account lock.
- Password changes during/after verification were not bound to session issuance; old sessions
  could survive an out-of-band reset. Credential versions plus a DB password-change trigger
  invalidate old sessions, and login issuance checks the exact verified hash/current version
  with account locking. Single-use pre-auth consumption, cookie/CSRF rotation preserved.
- Role mutation checked current role but not session validity at the mutation statement;
  audit reads relied on middleware authority. Both now recheck active session/version/role
  in the protected statement. Audit-read logging/read and role mutation/logging remain atomic.
  DB wall clock replaces transaction-start now() for expiry decisions. Already-authorized
  in-flight operations may complete concurrently with logout; later requests cannot use it.
- A new regression proved disabling then re-enabling revived old cookies. 004 had already
  been applied in test DB, so it was preserved; append-only 005 adds automatic version advance
  on disable. Re-enable now requires fresh login. Original migrations 001–003 unchanged.
- Production admin startup previously accepted owner/superuser DB credentials. New read-only
  catalog gate rejects owner/elevated memberships, excessive object/column privileges, missing
  required grants/triggers and trigger-bypass capability before opening HTTP. Audit id/time
  INSERT and all audit column UPDATE are rejected; runtime never creates accounts or changes
  passwords/disabled/version. No PostgreSQL roles/grants/credentials were modified.

### Files

New backend/migrations/004_admin_hardening.sql, 005_admin_disable_revocation.sql,
backend/src/admin/database-security.ts, backend/tests/hardening.test.mjs,
backend/tests/integration/hardening.test.mjs. Updated admin repository/routes, lifecycle,
lifecycle tests, RBAC integration call signature, backend README/production env example,
docs/DEPLOYMENT.md and PROGRESS.md. Existing Stage 9.1–9.2 uncommitted changes preserved.
No dependencies, UI, parent accounts, CRUD, existing migrations or CI gates changed.

### Actual verification

- Backend build/lint/typecheck PASS; unit **116/116 PASS**, skipped 0.
- Dedicated PostgreSQL **43/43 PASS**, skipped 0: shared account budgets/reset, unknown-user
  response uniformity, fixation/single-use pre-auth, old-CSRF denial, credential reset,
  revoked/expired/disabled/demoted authority, disable/re-enable and catalog SQL execution.
  The migration-owner test connection correctly fails runtime privilege validation.
  Earlier disable/re-enable regression failed before 005; then passed. A catalog-column
  overload error was caught by direct SQL integration and corrected with documented PG
  privilege functions; no error was swallowed into a false passing catalog test.
- Frontend build/lint/typecheck and **29/29 tests PASS**. Built-dist Chrome **24/24 PASS**,
  real dev backend received GET only; no admin UI or actual contact submission involved.
- Release security **15/15 PASS**; full-HEAD append-only source/migration guard and actual
  artifact guard PASS; git diff whitespace check PASS (Windows line-ending warnings only).
- Audit command exit 0: backend all/prod 0; frontend prod 0, all 10 moderate dev-tool findings.
  No package installed/upgraded. Existing pgpass deprecation warning remains.
- Only balaqoldau_test received append-only migrations 004/005; synthetic accounts/sessions/
  counters/test triggers rolled back. Dev/balaqoldau_db/unrelated databases not changed;
  no real user credential/role changes or production infrastructure operations.

Stage 9.3 implementation/local verification complete. A positive staging run under the actual
restricted runtime role is still required (unit safe-result branch is not that certification).
Also pending: real HTTPS/proxy/cookie tests, operator recovery and grant-drift monitoring,
expiry/audit retention scheduling and external privileged-operator controls. Audit outages
fail closed; failed logout reports 503 and needs retry/operator revocation, never false success.
DB owners/superusers can defeat triggers; no tamper-proof audit or public production readiness
claim. No commit/push/merge/deploy/main changes, no next stage started.

## Stage 10.1 — Admin Program CRUD API

### Implementation

- Inspected the existing schema/auth/RBAC/security conventions. Added private program list,
  create, UUID detail, PATCH and submit/approve/reject/publish/unpublish endpoints under
  /api/admin/programs. Existing public API, view and published/non-DEMO visibility unchanged.
- Editor creates/edits/submits own drafts only; Reviewer reviews but cannot edit/publish;
  Admin manages any draft and alone publishes/unpublishes. Creator/submitter cannot approve
  their own record, even Admin. Admin can reject a verified record back to draft for correction
  without publishing it first. Unknown/legacy-owner drafts are editable/submittable by Admin.
- Workflow draft → review → verified (human approval) → published. Source URL/name required
  for submission, verifiedAt/reviewedBy server-controlled on approval; publish requires reviewer
  provenance. DEMO stays draft and isDemo cannot be patched. Published edits blocked until
  unpublish, which clears approval and requires fresh review. No DELETE API; DB trigger also
  rejects ordinary DELETE of published rows. No real opportunity invented/seeded/published.
- Strict Zod body/query/UUID/action validation; bounded pagination/64-KiB program JSON,
  credential-free HTTPS URLs, age/date/taxonomy checks. Other auth JSON stays 2 KiB. PATCH
  requires version and mutable content only; every successful mutation increments version.
  Row locks plus stale-version conflict prevent lost updates. SQL parameters bind all inputs.
- Fresh session/credential-version/RBAC check and user/program locks inside a pool transaction;
  all content/association/state writes and audit INSERT commit or roll back together. Revocation
  after middleware is rechecked; audit failures yield safe 503 without partial rows or links.
  Denials are recorded after transaction rollback, with no title/description/URL/body logging.
- Append-only 006 adds review status, ownership/provenance/version fields, old/new audit status
  and published-delete guard. Migrations 001–005 unchanged; public view/DEMO constraint retained.
  Startup privilege gate extended for the guard, narrow program column grants and link-table
  operations; no program DELETE/TRUNCATE/owner privilege permitted. DB roles/grants unchanged.

### Files

New backend/src/admin/program-{schemas,repository,routes,transaction}.ts,
backend/migrations/006_admin_program_workflow.sql, backend/tests/program-admin.test.mjs,
backend/tests/integration/program-admin.test.mjs, backend/PROGRAM_API.md.
Updated admin routes/repository/database-security, backend/package.json test:db concurrency,
production env example, backend README, docs/DEPLOYMENT.md and PROGRESS.md.
No dependencies/lockfiles/frontend files/CI security thresholds modified.

### Verification and actual regressions fixed

- Initial schema test failed before implementation. TypeScript caught an unsafe partial merge;
  fixed with explicit field/null handling. Workflow tests caught a PostgreSQL parameter-type
  ambiguity; explicit text binding fixed it. Safe 503 and rollback held during the failure.
- Parallel DB fault-injection tests both tried transactional audit-trigger DDL and deadlocked.
  test:db now runs files with --test-concurrency=1 on the shared dedicated schema; no skipped
  tests/assertions or relaxed security gates. Concurrent revision requests still run within
  the program test. Production pool commit/rollback path is unit-tested separately.
- Backend build/lint/typecheck PASS; **118/118 unit tests PASS**, skipped 0.
- PostgreSQL suite **53/53 PASS**, skipped 0. Program cases cover 401/403/CSRF, strict fields,
  ownership, taxonomy, duplicate slug, literal SQL injection, mixed age bounds, approval/reject,
  publish/unpublish, private/public/DEMO visibility, published edit/delete guards, revisions,
  self-approval, long Unicode body, atomic create/update/audit failure and in-flight revocation.
- Frontend build/lint/typecheck and **29/29 tests PASS**; built-dist browser **24/24 PASS**,
  real development backend GET requests only. Release security **15/15 PASS**; full-HEAD
  source/migration policy and actual artifact checks PASS; diff whitespace PASS.
- Audit exit 0: backend all/prod 0; frontend prod 0, all 10 moderate dev-tool findings.
  Existing pgpass deprecation warning remains. No package installed/upgraded.
- Only balaqoldau_test received migration 006; all synthetic programs/users/links/temporary
  triggers/state/audit changes rolled back. Dev, balaqoldau_db and unrelated DB untouched.

Stage 10.1 implementation/local verification complete. Production must apply 006 with the
migrator, grant the documented narrow runtime columns, and pass real restricted-role HTTPS/
multi-connection staging verification; positive runtime-grant certification remains pending.
Human source/eligibility/deadline verification, audit/expiry scheduling and monitoring still
require operators. No admin UI, parent accounts, unrelated features, commit/push/merge/deploy,
main changes or automatic next-stage work.



## Stage 10.2 — Admin Dashboard UI (2026-11-12)

Implemented separate lazy-loaded /admin routes in the existing GovTech frontend:
Kazakh login/logout, server session verification, role-aware navigation, real program
search/status pagination, details, create/edit forms and confirmed workflow actions.
Editor ownership, Reviewer human-review acknowledgement and Admin publication controls
reflect server permissions; backend authorization remains authoritative on every request.
No public registration, parent accounts, fake API data or unrelated management screens.

Security: HttpOnly cookies with same-origin credentials, memory-only CSRF, no auth storage,
no-store requests, safe localized errors and no automatic mutation retries. 401 clears private
UI; visible-tab/focus session refresh detects expiry; identity changes reset form trees.
403 offers explicit refresh. Revision conflicts preserve typed edits and block stale writes
until explicit reload; unknown mutation outcomes require server-state verification.

Files: new balaqoldau/src/admin/{AdminApp,Programs}.tsx, api.ts, types.ts, context.ts,
form.ts and admin.css; tests/admin-api.test.mjs, tests/admin-browser.mjs and
tests/helpers/admin-browser.mjs. Updated frontend App.tsx, package.json, .env.example,
README.md; backend admin program schemas/repository/routes and integration tests;
backend/PROGRAM_API.md, docs/DEPLOYMENT.md and this log.
The private program list now accepts bounded literal q search; authenticated taxonomy
returns actual categories/regions/family categories, including unused choices. Queries
remain parameterized; >1000 taxonomy rows fail safely instead of silently truncating.
No new schema migration, dependencies or lockfile changes for Stage 10.2; inherited
Stage 10.1 work is preserved.

Verification:
- Frontend build/lint/TypeScript PASS; unit tests **35/35 PASS**.
- Backend build/lint/TypeScript PASS; unit tests **118/118 PASS**;
  dedicated PostgreSQL integration suite **53/53 PASS**, no skipped tests.
- Real built React -> Express -> balaqoldau_test admin browser scenarios **14/14 PASS**:
  login/cookies/CSRF, Editor create/submit, Reviewer approval, stale-role server 403,
  Admin publish/unpublish/public visibility, search/status/empty/error/retry, revision
  conflicts, expiry, keyboard focus/labels and 320/375/768/1024/1440px layouts.
  Synthetic accounts/programs/sessions/audit data are enclosed in BEGIN/ROLLBACK;
  no existing development/production messages or programs were changed.
- Existing public browser suite: development **23/23 PASS**, built dist **24/24 PASS**;
  real development database smoke makes GET requests only. Remaining public scenarios
  use the existing browser-only test fixtures; admin tests use real APIs/database.
- Release security tests **15/15 PASS**; full-HEAD append-only migration/source/license
  policy and actual production artifact checks PASS. No security gates relaxed.
- Dependency audits exit 0 with registry access: backend all/production 0; frontend
  production 0, all 10 existing moderate development-tool findings; high/critical 0.
  Sandbox initially prevented registry access and Chrome execution; reruns with approved
  access passed. Initial lint/helper issues were fixed without disabling assertions/rules.

Local implementation and verification complete. Browser accessibility checks cover labels,
focus, overflow and computed text contrast, not full WCAG certification; manual assistive-
technology testing is still required. Production must use HTTPS same-origin admin ingress,
existing secure-cookie/CSRF configuration, restricted runtime DB grants and staging checks
documented in DEPLOYMENT.md. Existing pgpass deprecation warning and 10 moderate frontend
development findings remain. No commit, push, merge, deployment or main branch changes.

## Stage 11 — User authentication and personal accounts (2026-11-12)

Implemented opt-in regular-user auth without changing admin principals, RBAC, APIs or cookies.
New additive migration 007: user_accounts, user_sessions, user_reset_tokens, indexes and
credential-rotation trigger. Separate /api/auth session/register/login/logout/profile and
password-reset request/confirm routes use strict Zod validation, parameterized SQL, bounded
Argon2id, cookie/CSRF rotation, exact Origin/Fetch Metadata checks, independent rate limits,
absolute expiry, safe no-store errors and server-side authorization. Profile never accepts
a user ID. Persistent account throttles complement process-local IP gates. Production
startup additionally rejects unsafe user-table role permissions; no role changes executed.

Added lazy-loaded GovTech registration/login/recovery/profile pages with KZ/RU auth text,
state-preserving language switching, no credential/token client persistence, accessible
labels/focus, loading/errors/success and responsive layouts. Existing contact email validator
is reused without changing its accepted inputs. Public header links to /profile.
The browser regression found a same-page reset-link bug; hashchange handling now replaces
the memory token and clears the fragment. Login/reset never blindly retry mutations.

Reset tokens are random, stored hashed, expiring and single-use; successful reset atomically
invalidates all prior user sessions/tokens. Delivery is optional via an already configured
local sendmail-compatible MTA, no shell/process-argument personal data and bounded timeout.
No MTA was installed or live delivery configured/tested. Missing config is explicitly
unavailable in API/UI; acceptance never asserts email delivery or account existence.
Dispatch is bounded best effort, not a durable outbox; delivery monitoring and restart-loss
handling remain operational limitations. Registration is not email/identity verification.

Files: backend/src/users/{schemas,repository,routes,mail,database-security}.ts;
backend/migrations/007_user_accounts.sql; app.ts, config/env.ts, lifecycle.ts, package.json;
backend tests/user-auth.test.mjs, tests/users/user-accounts.test.mjs and
tests/helpers/user-database.mjs; balaqoldau/src/account/{api,translations}.ts, AccountPage.tsx,
account.css; App.tsx, api/contact.ts, package.json and user-auth/user-browser tests.
Updated root/backend/frontend README, backend .env examples, backend/USER_AUTH.md,
docs/SECURITY.md, docs/DEPLOYMENT.md, CI workflow and this log. Previous uncommitted
Stages 10.1/10.2 and user edits (including admin/provision.ts) were preserved.

Verification:
- Backend build/lint/typecheck PASS; **123/123 unit tests PASS**, skipped 0.
- Frontend build/lint/typecheck PASS; **38/38 tests PASS**, skipped 0.
- New DB security suite **16/16 PASS**: strict validation, CSRF/origin, duplicate safety,
  hashing/session rotation, user/admin isolation in both directions, logout, token hashing/
  expiry/replay, password/session revocation, disabled users, IP/account throttling, real
  PostgreSQL production-privilege query/owner rejection, production cookie/HTTPS behavior,
  unavailable delivery and safe delivery-failure logs.
- Only verified loopback **balaqoldau_dev** was accessed locally. First migration run applied
  007 (one migration); subsequent runs applied zero. Synthetic user/admin/session/reset/
  audit fixtures were enclosed in BEGIN/ROLLBACK. No existing account data overwritten,
  no catalog population or contact cleanup, no balaqoldau_db/balaqoldau_test access.
- Real built frontend/Express/PostgreSQL browser suite **12/12 PASS**, including KZ/RU,
  registration/login/profile/logout/reset/replay/expiry, private UI removal, user-to-admin
  denial, existing admin login/list/logout, honest no-mail state, contrast/labels/focus and
  320/375/768/1024/1440px layouts. Existing public built-browser regression **24/24 PASS**.
- Release security **15/15 PASS**; full-HEAD source/license/append-only migration policy
  and actual production artifact checks PASS. Audit exit 0: backend all/prod 0; frontend
  prod 0, all 10 existing moderate development findings, high/critical 0. No dependencies
  installed/upgraded or security gates weakened. pgpass deprecation warning remains.
- Full git diff whitespace check reports pre-existing admin/provision.ts:36 trailing space;
  that already-modified unrelated file was not edited during Stage 11.
- Added dedicated CI user-DB step, using only the existing isolated CI database when both
  CI/GITHUB_ACTIONS are true. Older local full test:db/admin-browser intentionally target
  balaqoldau_test and were not run under the current dev-only authorization. No GitHub CI
  execution/push is claimed; current admin behavior is checked by unit and real dev-browser tests.

Implementation/local verification complete. Remaining setup: enable USER_AUTH_ENABLED and
exact USER_ORIGIN in protected local configuration; configure/test real mail delivery if
recovery is required; apply approved production grants/TLS and restricted-role HTTPS staging;
publish account privacy/deletion policy, schedule expired-session/token cleanup and backup
expiry, monitor delivery/rate limits/shared KDF capacity. No automatic account deletion,
verified email ownership, durable reset outbox or full manual WCAG certification is claimed.
No credentials changed, commit/push/merge/deploy/main changes or automatic next-stage work.

### Stage 11 — Regular-user password policy update

Regular-user registration/login/reset now require at least 8 Unicode code points and at
most 256 UTF-8 bytes. Admin hashing/provisioning keeps its fixed 15-character minimum.
Separate fixed user/admin hash entry points share the unchanged Argon2id parameters,
random salts and bounded KDF concurrency. CSRF, cookies, rate limits and sessions unchanged.
Frontend/backend boundary tests compare identical ASCII, Cyrillic and emoji inputs at
7/8/14/15 characters and 256/257 bytes; byte limits never truncate passwords.
KZ/RU hints and password-specific validation errors updated, including safe API error mapping.

Changed backend admin/password.ts, users/schemas.ts, users/routes.ts, user-auth unit/DB tests;
frontend account/{api.ts,AccountPage.tsx,translations.ts}, user-auth and user-browser tests;
backend/USER_AUTH.md and this log. No dependencies, migrations or account data changed.

Verification: backend build/lint/typecheck PASS, **125/125 tests PASS**; frontend production
build/lint/typecheck PASS, **39/39 tests PASS**; dev-only DB suite **16/16 PASS**; real browser
suite **13/13 PASS** including 7-character rejection, 8-character registration/login/reset,
and unchanged admin login/list/logout using a separate >=15-character fixture password.
Release security **15/15 PASS**; source/license/append-only migration and artifact checks PASS.
Only balaqoldau_dev accessed; migration reruns 0; synthetic fixtures rolled back. Existing
email-delivery setup requirements and pgpass warning remain. No commit/push/deploy/main changes.

### Stage 11 — Auth visual cleanup (2026-11-13)

Removed visible language controls from login/register/forgot/reset pages and the password
helper paragraph, including its now-invalid aria-describedby reference. Profile language
controls, KZ/RU dictionaries, URL-based localization, 8-character/256-byte validation and
all authentication/security behavior remain unchanged; admin pages untouched.
Updated AccountPage.tsx, user-browser.mjs and frontend README. Browser tests first failed
on the old visible controls, then passed with real registration/login/reset/logout/expiry,
Russian URL localization, responsive/keyboard checks and existing admin login/list/logout.
Frontend lint/build (including TypeScript) PASS, unit **39/39 PASS**, browser **13/13 PASS**.
Only dev database synthetic browser fixtures used; rolled back. No commit/push/deploy.

## Stage 12 — User Profile & Saved Programs (2026-11-13)

Implemented personal overview/editor with optional full name and city/region, immutable
authenticated email, available saved count, search/saved navigation and existing logout.
Added /profile/saved with pagination, save/remove from results/details, detail/back context,
honest loading/error/empty/success states and KZ/RU dashboard text. Auth pages still have
no standalone language controls or password helper. Existing GovTech cards were extracted
for reuse, not redesigned. Anonymous browsing stays public; save offers a safe local login
returnTo preserving filters/page, without auto-saving or redirecting before the user chooses.

Shared memory-only user session/CSRF state now serves auth pages, profile and save controls,
avoiding duplicate independent session bootstrap races. Saved status batches at most 50
displayed IDs instead of one request/card. Identity changes/401 clear private UI; stale reads
cancel, mutations do not auto-retry. Unknown profile-write outcomes require explicit reload
with a discard warning. Legacy localStorage favorites remain readable/explicitly clearable
at /favorites; no silent import, deletion or new anonymous local saves.

Migration 008 adds nullable full_name/location and user_saved_programs (composite PK, FKs,
indexes, private grants). Only verified loopback balaqoldau_dev used locally; one migration
applied, subsequent runs zero. Existing accounts/admin/program data unchanged. Integration
and browser TEST programs/accounts/sessions/audit fixtures use BEGIN/ROLLBACK and are not
visible in the persistent catalog. No seeds, database resets/deletions, local role changes,
external services, children or application tracking. No balaqoldau_db/balaqoldau_test access.

API: GET/PATCH /api/auth/profile; GET /api/auth/saved-programs (page 1–10000, limit 1–50),
GET /api/auth/saved-programs/status (1–50 UUIDs), POST/DELETE /api/auth/saved-programs/:uuid.
Strict query/param/body schemas deny user IDs, email edits and extra fields. NFC normalized
profile fields are optional, <=100 Unicode code points, no C0/C1 controls. Ownership is
rechecked from token digest/current credential version/expiry in every SQL statement.
Unique saved keys make repeated saves safe; deletion is owner-scoped/idempotent. Only
published non-DEMO view records contribute to lists/status/count. Unpublished associations
stay private; deleted programs cascade saved links. No personal-data logging added.

Files: backend/migrations/008_user_profiles_saved_programs.sql; users/dashboard-{schemas,
repository,routes}.ts, users/routes.ts/database-security.ts; api/repository.ts exports the
existing public DTO SELECT; user dashboard unit/DB tests and package.json. Frontend adds
account/context.ts, UserProvider.tsx, ProfilePage.tsx, SavedProgramsScope.tsx, saved.css,
components/ProgramCard.tsx; updates account API/auth page/translations/CSS, App routes,
public parser export and browser/unit tests. Updated root/backend/frontend README,
USER_AUTH.md, new USER_PROFILE.md, DEPLOYMENT/SECURITY docs and this log. Prior work preserved.

Verification:
- Backend build/lint/typecheck PASS; **128/128 unit tests PASS**, skipped 0.
- Frontend production build/lint/typecheck PASS; **42/42 tests PASS**, skipped 0.
- Dev-only auth/dashboard DB suites **22/22 PASS**, covering ownership/IDOR, 401, CSRF,
  normalization, email immutability, duplicate saves, per-user isolation, pagination/UUID/
  injection rejection, unavailable/draft/DEMO/deleted programs, counts, revocation and logout.
- Real built React/Express/PostgreSQL user/dashboard browser **22/22 PASS**; existing public
  built-browser **24/24 PASS**. Profile persists, results/detail saves work, removal/back and
  login return preserve context, unpublished rows disappear, real loading/fault/retry works,
  labels/contrast/layout checked at 320/375/768/1024/1440; admin login/list/logout preserved.
  Synthetic dashboard screenshot visually reviewed, stored only in ignored node_modules cache.
- Release security **15/15 PASS**; source/license/append-only migration and artifact checks
  PASS. Audit exit 0: backend all/prod 0; frontend prod 0, all 10 existing moderate dev-only
  findings, high/critical 0. No packages or security gates changed. Existing pgpass and
  single-transaction test-client parallel-query deprecation warnings remain visible.
- Initial test fixture tried publishing DEMO and correctly hit existing demo_stays_draft;
  fixture corrected, constraint preserved. Old anonymous-local-save browser assertion was
  updated to the explicitly requested login flow, with a legacy-data preservation test.
- Review found session FOR SHARE incompatible with denied session UPDATE privileges.
  Fixed by locking only the authorized user row, retaining same-statement session validation;
  regression asserts no session row lock/UPDATE grant dependency. PostgreSQL docs linked.
  Positive restricted-role staging certification still pending; no roles created/modified.

Stage 12 implementation/local verification complete. Remaining: apply reviewed migration/
narrow grants in a real TLS staging environment before production, publish optional-profile/
saved-interest privacy and authorized deletion/backup policy, retain existing Stage 11 mail/
cleanup/monitoring obligations, manual assistive-technology testing. No full WCAG or production
readiness certification. Local manual URLs: http://localhost:5173/profile,
http://localhost:5173/profile/saved, http://localhost:5173/results, /program/:published-uuid;
append ?lang=ru for dashboard Russian. No real catalog populated, commit/push/merge/deploy,
main changes or automatic next-stage work.

### Header language selector refinement (2026-11-13)

Replaced the static public-header indicator with a compact ҚАЗ/РУС menu using the existing
URL lang locale. Removed the duplicate profile/saved language button group and its obsolete
CSS; no localization dictionary, auth logic, backend, database or admin permission changes.
URL locale carries across navigation while preserving filters/hash/route state and explicit
language choices. No second locale state or locale storage was added. The dropdown supports
radio-menu ARIA, arrow/Enter navigation, Escape/focus return, outside pointer/focus dismissal
and remains visible/in-bounds at 320/375/768/1024/1440px.

Changed frontend App.tsx, new components/LanguageSwitcher.tsx, language.ts/language.css,
ProfilePage.tsx, account.css/refinements.css and language/browser tests. Frontend
lint/typecheck/production build PASS; **43/43 unit tests PASS**, built-browser **29/29 PASS**.
Browser auth/profile responses are UI fixtures, so no account/profile database writes were
needed; real public API smoke remained GET-only. Tests verify language/navigation, preserved
profile draft input, removal of duplicate controls and five responsive widths. New helper
test failed before implementation; menu test synchronization was fixed without weakening
assertions. Full real-auth DB/browser fixture suite was not run for this frontend-only task.
No commit/push/deploy/main changes.


## Stage 13 - Complete KZ/RU localization (2026-11-13)

Completed shared public/admin dictionaries (305 paired messages) and retained the
existing account/profile dictionary (59 paired messages). Centralized navigation,
footer, forms, validation, loading/empty/error/success text and admin workflow labels.
The sole header dropdown uses existing URL lang state; language updates in place,
internal navigation and refresh preserve it. Admin has the same single main-header
control. Locale changes no longer remount search forms, discard unsent search input,
or trigger language-only program requests. Fixed stale admin validation summaries
and the corrupted missing-taxonomy message. API errors remain safe/localized.

Official program/source/category/region content stays original: no verified translated
API fields exist. Added explicit content fallback notice and docs/LOCALIZATION.md
with all 20 audited route patterns, limitations and reproducible commands. Native
language names/indicators, branding, technical identifiers and canonical search values
are intentional invariants. Static AST regression audit found no other hardcoded
Cyrillic UI in active modules; all shared translation references resolve. Unused
historical demo data is excluded from UI translation and remains unpublished.

Verification: frontend unit tests 48/48 PASS; lint PASS; typecheck PASS; production build PASS.
Built frontend localization browser suite 57/57 PASS (40 route/language cases plus
state/workflow checks), including all routes at 375px, immediate switching, one
switcher, refresh persistence, stored errors, contact success and admin confirmations.
Existing built browser regression suite 29/29 PASS, including keyboard/focus,
responsive layouts and computed contrast. The first public browser attempt failed
startup because inherited local auth settings activated auth database requirements;
its owned public GET-only smoke server now explicitly disables auth, whose requests
are fixtures. No application authentication security settings were changed.

Changed frontend App/API-message modules, Home/search/contact/request components,
admin pages/forms/error mappings, shared i18n/locale helpers, browser/unit tests,
package script, README files, localization documentation and this progress entry.
No backend/schema/credential changes, database writes, dependency installation,
commit/push/deploy or main changes. Localization tests use API fixtures only; the
existing real smoke performs public GET requests against balaqoldau_dev only.
Real-auth mutation browser suites were not run because they write DB fixtures.
Browser-native input dialogs follow browser locale; verified program translations
and manual assistive-technology testing remain separate work.
