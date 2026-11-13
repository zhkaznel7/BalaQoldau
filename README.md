# BalaQoldau

Қазақ тіліндегі әлеуметтік қолдауды іздеу платформасы: React/TypeScript/Vite frontend,
Express/TypeScript API, PostgreSQL. Public API тек `published AND NOT is_demo` деректерін
береді. Жергілікті DEMO draft-тар нақты мүмкіндік ретінде көрсетілмейді.

- [Frontend іске қосу және browser QA](balaqoldau/README.md)
- [KZ/RU локализациясы және тексерілген маршруттар — Stage 13](docs/LOCALIZATION.md)
- [Түсіндірілетін іздеу және сәйкестік ережелері — Stage 14](docs/MATCHING.md)
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
