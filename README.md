# BalaQoldau

Қазақ тіліндегі әлеуметтік қолдауды іздеу платформасы: React/TypeScript/Vite frontend,
Express/TypeScript API, PostgreSQL. Public API тек `published AND NOT is_demo` деректерін
береді. Жергілікті DEMO draft-тар нақты мүмкіндік ретінде көрсетілмейді.

- [Frontend іске қосу және browser QA](balaqoldau/README.md)
- [Backend, PostgreSQL және API келісімшарты](backend/README.md)
- [Deployment, rollback және least-privilege құқықтар](docs/DEPLOYMENT.md)
- [Қауіпсіздік шолуы және contact retention](docs/SECURITY.md)
- [Нақты тексеру нәтижелері](PROGRESS.md)

Node.js 24+ қажет. Екі бөлек npm lockfile бар; әр жобада `npm ci --ignore-scripts`
қолданылады. `.env` бар болса қайта жазбаңыз. Құпияларды frontend `VITE_*` мәндеріне
бермеңіз. Development: backend `npm run dev`, frontend `npm run dev` (бөлек терминалдар).
Production frontend — `balaqoldau/dist`, backend — `backend/dist/server.js`.
Vite dev/preview сервері production сервері ретінде қолданылмайды.

Stage 7 жергілікті QA мен deployment дайындауын қамтиды. Production іске қосылған жоқ;
жария іске қосу алдындағы қолмен орындалатын міндеттер deployment нұсқаулығында.
