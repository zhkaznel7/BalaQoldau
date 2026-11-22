# StartUp Battle catalog entry runbook

Use with [the source intake](STARTUP_BATTLE_CATALOG_INTAKE.md). The six entries below are for private drafts. Source checks are dated 2026-11-22. The system records a separate approval timestamp when an authorized reviewer verifies the record.

## Admin routes

| Task | Local URL or path |
| --- | --- |
| Staff sign-in | http://localhost:5173/admin/login |
| Catalog and duplicate search | http://localhost:5173/admin/programs |
| New draft | http://localhost:5173/admin/programs/new |
| Review or publish an existing record | `/admin/programs/<UUID>` |
| Edit an existing draft | `/admin/programs/<UUID>/edit` |
| API used by the panel | `POST /api/admin/login`, `GET /api/admin/access`, `POST /api/admin/programs`, then `POST /api/admin/programs/<UUID>/submit`, `/approve`, or `/publish` |

Use the same website origin for the admin UI and API. The local configuration expects exactly `http://localhost:5173`. On a deployed instance, use the corresponding site HTTPS origin. The staff session and CSRF token come from the existing sign-in flow.

**Local preflight.** At the time of testing, port 5173 served frontend HTML even at `/api/health` and `/api/admin/access`. Port 3001 served JSON and returned 401 on signed-out admin requests. In the terminal that owns the current frontend process, stop that process and restart from the repository root with `npm.cmd run dev --prefix balaqoldau -- --host localhost --port 5173 --strictPort`. The checked-in Vite config proxies `/api` to `http://127.0.0.1:3001` by default. If `API_PROXY_TARGET` is configured, confirm it points to the intended backend. Check that `http://localhost:5173/api/health` returns JSON and that signed-out `/api/admin/access` returns JSON with HTTP 401 before signing in.

## Common values for all six drafts

Set **Demo** and **Eligibility complete** to unchecked. Leave **Family support needs**, **Deadline**, and **Last day of availability** empty. The selected ages are completed-year discovery bounds for children. Application links are optional. Leave a link blank where the exact application route remains unconfirmed. Select **Nationwide** for B2, B3 and B4 to select all 20 production regions.

The form has one Title and one Description. Paste the Kazakh title into **Title** and the entire three-line block into **Description**. The block includes the Russian title and both descriptions.

| ID | Slug | Category | Minimum age | Maximum age | Region picker | Source name | Source URL | Application URL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B2 | childcare-state-allowance-under-18-months | benefits | 0 | 1 | Nationwide | Әділет · ҚР Еңбек және халықты әлеуметтік қорғау министрлігі | https://old.adilet.zan.kz/rus/docs/V2300032571 | Blank |
| B3 | allowance-raising-child-with-disability | benefits | 0 | 17 | Nationwide | Әділет · ҚР Әлеуметтік кодексі, 183-бап | https://old.adilet.zan.kz/rus/docs/K2300000224 | https://beta.egov.kz/services/3030?lang=ru |
| B4 | large-family-state-allowance | benefits | 0 | 17 | Nationwide | eGov.kz | https://beta.egov.kz/situations/419/1019?lang=ru | https://beta.egov.kz/services/4587?lang=ru |
| F1 | samsung-innovation-campus-kz | free-courses | 13 | 17 | Almaty city, Astana, Aktobe Region, Zhetisu Region | Samsung Kazakhstan | https://samsung-campus.kz/kz | https://samsung-campus.kz/ru/registration |
| C1 | astana-qosymsha-voucher | clubs | 4 | 17 | Astana | Астана қаласының әкімдігі | https://www.gov.kz/org/astana/press/news/details/1037193?lang=ru | https://qosymsha.kz/kz/statement/step-1 |
| C2 | zaysan-creative-club-voucher | clubs | 4 | 17 | East Kazakhstan Region | Зайсан ауданының әкімдігі | https://www.gov.kz/org/vko-zaysan/documents/details/1101737?lang=ru | Blank |

### B2 · Бала бір жарым жасқа толғанға дейінгі күтіміне байланысты мемлекеттік жәрдемақы

