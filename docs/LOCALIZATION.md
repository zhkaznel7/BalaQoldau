# Stage 13 — Kazakh / Russian frontend localization

The existing URL locale (`?lang=kk` / `?lang=ru`) is the only language source.
Missing or unsupported language defaults to Kazakh. The shared header dropdown
updates the current route without reloading; navigation carries the current locale,
and browser refresh preserves it in the URL. Public/account pages use the public
header; admin pages use their own main header with the same dropdown component.
No page-specific language controls or second locale store were added.

## Coverage and content boundary

- `balaqoldau/src/i18n/kk.ts`, `ru.ts`: 305 matching public/admin message entries.
- `balaqoldau/src/account/translations.ts`: 59 matching account/profile entries.
- Includes navigation, footer, headings, accessible labels, placeholders, validation,
  status/action labels, errors, loading/empty/success states and admin confirmations.
- API errors are mapped to safe frontend messages; raw backend error messages are
  not displayed. Previously stored validation/error messages retranslate on switch.
- Locale changes do not reset unsent search, profile or admin form input or change
  API query contracts. `lang` is not forwarded to admin program queries.
- Program titles, descriptions, eligibility, source names, category and region names
  supplied by the API remain in their original language. The existing API has no
  verified translated-content fields. `ContentLanguageNotice` explains this fallback;
  translations must be supplied and verified before displaying translated program data.
- Native language names (`Қазақша`, `Русский`), indicators (`ҚАЗ`, `РУС`), branding,
  technical identifiers (DEMO, slug, URLs), and canonical keyword search values are
  intentional invariants. Browser-native date/number control text follows the browser's
  own locale; application date formatting uses the selected locale.
- Unused historical `src/data/programs.ts` is not a live catalog and was not translated
  or published. No official content was invented or auto-translated.

## Audited routes

Every row is tested in Kazakh and Russian on the built frontend, with in-place
language switching, exactly one header switcher, refresh persistence, visible text /
accessible labels and 375px overflow checks. `:id` uses an isolated TEST API fixture.

| Area | Route | Coverage |
|---|---|---|
| Public | `/` | Search, directions, API categories, footer |
| Public | `/find` | Filters and unsent search preservation |
| Public | `/results` | Filters, results, empty/error states, search preservation |
| Public | `/program/:id` | Details, source/eligibility fallback, save controls |
| Public | `/favorites` | Legacy browser favorites and empty state |
| Public | `/contact` | Labels, validation and success relocalization |
| Public | `/*` | Unknown-route 404 (`/not-found`) |
| Account | `/login` | Login form |
| Account | `/register` | Registration and password validation messages |
| Account | `/forgot-password` | Reset request |
| Account | `/reset-password` | Reset form and invalid-token state after refresh |
| Account | `/profile` | Overview, profile editing, saved count, logout |
| Account | `/profile/saved` | Saved programs and empty state |
| Admin | `/admin` | Index redirect preserving language |
| Admin | `/admin/login` | Staff login |
| Admin | `/admin/programs` | Search/status filters, roles, table, unsent search |
| Admin | `/admin/programs/new` | Create form, validation, unavailable taxonomy |
| Admin | `/admin/programs/:id` | Details and draft/review/verified/published confirmations |
| Admin | `/admin/programs/:id/edit` | Edit form and original content |
| Admin | `/admin/*` | Admin unknown route (`/admin/not-found`) |

## Reproducible verification

From `balaqoldau/`:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run test:localization
$env:BROWSER_BUILD='true'
npm run test:browser
```

`test:localization` uses owned headless Chrome, built assets and intercepted API
fixtures only: no database connections or writes. It verifies 40 route/language
cases plus navigation, safe errors, contact success, saved empty states, missing
taxonomy and admin action confirmations. The existing browser suite also tests
keyboard menus, focus, responsive layouts and computed contrast. Its real smoke
uses only GET requests against `balaqoldau_dev`; authentication requests are fixtures.
The public smoke server explicitly disables inherited local auth settings because
those are outside its scope; application/auth security configuration is unchanged.

Real account/admin mutation browser suites require database fixtures and are not run
as part of this no-database-write localization task. This verification establishes
frontend localization behavior, not a new backend security or full WCAG certification.

Verified results (2026-11-13): unit tests **48/48**, localization browser **57/57**,
existing browser regression suite **29/29**; frontend lint, TypeScript checks and
production build **PASS**. No unresolved localization test failures remain.
