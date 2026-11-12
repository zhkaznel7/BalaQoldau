# BalaQoldau GovTech design system — Stage 7.6

Current implementation: src/index.css (reset), src/refinements.css (tokens/components/layout).
Rationale and reference limitations: [design direction](../../DESIGN_DIRECTION.md).

| Token | Value | Purpose |
|---|---|---|
| --paper / --surface | #ffffff | White page and forms |
| --surface-soft | #f1f5f9 | Secondary panels |
| --navy | #102e50 | Platform notice / identity |
| --ink | #142b47 | Headings and body |
| --muted | #526477 | Secondary text |
| --action | #075ea8 | Buttons / links / focus |
| --action-hover | #064d88 | Hover |
| --accent | #F4B942 | Homepage search CTA and small original illustration/ornament; navy text |
| --line | #d6dee8 | Card boundaries |
| --field-line | #73849a | Input boundaries (3:1 on white) |
| --error-ink / surface | #932b32 / #fff3f3 | Error with text/icon |
| --success-ink / surface | #205c40 / #edf7f0 | Success with text/icon |

System sans, body 16px/1.6, h1 24–32px, h2 20–24px, labels 14px. Max container 1240px;
32/24/16px responsive gutters. Primary controls 48px; icon/navigation controls at least 44px.
Borders 1px; main panel corners 2px; no decorative shadows, asymmetrical feature cards,
background photography, emoji or animated entrances. Lucide icons have aria-hidden where
adjacent text conveys their meaning. Error/success require text, not color alone.

Header/footer explicitly identify an independent platform. Direction shortcuts use q only;
API categories and all source/verification facts remain data-driven. Every existing route,
URL filter, favorites and contact contract is retained. Keyboard/contrast/browser checks and
manual assistive-technology limitations are recorded in PROGRESS.md.
