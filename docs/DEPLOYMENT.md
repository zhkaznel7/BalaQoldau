# Deployment runbook — Stage 7

Бұл дайындық нұсқаулығы; deploy/role creation орындалған жоқ. `example.com` домендері
нақты hosting/бағдарлама деректері емес. Topology: **бір host-та Nginx TLS → loopback
Express бір процесі → жеке PostgreSQL TLS**; frontend статикалық `dist` сол origin-де.
CDN/multiple proxies/containers үшін бұл proxy trust баптауын сол күйі қолданбаңыз.

## 1. Release және environment

1. Review-дан өткен revision және екі lockfile-ды бекітіңіз. Қазіргі өзгерістер әлі
   commit етілмеген; бұл runbook push/commit/deploy рұқсатын бермейді.
2. Build host-та екі жобада `npm ci --ignore-scripts`, `npm run build`. Frontend
   build environment: `VITE_API_BASE_URL=/api`; VITE_* ішінде құпия жоқ. Backend
   package.json/lock, dist және **migrations/** каталогын бірге сақтаңыз; migration
   runner dist-ке қатысты `../migrations` емес, `../../migrations` жолын қолданады.
3. Backend runtime release ішінде `npm ci --omit=dev --ignore-scripts`; build бөлек
   ортада аяқталған болуы керек. Frontend node_modules production-ға шығарылмайды.
   Пакеттердің install script-терін түгел қоспаңыз; native build қажет болса нақты
   пакет script-ін алдымен тексеріңіз. Backend-ті бөлек OS service user-мен іске қосыңыз.
4. [Production env мысалы](../backend/.env.production.example) бойынша hosting secrets
   баптаңыз. NODE_ENV=production, DB_SSL_MODE=verify-full; DB hostname сертификатқа
   сәйкес келуі керек. Private CA үшін NODE_EXTRA_CA_CERTS, TLS verification өшірілмейді.
   `.env`/pgpass болса тек service owner оқи алсын (Unix 0600/Windows ACL). Парольді
   command line, terminal, log, screenshot, Git немесе frontend-ке шығармаңыз.
5. Node-тың қолдау көрсетілетін, security updates орнатылған нұсқасын бекітіңіз.
   `node dist/server.js` backend working directory-ден басталады. Production-да
   secret manager env басым; жергілікті `.env` файлын көшірмеңіз. HOST=127.0.0.1,
   TRUST_PROXY_LOOPBACK=true тек төмендегі ingress үшін. Node порты сырттан жабық.
6. Service manager restart-on-failure және SIGTERM graceful stop қолдасын; stop timeout
   кемінде 30s. HTTP drain deadline 10s, DB query timeout 12s; DB drain қосымша уақыт
   алуы мүмкін. Бір процестік limiter restart-та тазарады; бірнеше backend instance
   үшін shared limiter/орталық ingress қажет, бұл репода енгізілмеген.

## 2. PostgreSQL: бөлек migration және runtime login

**Тек оператор тексерген жаңа production нысанында, DBA review/approval кейін. Жергілікті
рөлдерді өзгертпеңіз. `balaqoldau_db` бұл нұсқаулықтың нысаны емес.** Алдымен password
file/secret manager арқылы TLS қосылымында мынаны тексеріңіз:

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();
```

Идентификация күмәнді болса тоқтаңыз. Мысал рөлдер жаңа және басқа рөлге member емес
болуы тиіс; бар рөлді overwrite етпеңіз. Пароль төмендегі SQL-ге кірмейді; DBA оны
secret manager немесе psql `\password` жасырын prompt арқылы бөлек тағайындайды.

```sql
-- DBA: provision only in the approved production cluster, not locally.
CREATE ROLE balaqoldau_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE balaqoldau_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- Connected to the verified dedicated production database, never a local/shared DB:
REVOKE CREATE, TEMPORARY ON DATABASE balaqoldau_production FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT, CREATE ON DATABASE balaqoldau_production TO balaqoldau_migrator;
GRANT CONNECT ON DATABASE balaqoldau_production TO balaqoldau_runtime;
ALTER ROLE balaqoldau_runtime SET search_path = pg_catalog;
ALTER ROLE balaqoldau_runtime SET statement_timeout = '10s';
ALTER ROLE balaqoldau_runtime SET lock_timeout = '5s';
```

Provisioning кезінде DBA dedicated database-те PUBLIC-тан CREATE/TEMP және public
schema CREATE құқықтарының мұраланбауын тексерсін. Runtime database/schema/table owner
емес, migrator-ға member емес. Migration login тек release кезінде қолжетімді болсын.
Migration-ды сол login-мен жүргізгенде schema/view/table owner сол migrator болады.

Migration аяқталғаннан кейін сол owner/DBA тек мына құқықтарды береді:

```sql
GRANT USAGE ON SCHEMA balaqoldau TO balaqoldau_runtime;
GRANT SELECT ON balaqoldau.published_programs,
  balaqoldau.categories, balaqoldau.regions, balaqoldau.family_categories,
  balaqoldau.program_regions, balaqoldau.program_family_categories TO balaqoldau_runtime;
GRANT INSERT (sender_name, email, message) ON balaqoldau.contact_messages TO balaqoldau_runtime;
GRANT SELECT (id) ON balaqoldau.contact_messages TO balaqoldau_runtime;
```

Contact UUID default үшін sequence grant қажет емес. `programs`, `schema_migrations`,
contact name/email/message SELECT, UPDATE/DELETE/TRUNCATE/DDL берілмейді. View default
owner permissions қолданады: security_invoker қоспаңыз; runtime-ға base programs SELECT
беру қажеттілігі тумауы керек. Жаңа migrations-дан кейін grants-ты қайта review жасаңыз,
ALL TABLES/default blanket grants қолданбаңыз. Runtime taxonomy/link metadata оқи алады;
бағдарламаның private мәтіндері view арқылы жасырылған.

Runtime login арқылы staging-де SELECT view/taxonomy, API read және синтетикалық contact
INSERT/RETURNING тексеріңіз; contact сынағын **BEGIN → INSERT → ROLLBACK** ішінде ғана
орындаңыз. Base programs және contact email SELECT, schema CREATE рұқсатсыз болуы тиіс.
Бұл құқықтар жергілікті рөлдер өзгертілмегендіктен осы QA-да runtime login-мен сыналмады.

Негіз: [PostgreSQL GRANT](https://www.postgresql.org/docs/18/sql-grant.html),
[view privileges](https://www.postgresql.org/docs/18/sql-createview.html).

## 3. Migration және rollback

1. DB identity және backup/restore drill-ды тексеріңіз. Backup шифрланған, access шектеулі;
   backup connection password-ты CLI аргументке салмаңыз. Backup production static root-қа түспесін.
2. Migration job environment-іне **migrator** DATABASE_URL беріңіз (runtime secret-ін
   ауыстырмаңыз); NODE_ENV=production, DB_SSL_MODE=verify-full. Backend release cwd:

   ```sh
   node dist/db/cli.js migrate
   node dist/db/cli.js migrate
   ```

   Екінші іске қосу `Migrations applied: 0` болуы тиіс. Runner advisory lock, checksum
   және transaction қолданады; қате болса rollback/exit 1, traffic ашылмайды. Қолданылған
   SQL файлын өзгертпеңіз. **Production-да seed жүргізбеңіз.** Seed CLI бұл шектеуді
   автоматты enforce етпейді; production runtime grants seed INSERT-іне рұқсат бермейді.
3. Жаңа release-ті staging-де толық suite және ingress smoke арқылы тексеріп, содан
   кейін оператор approval арқылы traffic ауыстырсын. Бұл репода автоматты deploy жоқ.
4. Application rollback: алдыңғы тексерілген frontend/backend artifact пен сәйкес
   public config-ке traffic қайтару. Бұрынғы hashed assets cached HTML үшін сақталсын.
   Stage 7 схема өзгертпейді, кері migration қажет емес. Down migration/reset/drop
   орындамаңыз. Болашақ incompatible schema болса traffic тоқтату/forward fix немесе
   approved restore жоспары қажет; backup restore қолданыстағы базаға overwrite жасамайды.
5. Health 200 тек liveness. Readiness үшін runtime connection-мен view SELECT және
   `/api/programs`, `/api/categories`, `/api/regions` сұрауларын тексеріңіз; қате болса
   трафикті жібермеңіз. Жария non-DEMO дерек жоқ болса бос нәтиже — дұрыс жауап.

## 4. TLS ingress

[Nginx template](../deploy/nginx.conf.example) — **орнатылмаған/NGINX-те орындалмаған**
бір-host мысалы. TLS cert paths, domain және static release root оператор мәндерімен
ауыстырылады; `nginx -t` staging-де міндетті. Тек `balaqoldau/dist` public root болсын;
backend/source/Git/env/backup файлдарын serve етпеңіз. Frontend `/api` сұрауы осы ingress
арқылы өтеді; Vite proxy қажет емес. HTML no-cache, hashed assets cache, SPA fallback бар.

Proxy X-Forwarded-For/Host/Proto мәндерін **қайта жазады**, клиент берген тізімді append
етпейді. Loopback trust жергілікті процестерге де сенеді: host-та бөгде service user
болмасын. Бірнеше proxy/CDN болса нақты trusted IP топологиясын бөлек жобалаңыз;
`trust proxy=true` немесе hop count-пен алмастырмаңыз. [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/).

Edge rate limit CORS reject қоса барлық `/api` трафигіне қолданылады. App CORS reject
өз limiter-іне жетпейтіндіктен edge қабаты қажет. JSON/timeout/error headers app-та;
ingress-generated 413/429/502 native response болуы мүмкін, frontend оларды қауіпсіз
жалпы қате ретінде көрсетеді. Edge body limit 16 KiB-мен сәйкестендірілген.
Request logs өшірілген: IP/query/contact body сақталмайды. Launch алдында PII-сыз
aggregate uptime/5xx/429/latency бақылауын және жауапты кезекшіні бөлек орнатыңыз.

## 5. Public launch gates (әлі орындалмаған)

- Оператор production нысанын/TLS/DNS/firewall/Node patches/DB restricted login-ді тексеруі.
- Template-ті нақты Nginx-те тексеру; HTTPS redirects, HSTS/CSP, SPA deep links, нақты
  екі клиент IP-імен limiter және жалған forwarding headers сынағы. Multi-instance жоқ.
- Staging-де шынайы runtime credentials және end-to-end contact POST/retention drill;
  public endpoint-терде draft/verified/DEMO жоқтығын қайта тексеру.
- [Retention](SECURITY.md) owner-ы, public privacy notice және deletion request арнасы;
  job әлі жазылмағандықтан күнделікті manual purge міндетін бекіту, backup restore drill.
- Фотоның пайдалану/адамдардың бейнесіне құқықтарын растау:
  [CREDITS](../balaqoldau/public/images/CREDITS.md) лицензияны әлі көрсетпейді.
- NVDA/VoiceOver қолмен тексеру; production mobile performance/slow network сынағы.
  Custom automated contrast/keyboard тексеруі толық WCAG сәйкестігін білдірмейді.
- Dev-only minimatch тәуекелін қабылдау немесе upstream safe fix шыққанда жаңарту;
  тәуелсіз code/security review. Осы gates өтпей public production-ready деп саналмайды.
