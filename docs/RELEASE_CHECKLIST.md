# Stage 8.3 — CI және release қауіпсіздігі

## CI

`.github/workflows/ci.yml`: pull request және development/main push; GitHub-hosted Ubuntu,
Node 24, read-only token, толық SHA-мен бекітілген Actions, сақталмайтын checkout credentials.
Production secrets, deploy job және `pull_request_target` жоқ.

- Git inventory: `.env`, private keys, credential URLs/token patterns.
- Public asset license/hash және base commit-пен append-only SQL migration policy.
- Екі lockfile бойынша `npm ci --ignore-scripts`; frontend/backend lint, TypeScript,
  unit tests және build. Backend lint бұрыннан орнатылған frontend ESLint toolchain-ын қолданады.
- Әр job үшін жаңа PostgreSQL 18.6 service, loopback порты, `balaqoldau_test`.
  `trust` тек secrets/data жоқ уақытша CI контейнерінде; staging/production-да тыйым салынады.
  DATABASE_URL тек migration step-те, TEST_DATABASE_URL integration step-те қолданылады.
  Migration екі рет орындалады, integration suite idempotency/checksum тексереді.
  DEMO seed және contact cleanup CLI execution жоқ. Retention DELETE tests тек synthetic
  fixtures transaction ішінде ROLLBACK жасайды.
- Екі жобаның full/production audits. Production high/critical немесе registry/JSON error
  болса CI FAIL. Dev findings есепте көрсетіледі.
  Cold-cache advisory/metadata lookup үшін әр npm audit process шегі 90s, fetch timeout
  30s, npm network retry 1 (1–2s backoff). Process timeout/transient registry error болса
  толық command тек бір рет қайталанады. Толық жарамды report алынбаса FAIL; malformed
  report/auth/lockfile errors немесе vulnerabilities retry арқылы айналып өтілмейді.
  Diagnostics project/scope және safe reason code көрсетеді; raw registry output,
  stderr/config/credentials логқа шықпайды. Ең ұзақ төрт audit scope жалпы ~12 минут.
- Нақты dist: env/keys/token/credential және private build canary scan. Frontend тек
  JS/CSS/HTML және `release-assets.json` бекіткен SVG файлдарын қабылдайды.

Workflow GitHub-та әлі орындалмады. Бірінші Actions run және branch protection-ды оператор
тексеруі керек. Қолданыстағы browser harness Windows Chrome/local dev DB-ге арналған;
ол CI-ға кірмейді, release алдында бөлек орындалады.

## Жергілікті командалар (root)

Dependencies алдын ала екі жобада орнатылған болуы керек. Windows-та `npm.cmd` қолданыңыз.

```sh
node --test scripts/*.test.mjs
node scripts/check-release.mjs --source
npm run lint --prefix balaqoldau
npm run typecheck --prefix balaqoldau
npm test --prefix balaqoldau
npm run build --prefix balaqoldau
npm run lint --prefix backend
npm run typecheck --prefix backend
npm test --prefix backend
npm run test:db --prefix backend
node scripts/audit-dependencies.mjs
node scripts/check-release.mjs --artifacts
```

Integration үшін backend/.env TEST_DATABASE_URL тек `balaqoldau_test` болуы тиіс.
Source guard `MIGRATION_BASE` trusted full commit SHA берілсе migration checksum/deletion/order
тексереді; онсыз тек current inventory. CI baseline-ды GitHub event-тен алады, initial
zero-SHA push бос baseline. Missing Git object/policy/build output тексеруді тоқтатады.

Approved text assets `.gitattributes` арқылы LF checkout қолданады. Manifest SHA-256
нақты LF bytes бойынша есептеледі; hash кезінде line endings үнсіз нормаланбайды.
Windows-та asset жаңартқанда line ending пен manifest hash-ын бірге тексеріңіз.
Policy error `[phase]: reason` береді; JSON contents, Git stderr және stack traces
шығарылмайды. Missing baseline болса required history-ді fetch етіңіз, check-ті айналып өтпеңіз.

## Міндетті release checklist

