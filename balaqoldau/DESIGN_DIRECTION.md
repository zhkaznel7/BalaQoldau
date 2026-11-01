# BalaQoldau — Қамқорлық атласы

## Existing product

React 19 + TypeScript + Vite + Tailwind; React Router preserves `/`, `/find`, `/results`, `/program/:id`, `/favorites`. Search is an asynchronous local repository with city, age, family, type and text filters. Favorites persist in localStorage. All six records are fictional DEMO examples. No backend, authentication or application submission exists.

## Skill research and editorial decisions

Used `.agents/skills/ui-ux-pro-max/SKILL.md`, its design-system search, typography domain and React stack search. The narrowed `nonprofit community platform` search returned Hero + Features + CTA / Minimalism & Swiss Style; adopt its functional grid, type hierarchy and 200–250ms feedback. Applicable accessibility guidance: 16px readable body copy, controlled forms, clear navigation, 44px targets, focus rings, semantic labels and reduced motion. Humanist typography search returned Corporate Trust (Lexend / Source Sans 3) and News Editorial (Newsreader / Roboto). The initial aggregate classified the product as senior care: its sales, certification and blue-palette advice is inappropriate and is not adopted. The exact Cyrillic query returned no match; local Kazakh glyph support is an explicit implementation decision.

Retain the established humanist Segoe UI/system sans stack with complete local Kazakh glyph support instead of importing an unverified Latin-focused display font. Add an expressive, restrained Georgia serif accent only for short editorial captions. No external font dependency or font loading shift.

## Applied identity

- Concept: a parent’s field guide to possibility, expressed through an atlas frame, branching SVG paths, indexed sections and a small compass-like brand motif.
- Paper: `#FAF9FF`; ink: `#202035`; secondary text: `#625C70`; brand purple: `#7659E8`; action purple: `#6545CE` for readable white labels; mint: `#A8E6CF`; warm oat: `#F5EDDF`.
- Solid color surfaces; fine rules; generous typography; fewer floating widgets; no decorative gradients, fake statistics, testimonials or authority seals.
- Hero: editorial split layout, existing family illustration within a custom atlas composition, one clear search path, full-width compact finder.
- Categories: indexed asymmetric composition with a large mint feature, warm education panel and two smaller supporting panels.
- Discovery: quiet form controls, strong result headings, category labels, separated eligibility facts and visible favorites.
- Details and forms share the same spacing, border, focus, color and type tokens.
- Motion: one-time entrances and short state feedback, no perpetual decoration. Reduced motion removes nonessential transformations.

## Verification

Preserve existing business logic and URL contracts. Run production build and repository tests; check text/CTA token contrast with WCAG luminance calculation. Browser verification is reported separately when an automation tool is available.
