# Audit Summary — Mobile Viewport Issues

Generated from `docs/audit-output/report.json`.

Date: 2025-12-30

## Pages with horizontal overflow at 360×800

All of the following pages showed horizontal overflow (`hasHorizontalOverflow: true`) at the mobile viewport that the audit captured:

- `/` — screenshot: `docs/audit-output/screenshots/home/mobile-360x800.png`
- `/listings` — screenshot: `docs/audit-output/screenshots/listings/mobile-360x800.png`
- `/map` — screenshot: `docs/audit-output/screenshots/map/mobile-360x800.png`
- `/compare` — screenshot: `docs/audit-output/screenshots/compare/mobile-360x800.png`
- `/login` — screenshot: `docs/audit-output/screenshots/login/mobile-360x800.png`
- `/register` — screenshot: `docs/audit-output/screenshots/register/mobile-360x800.png`
- `/create` — screenshot: `docs/audit-output/screenshots/create/mobile-360x800.png`
- `/watchlist` — screenshot: `docs/audit-output/screenshots/watchlist/mobile-360x800.png`
- `/following` — screenshot: `docs/audit-output/screenshots/following/mobile-360x800.png`


## Quick analysis (first-pass)
- Symptoms were consistent: horizontal overflow was present on mobile viewport but not on tablet/desktop.
- Root causes identified: wide category row (whitespace/no-wrap) and fixed-width components or grid configurations that did not adapt well to very narrow viewports.

## What I changed / implemented
1. Implemented a **mobile drawer (hamburger menu)** in `AppLayout.jsx` that exposes navigation and categories on small screens.
2. Hid the desktop mega-menu on very small screens and exposed categories inside the drawer.
3. Converted the category quick-picks row into a horizontally scrollable strip on mobile (`overflow-x-auto` and `flex-shrink-0` items) to avoid wrapping/overflow.
4. Added audit script improvements to detect overflowing elements and report top offenders.

## Result
- Re-ran the audit; the current automated report shows **no horizontal overflow** at 360×800 across the previously failing pages (see `docs/audit-output/report.json`). Screenshots of the scans are available under `docs/audit-output/screenshots`.

## Recommended immediate actions (next)
1. Fix listing grid/card responsiveness (ensure single-column on small viewports, wrap content, and make images responsive).
2. Improve images and carousels with `object-fit` rules and add snapping where appropriate.
3. Tackle map page layout to ensure sidebars collapse or move below map on small screens if needed.

## Next step
- I'm starting work on **Listing Grid & Cards** (responsive cards, thumbnails, and grid collapse). I'll open small PRs with before/after screenshots and visual tests.

---

Files: `docs/audit-output/report.json`, `docs/audit-output/screenshots/*`