# Kazakhstan regions and support reference data

## Sources and meaning

The Bureau of National Statistics lists 17 regions and 3 cities of republican
significance as of 1 July 2026: Astana, Almaty and Shymkent are separate administrative
units. Source: [official publication and full regional table](https://stat.gov.kz/ru/industries/social-%C3%83%E2%80%9A%C3%82%C2%ADstatistics/demography/publications/335821/).

Migration `013_reference_data.sql` establishes 20 application slugs, with separate
`almaty-region` and `almaty-city`. These are application identifiers, not official KATO
codes. Names in the frontend dictionaries are Kazakh/Russian display labels; source
program titles, descriptions and eligibility text are never machine-translated.

`family_categories` is the existing Stage 14 support-needs matching table. The three
new product tags are `education-support`, `creative-development`, `sports-activities`.
They describe support interests; they are **not statutory family categories**, diagnoses,
disability, income or household statuses. They are product definitions, not imported
government eligibility rules. Program category describes the kind of opportunity;
support need describes a sourced support focus. No tag is assigned to any existing
program automatically. Staff must review source evidence before treating structured
conditions as complete. Missing/unreviewed eligibility remains POSSIBLE.

Stage 15 child preferences still reference program categories, not family support
statuses. No new family/child personal attributes are collected.

## Migration and safety

The verified local database contained only the DEMO region and DEMO family category.
013 adds reference rows with `ON CONFLICT(slug) DO NOTHING`; existing IDs/names, foreign
keys, programs, children, users, decisions and audit records are preserved. DEMO rows
remain stored for compatibility, but cannot be selected as real program references or
new/updated child locations. Legacy child/program records are not silently rewritten.

From `backend`, build with `npm run build`. Before `npm run db:migrate`, verify the
configured database identity through an authorized connection; local target must be
`balaqoldau_dev`. Never use `balaqoldau_db`. Existing migration runner checks checksums
and runs transactionally; replay returns zero. No DEMO seed is required.

For another environment, inventory existing real region slugs first. If it already
uses different identifiers for these same units, prepare an authorized mapping instead
of inserting duplicate semantic regions or rewriting foreign keys automatically.
No production migration, role/credential change or catalog publication was performed.

## Admin form behavior

- Regions are searchable and support multiple checkboxes.
- Nationwide explicitly selects the 20 canonical region IDs. It creates no sentinel
  region or new matching rule: the existing program_regions membership works for every
  selected location. Existing additional selections are retained; unchecking nationwide
  removes the canonical 20 only. Selection requires all 20 actual reference rows loaded.
- Known categories, regions, support needs and DEMO labels use the current locale.
  Slugs and form values survive locale changes. Custom operator-defined reference names
  retain their original text until reviewed translations are supplied.
- Missing reference data has a localized notice; failed reads retain existing explicit
  retry behavior. No invented options are substituted for failed reference requests.
- Real drafts reject DEMO references on the server; approval also rechecks legacy
  references. DEMO drafts may retain test references but cannot be verified/published.
- Invalid/removed selections receive a localized message and explicit removal control;
  selections are never silently discarded during editing.

Local manual checks: `/admin/programs/new?lang=kk`, then `?lang=ru`; select several
regions, toggle nationwide, switch language with filled inputs, save the draft, reopen
editing and compare selected values. Use authorized staff and clearly identified QA
fixtures. Do not publish fictional programs.
