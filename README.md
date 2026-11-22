# BalaQoldau

[Catalog assistant](docs/AI_RECOMMENDATIONS.md) covers keyless search, the public contract, and Kazakh and Russian verification.

Stage 18: [private enhanced child profiles, optional fields and recommendation ranking](backend/CHILD_PROFILES.md#stage-18--optional-enhanced-details).

Stage 16: [admin verification, expiry, reporting, migration 011 and launch requirements](backend/VERIFICATION.md). Existing sessions, RBAC and matching are reused; no real catalog is populated.

Қазақ тіліндегі әлеуметтік қолдауды іздеу платформасы: React/TypeScript/Vite frontend,
Express/TypeScript API, PostgreSQL. Public API тек `published AND NOT is_demo` деректерін
береді. Жергілікті DEMO draft-тар нақты мүмкіндік ретінде көрсетілмейді.

- [Frontend іске қосу және browser QA](balaqoldau/README.md)
- [KZ/RU локализациясы және тексерілген маршруттар — Stage 13](docs/LOCALIZATION.md)
- [Түсіндірілетін іздеу және сәйкестік ережелері — Stage 14](docs/MATCHING.md)
- [Бала профильдері және жеке ұсыныстар — Stage 15](backend/CHILD_PROFILES.md)
- [Backend, PostgreSQL және API келісімшарты](backend/README.md)
- [Deployment, rollback және least-privilege құқықтар](docs/DEPLOYMENT.md)
- [Қауіпсіздік шолуы және contact retention](docs/SECURITY.md)
- [Нақты тексеру нәтижелері](PROGRESS.md)
- [Пайдаланушы аккаунттары — Stage 11](backend/USER_AUTH.md)
- [Жеке профиль және сақталған бағдарламалар — Stage 12](backend/USER_PROFILE.md)
- [CI және release қауіпсіздігі](docs/RELEASE_CHECKLIST.md)

Node.js 24.7+ қажет (Stage 9.1 native Argon2id). Екі бөлек npm lockfile бар; әр жобада `npm ci --ignore-scripts`
қолданылады. `.env` бар болса қайта жазбаңыз. Құпияларды frontend `VITE_*` мәндеріне
бермеңіз. Development: backend `npm run dev`, frontend `npm run dev` (бөлек терминалдар).
Production frontend — `balaqoldau/dist`, backend — `backend/dist/server.js`.
Vite dev/preview сервері production сервері ретінде қолданылмайды.

Stage 8.1: `/api/health` — lightweight liveness, `/api/ready` — bounded DB readiness.
Production міндетті DB/config тексеруінен өтпей HTTP порт ашпайды. Нақты startup/shutdown
келісімшарты backend README ішінде. Production іске қосылған жоқ;
жария іске қосу алдындағы қолмен орындалатын міндеттер deployment нұсқаулығында.

Public catalog UX fixes: apply additive migration 012_catalog_categories.sql before rollout. The stable category slugs are benefits, free-courses, grants and clubs; these navigation labels exist without published programs. No program data is seeded. Public GET /api/categories additionally includes these four taxonomy entries while preserving published-only visibility for other taxonomy. Existing names are never overwritten.

Admin reference data update: [20 Kazakhstan regions, nationwide selection, localized support-needs taxonomy and migration safety](backend/REFERENCE_DATA.md). Apply additive migration 013 before rollout; it creates reference rows only, never programs or eligibility rules.

Stage 16.1: [public contact persistence/idempotency and private Admin inbox](backend/CONTACT_API.md). Existing migration 014 is preserved; additive 015 introduces message statuses and auditing.
