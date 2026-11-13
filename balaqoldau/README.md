# BalaQoldau — GovTech порталы және әкімші/пайдаланушы интерфейсі

Stage 15: `/profile/children` — бірнеше бала профилін құру, өңдеу, растаумен жою және
жеке ұсыныстар. Жас/өңір public URL-ге көшірілмейді; профильге сезімтал отбасы мәртебесі
сақталмайды. [API, құпиялық және қолмен тексеру](../backend/CHILD_PROFILES.md).

Stage 14: `/find` талаптарды салыстыру режимін қосады; `/results` ішінде режимді
ауыстыруға болады. Сәйкес емес және белгісіз нәтижелер ашық түсіндірмемен көрсетіледі.
Бұл ресми мақұлдау емес. [Алгоритм, API және жергілікті тексеру](../docs/MATCHING.md).

Тіл таңдау header-дегі ықшам ҚАЗ/РУС dropdown арқылы іске асады. Қолданыстағы `lang`
URL параметрі навигацияда сақталады; профильдегі қайталанатын тіл батырмалары алынды.

Stage 13: public, пайдаланушы және admin интерфейсі қазақша/орысша аударылған.
Сөздіктер, ресми контенттің бастапқы тілдегі fallback тәртібі және тексерілген 20 маршрут:
[локализация құжаты](../docs/LOCALIZATION.md). `npm run build` кейін
`npm run test:localization` екі тілдегі маршруттарды дерекқорсыз тексереді.

Stage 12: `/profile` — optional аты-жөні/қала/өңір, email тек көрсету, сақталғандар саны;
`/profile/saved` — PostgreSQL-де сақталған жария бағдарламалар. `?lang=ru` орысша UI қосады.
Аноним сақтауды басқанда ағымдағы бетіне қайтаратын login ұсынысы шығады; іздеу ашық қалады.
Бұрынғы браузер таңдаулылары `/favorites` ішінде сақталды, автоматты көшірілмейді/өшірілмейді.
[API, миграция және production құқықтары](../backend/USER_PROFILE.md).

Stage 11: `/register`, `/login`, `/forgot-password`, `/reset-password` және қорғалған
`/profile`. Auth интерфейсінің тілі `?lang=kk` немесе `?lang=ru` арқылы таңдалады;
кіру/тіркелу/reset беттерінде тіл ауыстырғыш пен пароль кеңесі көрсетілмейді.
Жалпы каталогтың тілі өзгермейді. Құпиясөздер мен токендер localStorage
ішінде сақталмайды. [Backend баптауы және қауіпсіздік](../backend/USER_AUTH.md).
Екі build-тен кейін `npm run test:user-browser` нақты API/DB арқылы тексереді; уақытша
жазбалар тек жергілікті balaqoldau_dev ішінде жасалып, транзакциямен кері қайтарылады.

## Stage 10.2 — Әкімшілік бөлім

`/admin/login` және `/admin/programs` public layout/catalog/favorites-тен бөлек lazy-loaded
React route. Login/logout, session bootstrap, role-aware навигация, search/status/pagination,
draft create/edit/detail және рұқсат етілген workflow әрекеттері нақты backend API қолданады.
Mock/fallback бағдарламалар, ашық тіркелу немесе parent accounts жоқ.