```text
RU — Государственное пособие по уходу за ребёнком до достижения им полутора лет
KK — Міндетті әлеуметтік сақтандыру жүйесіне қатыспайтын, балаға күтім жасайтын тұлғаға арналған ай сайынғы мемлекеттік жәрдемақы. Өтінішті бала туған күннен бастап 18 ай ішінде беруге болады.
RU — Ежемесячное государственное пособие лицу, которое ухаживает за ребёнком и не участвует в системе обязательного социального страхования. Подать заявление можно в течение 18 месяцев со дня рождения ребёнка.
```

Review the current statutory deadline and insurance distinction. The available eGov service entry mixes instructions for the state allowance and the insurance payment. Confirm the exact application route before adding it. Keep the rolling deadline in the description. [Ministry rules](https://old.adilet.zan.kz/rus/docs/V2300032571) · [Social Code, article 81](https://www.gov.kz/org/astana-uzsp/documents/details/1060115?lang=ru)

### B3 · Мүгедектігі бар баланы тәрбиелеушіге жәрдемақы

```text
RU — Пособие воспитывающему ребёнка с инвалидностью
KK — Мүгедектігі ресми белгіленген баланы тәрбиелейтін ата-анаға, асырап алушыға, қорғаншыға немесе қамқоршыға арналған жәрдемақы. Тұрақты тұру және құқықтық мәртебе талаптарын Қазақстан Республикасының Әлеуметтік кодексінен қараңыз.
RU — Пособие родителю, усыновителю, опекуну или попечителю, воспитывающему ребёнка с установленной инвалидностью. Условия постоянного проживания и правового статуса приведены в Социальном кодексе Республики Казахстан.
```

Check the disability determination period, caregiver status, residence and legal status against article 183 and the current service rules. [Social Code](https://old.adilet.zan.kz/rus/docs/K2300000224) · [eGov application](https://beta.egov.kz/services/3030?lang=ru)

### B4 · Көпбалалы отбасына жәрдемақы

```text
RU — Пособие многодетной семье
KK — Бірге тұратын төрт және одан көп есепке алынатын баласы бар отбасыларға арналған жәрдемақы. Күндізгі бөлімде оқитын балалар оқуын аяқтағанға дейін, бірақ 23 жасқа толғанға дейін есепке алынуы мүмкін. Жәрдемақы отбасының табысына қарамастан тағайындалады.
RU — Пособие семье с четырьмя или более совместно проживающими детьми, учитываемыми по правилам программы. Учащиеся очной формы могут учитываться до окончания обучения, но до достижения 23 лет. Пособие назначается независимо от дохода семьи.
```

Confirm household counting, co-residence and the full-time study exception. [eGov eligibility](https://beta.egov.kz/situations/419/1019?lang=ru) · [eGov application](https://beta.egov.kz/services/4587?lang=ru)

### F1 · Samsung Innovation Campus

```text
RU — Samsung Innovation Campus
KK — 13–25 жастағы мектеп оқушылары мен студенттерге арналған тегін IT бағдарламасы. Қатысу үшін өтініш беріп, курс таңдап, тест тапсырып, топ таңдау керек. Офлайн сабақтар Алматыда, Астанада, Ақтөбеде және Талдықорғанда өтеді. Онлайн оқу да қарастырылған. Қолжетімді топтарды ұйымдастырушыдан нақтылаңыз.
RU — Бесплатная IT-программа для школьников и студентов 13–25 лет. Для участия нужно подать заявку, выбрать курс, пройти тест и выбрать группу. Очные занятия указаны для Алматы, Астаны, Актобе и Талдыкоргана. Предусмотрен онлайн-формат. Наличие групп уточняйте у организатора.
```

The regions are discovery buckets for the four cities named in the copy. Confirm the active track, cohort and online geographic reach before broadening coverage. [Provider rules and locations](https://samsung-campus.kz/ru)

### C1 · Астанадағы тегін үйірмелер мен секцияларға QOSYMSHA.KZ ваучері

```text
RU — Ваучер QOSYMSHA.KZ на бесплатные кружки и секции в Астане
KK — Астанада тұрақты немесе уақытша тіркелген отбасылар балаларына бір тегін үйірме не секцияға ваучер алу үшін кезекке тұра алады. Астана әкімдігі 4–18 жас аралығын көрсетеді. Ваучердің берілуі кезек тәртібі мен бөлінген қаржыға байланысты.
RU — Семьи с постоянной или временной регистрацией в Астане могут встать в очередь на ваучер на один бесплатный кружок или секцию. Акимат указывает возраст 4–18 лет. Выдача зависит от очереди и финансирования.
```

Confirm the applicable upper-age boundary, current intake and voucher type. Joining the queue does not reserve a place. [City guidance](https://www.gov.kz/org/astana/press/news/details/1037193?lang=ru) · [Queue application](https://qosymsha.kz/kz/statement/step-1)

### C2 · Зайсан ауданындағы шығармашылық үйірмеге ваучер

```text
RU — Ваучер на творческий кружок в Зайсанском районе
KK — Тек Зайсан ауданында тұратын 4–17 жастағы балаларға арналған шығармашылық үйірме ваучері. Заңды өкіл аудан операторына жүгінеді. Ваучер кезекке, бос орынға және қаржыландыруға байланысты беріледі.
RU — Ваучер на творческий кружок для детей 4–17 лет, проживающих в Зайсанском районе. Законный представитель обращается к районному оператору. Выдача зависит от очереди, наличия мест и финансирования.
```

East Kazakhstan is the available region picker value. Actual eligibility is Zaysan District only. Save privately and hold submission until the operator confirms the current intake and application channel. Leave the application URL blank while it is unconfirmed. [District operator and voucher rules](https://www.gov.kz/org/vko-zaysan/documents/details/1101737?lang=ru)

## Owner steps

1. Sign in with the existing authorized account. Open **Programs** and search all statuses for the slug and both titles before each save. Also check source and offer identity where an application service is shared. Preserve any existing match and investigate possible duplicates.
2. Choose **New program**. Enter the values above. Check the selected regions, confirm both checkboxes are clear and save. The form opens the record detail on success. Record the UUID, status **Draft**, and version. If the save outcome is unclear, search by slug before retrying.
3. Check each saved draft from a signed-out window. Search the public catalog and matcher for the title and confirm that the public detail URL `/program/<UUID>` does not expose the draft. Share the private admin detail URL with the authorized reviewer.
4. When the evidence is complete, the owning Editor or an Admin opens the latest draft and chooses **Submit for review**. Confirm status **Review**. Hold any record with unresolved source, eligibility, intake or scope evidence.
5. The second reviewer signs in with their own authorized Reviewer or Admin account. They reopen the official sources and check each record independently. On the current version they attest to **source**, **program information**, and **eligibility**. Approval changes the status to **Verified**. Use **Reject** with a reason if a check fails. The owning Editor or Admin can reopen the rejected item, revise it, and resubmit it.
6. For a separate publication decision, an Admin opens the latest verified revision, checks the recorded approval, source freshness, intake availability, expiry and recheck status, then explicitly confirms **Publish**. The record becomes **Published**. If the panel reports a stale revision, reload and inspect the current record before any action. If a published source later becomes questionable, an Admin can request a source recheck to hide it or unpublish it to draft.

## Independent verification checklist

- [ ] Reviewer is a different person and uses a separate account. An active account with the Reviewer role can review another author's submission and cannot publish. A separate Admin can review too. The application allows Admin self-approval, which does not provide independent review.
- [ ] Confirm official publisher, application destination, scope, cost, and current intake. Record the date and any applicable cohort or cutoff in verification notes.
- [ ] Compare the Kazakh and Russian descriptions against the source. Confirm that the discovery age and region filters are qualified in the copy wherever they are coarser than the official terms.
- [ ] Confirm each program-specific check above. Keep **Eligibility complete** clear while the matcher cannot represent the full conditions.
- [ ] Verify the approval in history and check that it applies to the latest version before the Admin makes a publication decision. Keep source notes free of applicant data.

The database currently has one enabled Admin and no active independent reviewer account. Arrange a second eligible account through the authorized staff provisioning procedure in the [backend runbook](../backend/README.md) before independent approval. The [verification contract](../backend/VERIFICATION.md) describes version and role rules in full.
