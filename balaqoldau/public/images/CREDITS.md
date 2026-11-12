# Frontend asset licensing — Stage 8.4

| Asset | Status | Evidence |
|---|---|---|
| `../balaqoldau.svg` | Project-owned BalaQoldau mark | Manifest: LicenseRef-Project-Owned, SHA-256 |
| `family-reading.svg` | Original artwork, MIT; commercial use allowed | Full permission notice embedded in SVG; manifest SHA-256 |
| Lucide inline SVG icons | ISC; some inherited icons MIT | Installed lucide-react/LICENSE copied verbatim to ../THIRD_PARTY_NOTICES.txt and shipped |
| CSS ornament and inline UI SVG paths | Project source artwork | No stock image or official seal; maintainer ownership review before release |
| Segoe UI / Arial / sans-serif | System font fallback | No font files, web-font imports or font downloads distributed |

Removed: unused family.jpg (owner-supplied photograph with no specified license),
src/assets/hero.png (no recorded license), starter vite.svg, react.svg,
favicon.svg and icons.svg (unused; no local provenance retained).
No third-party ownership or license is inferred from a filename or logo.

There are no photo assets in the active frontend. Development and production use the
same approved illustration. Historical design notes may describe removed prototypes.
The manifest checks current inventory, exact bytes and build output; it cannot independently
establish legal ownership. Maintainers must review provenance, attribution and new assets.