Іске қосу алдында backend migrations 001–006, separate runtime grants және offline Editor/
Reviewer/Admin provisioning қажет ([backend contract](../backend/PROGRAM_API.md)). Backend
local env: ADMIN_ENABLED=true, ADMIN_ORIGIN нақты Vite origin (мысалы http://localhost:5173),
DATABASE_URL тек бекітілген development DB. Existing env/password файлдарын overwrite етпеңіз;
осы кезеңде real accounts/provisioning/production grants өзгертілмеді.

Frontend `npm run dev`, backend `npm run dev` бөлек терминалдарда. Vite `/api` proxy қолданылады.
Production HTTPS same-origin reverse proxy керек: `/admin/*` → SPA index, `/api/admin/*` →
Express. `VITE_ADMIN_API_BASE_URL=/api/admin` — public path only, cross-origin URLs rejected;
admin transport public API-дің cross-origin base setting-ін қолданбайды. Secrets ешқашан VITE_* емес.

Cookies браузер арқылы `credentials:same-origin`, CSRF token memory-only, private GET no-store,
redirects rejected. Password/token/session identifiers localStorage/sessionStorage/URL/log-қа
түспейді. 401/private expiry clears protected UI; focus/pageshow және 60s visible-tab check
session/role жаңартады. Identity ауысса private form tree қайта құрылады. UI controls — UX;
backend әр action/session/role/ownership/CSRF/version-ды міндетті қайта тексереді.

409 edit/action conflict пен unknown network outcome automatic retry жасамайды: typed draft
сақталып, Save/actions бұғатталады; explicit reload unsaved changes-ті жоятыны көрсетілген.
Create duplicate-slug conflict басқа slug таңдауға мүмкіндік береді. Logout failure success
деп көрсетілмейді: session refresh/retry қажет. Private draft contents persisted емес.

Тексеру (dependencies алдын ала орнатылған, Node 24.7+):

```sh
npm run build
npm run lint
npm run typecheck
npm test
# Backend build және dedicated TEST_DATABASE_URL/pgpass конфигурациясынан кейін:
npm run test:admin-browser
```

`test:admin-browser` нақты headless Chrome → built dist → Express → balaqoldau_test.
Synthetic account/program/session fixtures бір transaction ішінде ROLLBACK; no real admin
password required. Backend DB suite-мен қатар жүргізбеңіз (shared transactional DDL fixtures).
Chrome path CHROME_PATH арқылы өзгертіледі; browser/user profile және screenshots ignored
node_modules/.cache ішінде. 320/375/768/1024/1440 widths, keyboard/labels/contrast тексеріледі;
толық WCAG certification емес. Real restricted-role HTTPS staging және assistive testing қажет.

Ескі public browser QA `BROWSER_BUILD=true npm run test:browser` unchanged; actual dev API
GET-only smoke plus intercepted public UI fixtures. Admin browser suite uses real DB/API.

React + TypeScript интерфейсі нақты Express API-ге қосылған. Іздеу/details/favorites
hardcoded DEMO тізімін қолданбайды. Development базасында тек екі DEMO draft бар;
public нәтиженің бос болуы қалыпты. Public беттер бағдарлама жарияламайды; admin әрекеттері backend рұқсатымен ғана орындалады.

## Ағымдағы дизайн

Тәуелсіз ақпараттық платформаға арналған white/navy/blue GovTech жүйесі: ықшам іздеу,
оң жақтағы үш қадамдық нұсқаулық, мәтіндік каталог және results тізімі. Үлкен marketing
тақырыптары/eyebrow/иконкалы санат карточкалары алынды; шағын түпнұсқа SVG оюы қосылды.
Header/footer бұл мемлекеттік органның ресми сайты емес екенін анық көрсетеді.
eGov логотипі/мемлекеттік рәміздер қолданылмайды. Төрт бағыт — `q` кілтсөз сілтемелері;
нақты category/region әлі API-ден келеді. Ешбір бағдарлама ойдан қосылмаған.

Ескі photo/atlas CSS орнына ортақ token/component stylesheet қолданылды. Қазір hero
фотосурет жүктемейді; бұрынғы фото файлы/credits өзгертілмеді. Жаңа dependency/font жоқ.
[Дизайн шешімдері](DESIGN_DIRECTION.md), [токендер](design-system/balaqoldau/MASTER.md).

## Іске қосу

Node.js 24+ қажет. Репозиторий түбірінен бірінші терминалда:

```powershell
cd backend
npm.cmd run build
npm.cmd start
```

Backend `.env`/PostgreSQL авторизациясы [backend README](../backend/README.md)
бойынша бапталған болуы керек. Бұл кезең үшін migration/seed қажет емес.
Екінші терминалда, репозиторий түбірінен:

```powershell
cd balaqoldau
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

`http://127.0.0.1:5173` ашыңыз. Басқа shell-де `npm.cmd` орнына `npm` қолданыңыз.
Public frontend configuration:

```dotenv
VITE_API_BASE_URL=/api
API_PROXY_TARGET=http://127.0.0.1:3001
```

Vite development proxy `/api` сұрауларын backend-ке жібереді. API_PROXY_TARGET тек
server конфигурациясы; VITE_API_BASE_URL browser-ге ашық. VITE_* ішіне пароль,
DATABASE_URL немесе токен жазбаңыз; backend `.env` файлын frontend-ке көшірмеңіз.
Public API base абсолют HTTP(S) URL да бола алады; credentials/query-token/fragment
және unsafe protocol қабылданбайды. Басқа API origin үшін backend CORS allowlist
frontend origin-ін нақты қамтуы тиіс. Production static hosting-те `/api` reverse
proxy немесе build-time public API base және React Router fallback бөлек қажет.

## Ағындар және қауіпсіздік

- Category card бірден `/results?category=<slug>` ашады. Category/region names API-ден,
  values — slug. Search: category, region, age (0–17), q (200-ге дейін), page/limit.
  Page 1–10000, limit 1–50 (default 20); filter өзгерсе page қайта 1 болады.
  Backend family/type filter қолдамайды, сондықтан олар серверге жіберілмейді;
  hero/find ішіндегі бұрынғы family select қолдау түрімен алмастырылды.
- `/program/:id`: нақты UUID бойынша public detail. Жоқ/жарияланбаған жазба — 404.
  API-де жоқ құжат/eligibility туралы ақпарат ойдан толтырылмайды.
- `/favorites`: тек UUID тізімі localStorage-да (max 50). Әр жазба public API-мен
  тексеріледі; 404 көрсетілмейді. Ескі DEMO IDs тасталады. Clear және blocked-storage
  session fallback бар. Аты-жөн/email localStorage-ға жазылмайды.
- `/contact`: footer «Байланыс» сілтемесі. senderName/email/message клиентте
  тексеріліп, POST /api/contact-messages-ке JSON болып жіберіледі. Pending/duplicate
  guard, success reset және explicit retry бар. Network/5xx белгісіздігінде duplicate
  warning шығады; автоматты POST retry жоқ. Inputs URL/logs/storage-ға жазылмайды.
  ЖСН, медициналық мәлімет және құпия жібермеу ескертіледі.
- Typed API adapter response shape-ті тексереді; DEMO/draft/verified payload және
  unsafe source/apply links қабылданбайды. AbortController/stable request keys,
  15s timeout, credentials omit/no-store, loading/empty/error/retry күйлері бар.
  React plain text-ті escape етеді, HTML ретінде көрсету қолданылмайды.
- Бар Kazakh UI/responsive стиль сақталған; pagination/contact шағын CSS қосылды.
  `src/data/programs.ts` тек legacy fixture тесттері үшін;
  runtime беттер импорттамайды және production bundle-ға кірмейді.

## Stage 6 — интерфейс және accessibility

Бар күлгін/mint палитра, логотип, Kazakh copy және отбасылық hero сақталды.
Typography, spacing, labels, feedback және touch targets реттелді. Contact desktop-та
анық form/help композициясы, mobile-де бір баған. Category grid санына тәуелді:
төрт және одан көп санатта editorial композиция сақталады, кейінгі карточкалар
қабаттаспайды; тар экранда ұзын атаулар табиғи оралады.

- Skip-link main-ге нақты focus береді. SPA route ауысқанда main focus және page
  title жаңарады. Search background response енгізу өрісінен focus ұрламайды;
  results count polite түрде хабарланады. Details back сілтемесі сүзгі/page сақтайды.
- Mobile/tablet navigation disclosure: Enter ашады, Tab сілтемелерге өтеді,
  Escape жабады және toggle-ға focus қайтарады; focus мәзірден шықса ол жабылады.
  Жасырын navigation links Tab тәртібіне кірмейді. Contact header-де де қолжетімді.
- Input labels explicit htmlFor/id қолданады. Contact error summary focus алады,
  link арқылы қате өріске апарады; aria-invalid/describedby, helper/counter және
  success/error icon+мәтін бар. Loading status skeleton-нан бөлек хабарланады.
- Visible focus ring, негізгі controls/footer links 44px hit area, wrapping,
  semantic h1/main және external-link жаңа қойынды ескертуі қосылды.
- Reduced-motion кіріс анимацияларын және smooth scroll-ды тоқтатады.
  Favorites context/retry callbacks тұрақтандырылды: announcement timer контекст
  consumers-ке қажетсіз жаңа value таратпайды. Жаңа dependency/analytics жоқ.

UI/UX Pro Max-тың existing-UI checklist нұсқаулары қолданылды, design-system
генерациясы/CLI search орындалмады. Unslop қолжетімді skill каталогтарынан табылмады.

## Тексеру

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd audit
npm.cmd run test:browser
```

Unit: 26/26 (18 API/navigation/contact + 5 legacy fixture + 3 contrast-calculation тесті).
Browser: 20/20, оқшауланған Chrome profile, өз Vite/Express процестері, бос порттар.
Backend build пен жергілікті PostgreSQL/pgpass қажет. Chrome default Windows path,
басқаша болса CHROME_PATH беріңіз. Browser suite нақты balaqoldau_dev-ке тек GET
жібереді (published empty state); қалған UI ағындары browser HTTP TEST fixtures
қолданады. Contact browser POST mock; нақты contact SQL/HTTP backend test:db арқылы
бөлек тексеріледі. Ешқандай бағдарлама жарияланбайды/DB-ге contact жазылмайды.
Navigation, filters, pagination, retry, stale cancellation, details/favorites,
private payload, contact сақталды. Stage 6 қосымша keyboard Tab/Enter/Escape,
skip/route focus, error summary, Chrome accessibility tree textbox names,
background focus retention, back context және reduced-motion тексереді.
320/375/768/1024/1440px ендерінде 10 бет/күй (50 комбинация) тексерілді: horizontal
overflow 0, unlabelled controls 0, solid background-та computed text contrast
қателері 0 (1413 қайталанатын мәтін тексеруі). WCAG AA thresholds: normal 4.5:1,
large 3:1. Алты ұзын API category атауының қабаттаспауы да бес енде тексерілді.
Codex filesystem sandbox ішінде CDP Page.enable timeout беруі мүмкін; осы сессияда
sandbox-тен тыс рұқсат етілген іске қосу өтті. Жеке browser/session қолданылмайды.
QA профильдері Git елемейтін node_modules/.cache ішінде. Ескі browser-check.mjs
entry point жаңа suite-ке бағыттайды.

Скриншоттар мен есеп алу үшін:

```powershell
$env:UI_REVIEW='final'
npm.cmd run test:browser
```

`node_modules/.cache/stage6-final-*.png` — desktop/320px snapshots;
`stage6-accessibility.json` — 50 layout есебі. Тексерулер custom DOM/color және
Chrome AX tree негізінде: axe-core орындалмады, NVDA/VoiceOver қолмен сынағы және
толық WCAG certification жасалған жоқ. Градиент/сурет үстіндегі мәтіннің pixel
контрастын бұл есеп сертификаттамайды. UI алдымен baseline, кейін final screenshot
бойынша визуалды тексерілді. Ресми негіз:
[WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html),
[disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/).

Stage 7 deployment/security нұсқаулығы: [runbook](../docs/DEPLOYMENT.md),
[retention және audit](../docs/SECURITY.md). Нақты есеп: [PROGRESS](../PROGRESS.md).
Production құрастырылымын Vite-сіз жергілікті QA proxy арқылы сынау:

```powershell
npm.cmd run build
$env:BROWSER_BUILD='true'
npm.cmd run test:browser
Remove-Item Env:BROWSER_BUILD
```

Backend build және local dev/test PostgreSQL алдын ала дайын болуы керек. Бұл adapter
тек тест үшін; Nginx/TLS deployment емес. Нақты API GET және browser TEST fixtures
сақталған. `node_modules/.cache/stage7-performance-built.json` — жергілікті, throttling жоқ
бір sample (FCP/LCP/CLS/long tasks); field Core Web Vitals/INP қорытындысы емес.
Ресми негіз: [Vite proxy](https://vite.dev/config/server-options.html#server-proxy),
[Vite environment](https://vite.dev/guide/env-and-mode),
[React effects](https://react.dev/reference/react/useEffect).

<details><summary>Архив: бұрынғы frontend DEMO сипаттамасы (ағымдағы іске қосу нұсқаулығы емес)</summary>

Қазақ тіліндегі әлеуметтік қолдауды іздеу платформасының frontend MVP нұсқасы.

## Іске қосу

```sh
npm install
npm run dev
npm run build
npm run preview
node --test tests/programs.test.mjs
```

Windows PowerShell орындау саясаты npm скриптін бұғаттаса, `npm.cmd` қолданыңыз. Тесттер TypeScript-ті тікелей орындайтын Node.js 22.18+ нұсқасын қажет етеді.

## Құрылымы

- `src/App.tsx`: маршрутизация, беттер, ортақ интерфейс компоненттері және таңдаулылар күйі.
- `src/components/Home.tsx`: қолданыстағы GovTech басты беті және MIT family-reading.svg иллюстрациясы.
- `src/components/SupportFinder.tsx`: басты беттегі өңір, жас және отбасы санаты бойынша ықшам іздеу.
- `src/components/DiscoverySearch.tsx`: нәтижелердегі мәтіндік іздеу мен өңір сүзгісі.
- `src/data/programs.ts`: дерек типтері, алты DEMO үлгі және асинхронды іздеу репозиторийі.
- `src/index.css`: Tailwind CSS, түс тақырыбы, бейімделетін дизайн және қозғалысты азайту параметрі.
- `src/refinements.css`: GovTech беттерінің бейімделетін стильдері.
- `tests/programs.test.mjs`: іздеу өлшемдерінің қиылысуы, жас шекаралары, бос нәтижелер және дерек сәйкестігі.
- `DESIGN_DIRECTION.md` және `design-system/balaqoldau/MASTER.md`: UI/UX Pro Max зерттеуі мен өнімге бейімделген дизайн шешімдері.

Қосымша браузерлік QA: Vite сервері мен тек QA үшін ашылған Chrome debugging сессиясы (`--headless --remote-debugging-port=9228` және бөлек `--user-data-dir`) бар кезде `node tests/browser-check.mjs` іске қосылады. Скрипт төрт viewport өлшемін, мәзірді, іздеуді, таңдаулыларды, бос нәтижені және reduced-motion режимін тексереді, соңында сол Chrome сессиясын жабады. Скриншоттар Git елемейтін `node_modules/.cache/` ішінде сақталады. Күнделікті тест үшін Chrome қажет емес.

## Мүмкіндіктер

Басты бет `/`, іздеу `/find`, нәтижелер `/results`, үлгі мәліметтері `/program/:id`, таңдаулылар `/favorites`. Сүзгілер URL параметрлерімен беріледі. Таңдаулылар осы браузердің `localStorage` қоймасында `balaqoldau:favorites` кілтімен сақталады. Сақтау бұғатталса, интерфейс ескерту көрсетіп, ағымдағы сессияда жұмысын жалғастырады.

## Деректер туралы

Барлық атау мен сәйкестік өлшемдері ойдан шығарылған және DEMO деп белгіленген. Ресми бағдарламалар, жәрдемақы сомалары немесе өтінім сілтемелері қосылмаған. Өтінім қабылданбайды. Аутентификация, AI және backend жоқ.

Кейін PostgreSQL деректерімен қосу үшін `programRepository` әдістерін тексерілген backend API адаптерімен ауыстырыңыз. PostgreSQL қосылым деректерін браузерге қоспаңыз. `officialUrl` тек тексерілген ресми сілтеме болғанда толтырылады.

Статикалық хостингте React Router маршруттарын тікелей ашу үшін барлық қолданба маршруттарын `index.html` файлына бағыттайтын SPA fallback орнатыңыз.

</details>
