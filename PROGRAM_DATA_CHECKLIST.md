# Program data-entry checklist

Use this template to prepare ten real Kazakhstan child and family support programs for the Admin Panel. Each slot stays blank until an official source confirms the opportunity. Copy the entry block once per slot.

## Intake slots

| Slot | Category slug | Official program title | Official source URL |
| --- | --- | --- | --- |
| B1 | `benefits` | | |
| B2 | `benefits` | | |
| B3 | `benefits` | | |
| B4 | `benefits` | | |
| F1 | `free-courses` | | |
| F2 | `free-courses` | | |
| G1 | `grants` | | |
| G2 | `grants` | | |
| C1 | `clubs` | | |
| C2 | `clubs` | | |

## Entry block

**Slot and source checked on (YYYY-MM-DD)** —

| Admin field | Value | Validation and evidence |
| --- | --- | --- |
| Title (`title`) | | Required, 1–240 characters after trimming. Use the official program title. |
| Slug (`slug`) | | Required, unique, max 120 characters. Match `^[a-z0-9]+(-[a-z0-9]+)*$`. Check for duplicate records. |
| Category (`category`) | | Required. Use the slot's category slug and select it in the Admin form. |
| Description (`description`) | | Required, 1–10,000 characters after trimming. Summarize the cited offer and its documented limitations. |
| Minimum and maximum age (`ageMin`, `ageMax`) | | Required in the form. Whole numbers from 0 to 17 inclusive, minimum ≤ maximum. Confirm both values against the source before entry. |
| Source name (`sourceName`) | | Required for submission, 1–200 characters after trimming. Identify the official publisher. |
| Source URL (`sourceUrl`) | | Required for submission. Use the official HTTPS program page, max 2,048 characters, with no credentials or whitespace. |
| Regions (`regions`) | | At least one required for approval. Select up to 50 distinct non-demo options from the Admin taxonomy. Use nationwide selection only when the source supports it. |
| Family categories (`familyCategories`) | | Optional. Select up to 50 distinct non-demo options supported by the source. Record any condition the taxonomy cannot capture in the description. |
| Application URL (`applyUrl`) | | Optional. Use the official HTTPS application link if provided, with the same URL constraints as the source. |
| Application deadline (`deadline`) | | Optional. Use the documented date in YYYY-MM-DD. |
| Availability expiry (`expiresOn`) | | Optional. Use the documented end of program availability in YYYY-MM-DD. |
| Eligibility complete (`eligibilityComplete`) | | Defaults to false. Check only when all source eligibility conditions are faithfully represented in structured fields. |
| Demo (`isDemo`) | false | Leave Demo unchecked. |

- [ ] Confirm the source is controlled by the responsible public body or official program operator. Check that the offer is current and belongs in the selected category. For `free-courses`, verify that participation is free.
- [ ] Keep optional values blank when the source does not provide them. If a required value cannot be substantiated, flag the gap and hold the entry for clarification. Record only amounts, conditions and dates supported by the source.
- [ ] Save the non-demo draft in `/admin/programs/new` and submit it once the source fields are present.
- [ ] Have an eligible Reviewer or Admin check the source, program information and eligibility and confirm all three attestations. The workflow records verification metadata and moves the entry to `verified`.
- [ ] Have an Admin confirm publication after checking that the approval is current and version-bound, the program is unexpired, and no source recheck is pending.

See the [verification workflow](backend/VERIFICATION.md) and [Admin API contract](backend/PROGRAM_API.md).
