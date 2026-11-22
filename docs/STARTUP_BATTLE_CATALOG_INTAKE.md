# StartUp Battle 2026 catalog intake

Official sources checked on **2026-11-22** (Asia/Qyzylorda). This is an intake record. PostgreSQL assigns its own verification timestamp when an authorized reviewer records an approval. The program schema stores one title and one description. For draft entry, use the Kazakh title and preserve both titles and descriptions as clearly labeled paragraphs in the description. Keep `isDemo=false` and `eligibilityComplete=false` for the proposed drafts. The separate descriptions below are editorial translations where a source only publishes one language.

## Benefits

### B1 · Бала тууына байланысты біржолғы мемлекеттік жәрдемақы / Единовременное государственное пособие в связи с рождением ребёнка
**Issuer and coverage:** Ministry of Labour and Social Protection of Population, Kazakhstan nationwide. **Eligibility:** Birth of a child, with an application window of 18 months from birth. The whole-year child filter is only a discovery approximation. **Disposition:** Duplicate. A published record and a separate record in review already cover this benefit. Preserve both existing records and flag the duplication for the reviewer.

- **KK:** Бала тууына байланысты біржолғы жәрдемақы. Өтінішті бала туған күннен бастап 18 ай ішінде беруге болады.
- **RU:** Единовременное пособие в связи с рождением ребёнка. Подать заявление можно в течение 18 месяцев со дня рождения.
- [Ministry rules on Әділет](https://old.adilet.zan.kz/rus/docs/V2300032571) · [eGov composite birth service](https://beta.egov.kz/services/3801?lang=en)

### B2 · Бала бір жарым жасқа толғанға дейінгі күтіміне байланысты мемлекеттік жәрдемақы / Государственное пособие по уходу за ребёнком до достижения им полутора лет
**Issuer and coverage:** Ministry of Labour and Social Protection of Population, nationwide. **Eligibility:** For a caregiver outside mandatory social insurance. The child must be under 18 months for the benefit period. Apply within 18 months from birth. **Disposition:** Draft candidate `childcare-state-allowance-under-18-months`, discovery ages 0–1, no calendar deadline.

- **KK:** Міндетті әлеуметтік сақтандыру жүйесіне қатыспайтын, балаға күтім жасайтын тұлғаға арналған ай сайынғы жәрдемақы. Өтініш мерзімі баланың туған күнінен есептеледі.
- **RU:** Ежемесячное пособие для лица, которое ухаживает за ребёнком и не участвует в системе обязательного социального страхования. Срок обращения отсчитывается от даты рождения.
- [Ministry rules on Әділет](https://old.adilet.zan.kz/rus/docs/V2300032571) · [eGov eligibility guide](https://beta.egov.kz/situations/315/809?lang=ru) · [eGov service entry with online childcare allowance instructions](https://beta.egov.kz/services/3450?lang=ru)

### B3 · Мүгедектігі бар баланы тәрбиелеушіге жәрдемақы / Пособие воспитывающему ребёнка с инвалидностью
**Issuer and coverage:** Ministry of Labour and Social Protection of Population, nationwide. **Eligibility:** Parent, adoptive parent, guardian or trustee raising a child with officially established disability. Apply the Social Code's residence and legal-status conditions. **Deadline:** No fixed calendar cutoff verified. **Disposition:** Draft candidate `allowance-raising-child-with-disability`, minor discovery ages 0–17.

- **KK:** Мүгедектігі ресми белгіленген баланы тәрбиелейтін ата-анаға, асырап алушыға, қорғаншыға немесе қамқоршыға арналған жәрдемақы. Тұрақты тұру және құқықтық мәртебе талаптарын ресми дереккөзден қараңыз.
- **RU:** Пособие родителю, усыновителю, опекуну или попечителю, воспитывающему ребёнка с установленной инвалидностью. Условия постоянного проживания и правового статуса приведены в официальном источнике.
- [Social Code, article 183](https://old.adilet.zan.kz/rus/docs/K2300000224) · [eGov application](https://beta.egov.kz/services/3030?lang=ru)

### B4 · Көпбалалы отбасына жәрдемақы / Пособие многодетной семье
**Issuer and coverage:** Ministry of Labour and Social Protection of Population, nationwide. **Eligibility:** Four or more qualifying children living together. Full-time students may continue to count after age 18 until studies end and before age 23. Income does not determine eligibility. **Deadline:** No fixed calendar cutoff verified. **Disposition:** Draft candidate `large-family-state-allowance`, minor discovery ages 0–17. Describe adult student counting separately.

- **KK:** Төрт және одан көп есепке алынатын баласы бар, бірге тұратын отбасыларға арналған жәрдемақы. Күндізгі бөлімде оқитын балалар оқуын аяқтағанға дейін, бірақ 23 жасқа толғанға дейін есепке алынуы мүмкін.
- **RU:** Пособие семьям с четырьмя или более совместно проживающими детьми, учитываемыми по правилам программы. Очное обучение может продлить учёт ребёнка после 18 лет до окончания обучения, но до достижения 23 лет.
- [eGov eligibility](https://beta.egov.kz/situations/419/1019?lang=ru) · [eGov application](https://beta.egov.kz/services/4587?lang=ru)

## Free educational courses

### F1 · Samsung Innovation Campus / Samsung Innovation Campus
**Issuer and coverage:** Samsung Kazakhstan. The provider lists online instruction and offline locations in Almaty, Astana, Aktobe and Taldykorgan. **Eligibility:** Free program for school and university students ages 13–25, with application, course choice, test and group selection. The provider lists enrollment for some tracks. **Deadline:** No fixed deadline verified. **Disposition:** Draft candidate `samsung-innovation-campus-kz`, ages 13–17 for discovery. Use only the four documented offline region filters until the operator confirms online reach and cohort availability. Describe the wider official age band and online format.

- **KK:** 13–25 жастағы мектеп оқушылары мен студенттерге арналған тегін IT бағдарламасы. Курс пен топты таңдау және тест тапсыру қажет. Офлайн сабақтар Алматыда, Астанада, Ақтөбеде және Талдықорғанда өтеді. Онлайн оқу да қарастырылған.
- **RU:** Бесплатная IT-программа для школьников и студентов 13–25 лет. Для участия нужно выбрать курс и группу и пройти тест. Офлайн-занятия проходят в Алматы, Астане, Актобе и Талдыкоргане. Предусмотрен и онлайн-формат.
- [Provider in Kazakh](https://samsung-campus.kz/kz) · [Provider in Russian](https://samsung-campus.kz/ru) · [Application](https://samsung-campus.kz/ru/registration)

### F2 · NIS Виртуалды мектебі / Виртуальная школа NIS
**Issuer and coverage:** Nazarbayev Intellectual Schools, online for schoolchildren in Kazakhstan. **Eligibility:** Free preparation for 5th- and 6th-grade students. Provider describes grades, not a numerical age range. **Deadline:** Current schedule unconfirmed. **Disposition:** Hold. The linked application returned HTTP 502 during verification. Confirm the current cycle and how to represent grade-only eligibility before creating a draft.

- **KK:** 5–6-сынып оқушыларын «Өркен» гранты бойынша НЗМ-нің 7-сыныбына түсу конкурсына тегін дайындайтын онлайн мектеп.
- **RU:** Бесплатная онлайн-подготовка учеников 5–6-х классов к конкурсному отбору в 7-е классы НИШ по гранту «Өркен».
- [Official NIS program page](https://www.nis.edu.kz/ru/list/261) · [Provider-listed registration](https://vs.nis.edu.kz)

## Grants

### G1 · «Тәуелсіздік ұрпақтары» гранты, Тараздағы конкурс / Грант «Тәуелсіздік ұрпақтары», конкурс в Таразе
**Issuer and coverage:** Taraz akimat notice. The notice confirms the Taraz intake office, with exact residency scope still to confirm. **Eligibility:** Notice states ages 14–35, one application in one of six tracks, project duration up to one year. **Deadline:** November 23–December 7, 2026. **Application:** In person at the address on the notice. **Disposition:** Hold until the issuer confirms who may apply to this round, the upper-age convention, and intake end time.

- **KK:** Жастар жобаларына арналған конкурс. Бір қатысушы бір бағыт бойынша бір өтінім береді. Құжаттар Тараздағы хабарландыруда көрсетілген мекенжайда қабылданады.
- **RU:** Конкурс молодёжных проектов. Один участник подаёт одну заявку по одному направлению. Документы принимают по адресу в официальном объявлении в Таразе.
- [Taraz akimat announcement and submission address](https://www.gov.kz/org/zhambyl-taraz/press/news/details/1320046?lang=kk)

### G2 · Қазақстан Республикасы Президентінің «Өркен» білім беру гранты / Образовательный грант Президента Республики Казахстан «Өркен»
**Issuer and coverage:** Nazarbayev Intellectual Schools administers the national competition. **Eligibility:** Kazakhstan citizens currently in 6th grade apply for competitive admission to grade 7. No numerical age threshold appears in the reviewed notice. **Deadline:** November 23–December 28, 2026 for the 2027–2028 school year. NIS specifies 18:00 for the final online intake time. **Disposition:** Hold until a reviewer approves a grade-based representation. The whole-day deadline field cannot express the published cutoff time.

- **KK:** Қазақстан азаматтығы бар 6-сынып оқушылары Назарбаев Зияткерлік мектептерінің 7-сыныбына қабылдау конкурсына қатыса алады. Құжат қабылдау 2026 жылғы 23 қарашадан 28 желтоқсанға дейін жүреді.
- **RU:** Граждане Казахстана, обучающиеся в 6-м классе, могут участвовать в конкурсном отборе в 7-й класс НИШ. Приём документов с 23 ноября по 28 декабря 2026 года.
- [Government eligibility](https://www.gov.kz/situations/855/intro?lang=ru) · [NIS Kazakh notice and cutoff time](https://www.akb.nis.edu.kz/kk/school/nzm-qostanai/page?menu=17&parent_menu=15) · [Application service](https://www.gov.kz/services/4370?lang=ru)

## Free children's clubs

### C1 · Астанадағы тегін үйірмелер мен секцияларға QOSYMSHA.KZ ваучері / Ваучер QOSYMSHA.KZ на бесплатные кружки и секции в Астане
**Issuer and coverage:** Astana akimat and education administration, Astana city only. **Eligibility:** The city describes ages 4–18 and permanent or temporary Astana registration. A parent applies, allocation depends on queue priority and available funding, and attendance must be confirmed. **Deadline:** No specific upcoming allocation date verified. **Disposition:** Draft candidate `astana-qosymsha-voucher`, minor discovery ages 4–17. Verify the current queue opening before approval.

- **KK:** Астанада тұрақты немесе уақытша тіркелген отбасылар балаларына бір тегін үйірме не секцияға ваучер сұрай алады. Ваучер кезек тәртібі мен бөлінген қаржыға байланысты беріледі.
- **RU:** Семьи с постоянной или временной регистрацией в Астане могут подать заявку на ваучер на один бесплатный кружок или секцию. Выдача зависит от очереди и финансирования.
- [Astana eligibility](https://www.gov.kz/org/astana/press/news/details/1037193?lang=ru) · [2026 program update](https://www.gov.kz/org/astana/press/news/details/1232094?lang=ru) · [City-designated queue application](https://qosymsha.kz/kz/statement/step-1)

### C2 · Зайсан ауданындағы шығармашылық үйірмеге ваучер / Ваучер на творческий кружок в Зайсанском районе
**Issuer and coverage:** Zaysan District akimat and designated local operator, Zaysan District, East Kazakhstan Region. **Eligibility:** Ages 4–17 inclusive, application by legal representative to the operator for the child's residence, assignment by queue and available funds. **Deadline and application:** Confirm the active local platform and intake calendar with the named operator. **Disposition:** Draft candidate `zaysan-creative-club-voucher`, ages 4–17. East Kazakhstan is the nearest taxonomy value. Put Zaysan District in the title and keep eligibility incomplete to avoid implying region-wide entitlement.

- **KK:** Зайсан ауданында тұратын 4–17 жастағы балаларға арналған шығармашылық үйірме ваучері. Заңды өкіл аудан операторына өтініш береді. Ваучер кезек пен бюджетке байланысты.
- **RU:** Ваучер на творческий кружок для детей 4–17 лет, проживающих в Зайсанском районе. Заявку подаёт законный представитель через районного оператора. Выдача зависит от очереди и бюджета.
- [Zaysan District operator and eligibility FAQ](https://www.gov.kz/org/vko-zaysan/documents/details/1101737?lang=ru) · [Regional Kazakh FAQ](https://www.gov.kz/org/akimvko/faq/1?directions=_181)

## Second-reviewer checklist

- [ ] Compare program identity against all published, review and draft entries, including spelling variants and shared application URLs. Leave the two existing birth-benefit records untouched.
- [ ] Open each primary source and official application destination. Confirm issuer, geographic scope, current intake, cost, and whether the link accepts applications for the cited round.
- [ ] Compare the Kazakh and Russian text for the same offer, age or grade boundaries, regional restrictions, eligibility and deadline. Preserve official names and label editorial translations.
- [ ] Verify the 18-month cutoff, family-size rules, district restrictions and cohort conditions from the source. Leave eligibility incomplete for rules that the catalog cannot fully represent.
- [ ] For draft candidates, confirm taxonomies and required fields, save as non-demo drafts and verify public list, matcher and detail visibility. Keep holds out of the catalog until gaps are resolved.
- [ ] When the author submits a draft, have a separate eligible reviewer make the three attestations in the admin panel. Approval is version-bound. Publication is a separate Admin decision.
