# BalaQoldau — independent GovTech discovery

Current design: Stage 7.6, 2026-11-12. This supersedes the earlier atlas and Stage 7.5 landing-page composition.

## Stage 7.6 refinement

References: [GOV.UK](https://www.gov.uk/) for search-led service directories and plain
linked topics; [eGov](https://egov.kz/kk) for the Kazakhstan public-service context.
The eGov text response remains limited. Neither branding nor page layout was copied.
The original interface uses a compact search column beside a semantic three-step guide,
then a two-column text directory. There are no marketing eyebrows, oversized hero text,
icon-per-topic cards, promotional CTA panels or nested home form cards.

H1 is 24–32px, corners 2px, topic links are underlined, results are separated list rows.
A small original abstract interlaced SVG, inspired by ornamental rhythm, uses muted
teal #197d89 as the single decorative accent. It is aria-hidden, noninteractive and not
a state symbol. White/navy/blue, actual source facts and the independence notice remain.
On widths <=960px the guide follows search. The #how anchor still focuses the guide.
No photographs, new fonts, dependencies or backend changes were introduced.

## Design contract

The homepage helps parents find support information through one prominent keyword search,
with optional region, age and API-backed category filters. Results/details/favorites/contact
share a white, navy, blue and gray system. The platform is independent: a visible notice in
both header and footer states that it is not an official government website. No state seal,
eGov logo, endorsement, invented program, count or verification badge is used.

Reference supplied by the owner: [eGov Kazakhstan](https://egov.kz/kk). Its public portal was
consulted for institutional context; the text-only reference response was limited, so this
is an original task-led layout, not a claimed pixel reproduction. Project frontend UI
Engineering and installed UI/UX Pro Max accessibility/layout guidance informed the design.

## Decisions

- Content-first search replaces the photo hero. The photo with unconfirmed rights is no longer
  rendered or requested; its asset/credits remain unchanged. Vite still copies public assets,
  so licensing/removal review remains a launch gate. No new image or external font.
- Four support-direction links use supported q searches, not invented backend category slugs.
  Real categories/regions still come exclusively from the API. Empty results remain honest.
- Segoe UI/system sans supports Kazakh characters. Body 16px, labels 14px, captions 12–13px;
  restrained headings and 4/8px spacing rhythm. No decorative emoji, gradients or seals.
- White surfaces, navy header notice, blue primary actions, thin gray rules and 2px corners.
  The existing original heart wordmark remains in a simple blue mark; no government symbolism.
- Each program retains actual source links and verifiedAt information in its detail view.
  The published label describes API visibility, not government approval.
- Native controls, one h1/main, skip link, 44px controls, visible 3px focus, linked form errors,
  safe external links, loading/error/empty/success states and responsive disclosure navigation.
- 320/375px: one-column forms/cards; 768px: readable stacked search; 1024px: two-column cards;
  1440px: four direction links/three catalog columns. No fixed-width content overflow.
- Decorative entrances and the unused scroll observer were removed. Reduced motion and
  forced-colors rules remain; no dependency was installed and API contracts did not change.

## Verification

Run frontend build/lint/unit tests and the browser suite in both development and built-dist
modes. Review desktop/mobile screenshots of all six pages, five-width layout/contrast checks,
keyboard controls and real backend GET smoke. TEST fixtures never publish records. Manual
NVDA/VoiceOver and production ingress testing remain separate launch gates, not WCAG claims.
