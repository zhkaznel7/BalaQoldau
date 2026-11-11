# BalaQoldau — даму барысы

Ағымдағы күй: Stage 7 жергілікті Final QA, Security және Deployment Readiness шолуы аяқталды (2026-11-11). Public launch әлі мақұлданған/орындалған жоқ; төмендегі launch gates міндетті. Ертерек жазбалар тарихи есеп ретінде сақталған.

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