- [ ] GitHub-та `CI / quality` required check, branch protection, maintainer approval және
  force-push/deletion шектеулері орнатылсын. Workflow/scripts/asset policy/lockfiles reviewer-ы
  бекітілсін; нақты аккаунттар белгілі болған соң CODEOWNERS орнатылсын.
- [ ] Exact release commit fresh checkout-та CI өтсін. Lockfile/action SHA/container updates
  review өтсін; audit bypass/lifecycle scripts қосылмасын. Public launch бөлек approval күтеді.
- [ ] GitHub secret scanning/push protection қолжетімді болса оператор қоссын. Pattern scan
  барлық secrets/obfuscation түрлерін табуға кепілдік бермейді; manual diff review міндетті.
- [ ] Asset лицензия/hash/attribution review өтсін. Stage 8.4-те `family.jpg`, hero.png және
  starter assets source-тен жойылды. Public және src ішіндегі жаңа image/font/media файлдары
  manifest review-сыз source guard/build-тен өтпейді. Lucide ISC/MIT notices production-да
  `THIRD_PARTY_NOTICES.txt` ретінде сақталсын. [Asset inventory](../balaqoldau/public/images/CREDITS.md).
  Remote/inline artwork және dependency licenses manual review өтсін: hash/license declaration
  өздігінен заңды құқықты дәлелдемейді. Жаңа dependency/icon license өзгерсе notices/hash жаңартылсын.
- [ ] Production high/critical = 0. Қазіргі frontend dev-tool 10 moderate findings
  (minimatch dependency chain) үшін upstream safe fix бақылансын; force/major upgrade жасалмасын.
- [ ] [Deployment](DEPLOYMENT.md): HTTPS ingress, exact CORS, trusted proxy, HSTS/CSP,
  private backend/DB ports және `/api` reverse proxy staging-де тексерілсін. Production Vite
  proxy-ге тәуелді емес; VITE_* тек public config. Тек бекітілген dist serve етілсін.
- [ ] PostgreSQL `DB_SSL_MODE=verify-full`, дұрыс CA/hostname, restricted runtime role және
  бөлек migrator/retention roles оператор арқылы бекітілсін. Runtime superuser/owner/BYPASSRLS
  болмауы тиіс; public view SELECT/contact INSERT ғана қажетті grants-пен тексерілсін.
  Бұл кезеңде рөлдер/credentials өзгертілмейді.
- [ ] Шифрланған, restricted/off-host backups; backup expiry, RPO/RTO және жауапты оператор
  бекітілсін. Launch және әр migration release алдында restore drill жаңа оқшауланған DB-де
  орындалсын; live DB overwrite жасалмасын.
- [ ] Migration manual SQL review, immutable checksum және clean-DB tests өтсін. Regex policy
  dynamic SQL/барлық қауіпті DDL-ды анықтамайды. Destructive SQL осы CI жолында қабылданбайды.
  Бар runner transaction/checksum/advisory lock қолданады. Production migration тек
  backup/restore дәлелі және operator approval-дан кейін орындалсын.
- [ ] Rollback үшін алдыңғы tested application artifacts және compatible schema сақталсын.
  Down/reset автоматты емес; incompatible өзгеріске forward-fix/approved restore plan қажет.
- [ ] `/api/health`, `/api/ready`, aggregate 5xx/429/latency/DB pool, failed migration/backup
  және retention backlog alerts кезекшіге бағытталсын. Contact PII/token/query логқа түспесін.
- [ ] [Retention](CONTACT_RETENTION.md): restricted login, күнделікті dry-run және approved
  bounded execution schedule, overlap/failure/backlog monitoring, privacy owner, manual
  deletion арнасы және backup restore erasure рәсімі орнатылсын. Scheduling әлі қосылмаған;
  CI real data cleanup жасамайды.
- [ ] Staging browser desktop/mobile, keyboard, slow-network/error/retry және published/non-DEMO
  visibility тексерілсін. NVDA/VoiceOver manual review қажет; automated tests толық WCAG
  compliance немесе public production readiness дәлелі емес.

Gate нәтижесі, reviewer, release commit және rollback artifact ID release жазбасына тіркелсін.
Қате болса release тоқтатылады; автоматты deploy/bypass жоқ.
