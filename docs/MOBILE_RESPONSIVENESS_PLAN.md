# Mobile Responsiveness Plan ✅

**Goal:** Improve the mobile responsiveness and UX of the Beebol web app so key pages render and behave well on narrow viewports and common mobile devices. This plan covers an audit, prioritized fixes, code guidelines, QA checklist, and rollout strategy.

---

## Summary

- Scope: All pages and shared UI components under `web/src` (notably `AppLayout.jsx`, listing pages, `MapListings.jsx`, forms, cards, thumbnails, toasts/modals).
- Approach: Audit → implement focused fixes (global layout, navigation, grids/cards, images, maps, forms, overlays) → automated + manual testing → deploy & monitor.

---

## Inventory (high-level findings)

Files/components to focus on (samples found during scan):

- Layout & navigation: `web/src/components/AppLayout.jsx`, header, category menus
- Listing & cards: `ListingThumbnail.jsx`, `Card.jsx`, pages: `ListingDetail.jsx`, `CompareListings.jsx`, `Watchlist.jsx`, `MyListings.jsx`
- Grids: usage of `Grid` in pages: `Watchlist`, `CompareListings`, `ListingDetail`, `CreateListing`, `MapListings` (has complex grid with fixed 360px columns)
- Media & carousels: image galleries in `ListingDetail.jsx` (uses `overflow-x-auto`) and thumbnails
- Maps: `MapListings.jsx` uses 3-column layouts with fixed widths
- Forms: `Register.jsx`, `Login.jsx`, `CreateListing.jsx` (require stacking & full-width inputs on mobile)
- Overlays & notifications: `ui/Toast.jsx`, modals, and any drawer menus
- Utilities: `styles.css` (global rules), Tailwind and custom class usage

---

## Common Problems Observed

- Fixed/large widths and 360px sidebars that don’t collapse gracefully on small screens (map/listing pages).
- Grid columns that keep multiple columns on narrow screens or set min widths that cause horizontal scroll.
- Some images set fixed heights without appropriate mobile scaling causing cropping or overflow.
- Navigation/mega-menus not optimized for touch or mobile (no drawer fallback).
- Toasts set to fixed widths; may overlap or feel awkward on small screens.
- Form fields or controls not consistently stacked full-width on mobile.

---

## Prioritized Workplan (Actions & Acceptance)

### 1) Audit & Baseline (Immediate) ⚡
- Inventory pages/components and capture screenshots in three sizes: 360×800, 768×1024, and 1280×800.
- Note visible layout breakages and add them to issue tracker.
- Acceptance: baseline doc + screenshots created for each critical page.

### 2) Global layout & container consistency (High)
- Implement a single responsive container pattern (Tailwind `container` or a `max-w-*` consistent class).
- Ensure global horizontal padding scales (e.g. `px-4 sm:px-6 lg:px-8`).
- Acceptance: every page content is centered with no horizontal scroll at 360px width.

### 3) Mobile Navigation & `AppLayout` (High)
- Replace hover/desktop mega-menus with a mobile-first menu: drawer or collapsible menus.
- Ensure touch target sizes ≥44px and visible focus states.
- Acceptance: header collapses to a hamburger + drawer on widths <= 640px; key links accessible.

### 4) Listing Grid & Cards (High)
- Ensure `Grid` uses single column on small: { initial: '1', sm: '2' } or use CSS `grid-cols-1 sm:grid-cols-2`.
- Make cards full-width on mobile; ensure internal layout wraps vertically.
- Acceptance: cards stacked single-column at 360px, images scale and no overflow.

### 5) Images & Carousels (High)
- Use `w-full h-auto object-cover` for thumbnails; for gallery give max-height (e.g., `max-h-[60vh]`) and `object-contain` for tall images.
- Add swipe support (native `overflow-x-auto` with `-webkit-overflow-scrolling: touch` and `snap-x` classes) for image lists.
- Acceptance: image galleries are usable and scrollable with touch, no layout shift.

### 6) Map pages & sidebars (High)
- Collapse sidebars into collapsible drawers under the map or move them below the map on narrow screens; change `md:grid-cols` 3-column layout to single column on small.
- Avoid fixed 360px columns at small widths; use percentage or reorder DOM for mobile.
- Acceptance: map remains visible and usable on small screens; side content is accessible but not overlapping.

### 7) Forms & Inputs (Medium)
- Stack fields and set `className='w-full'` on inputs & buttons; increase tap target sizes and use smaller vertical spacing.
- Acceptance: forms are single-column and buttons stretch full width on mobile.

### 8) Toasts, Modals & Overlays (Medium)
- Ensure toasts and toasts’ viewports use responsive max-widths (e.g., `max-w-[92vw]`) and center on very small widths.
- Make modals full-screen on small devices (or use `max-width: 100%` and proper padding).
- Acceptance: nothing overflows the viewport and elements are touch-friendly.

### 9) Accessibility, Touch Targets & Typography (Medium)
- Ensure font sizes and line-heights are legible; ensure interactive elements meet size and contrast.
- Acceptance: touch targets >=44px and pass a quick a11y check.

### 10) Tests & QA (High)
- Add visual regression snapshots for key pages (Listing page, ListingDetail, MapListings, CreateListing, Login/Register) at mobile viewport.
- Create manual QA checklist and sign-off criteria.

### 11) Deploy & Monitor (Medium)
- Deploy with feature flags/beta; monitor bounce and layout shift metrics for mobile users.

---

## Concrete Implementation Suggestions & Examples 🔧

- Use `Grid` or Tailwind responsive columns: `columns={{ initial: '1', sm: '2', md: '3' }}` or `className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"`.

- Images: prefer these utility classes for thumbnails and gallery images:

```jsx
<img className="w-full h-auto object-cover rounded" src={...} alt="..." />
```

- Mobile carousel using CSS snapping:

```html
<div class="overflow-x-auto snap-x snap-mandatory -mx-4 px-4 grid grid-flow-col auto-cols-[80%] sm:auto-cols-[50%] gap-4">
  <div class="snap-start">...</div>
  <div class="snap-start">...</div>
</div>
```

- AppLayout: add mobile hamburger to toggle Drawer; hide desktop category mega menu on small screens and show a compact category list inside drawer.

- Map layout fallback (pseudo):

```jsx
// desktop
'className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_360px] md:items-start"'
// mobile fallback
'className="grid gap-4 grid-cols-1"'
```

- Toasts: center/skew on mobile
```css
@media (max-width: 640px) {
  .toast-viewport { left: 50%; transform: translateX(-50%); right: auto; }
}
```

---

## Testing Checklist ✅

- [ ] No horizontal scroll at 360px width on all critical pages
- [ ] Navigation accessible & touch-friendly on mobile
- [ ] Listings stacked & images scale properly
- [ ] Map listings usable with sidebars collapsed
- [ ] All modals & toasts fit inside viewport and are touch accessible
- [ ] Visual regression snapshots pass
- [ ] Manual QA on iPhone and Android emulators complete

---

## Acceptance Criteria & Metrics

- Key pages render without horizontal overflow at 360px
- Reduced layout shift (CLS) across listing pages (quantify if possible)
- Bounce rate on mobile improves (post-deploy monitor)

---

## Rollout Plan

1. Implement changes in small, focused PRs (one area per PR) with screenshots and visual comparison
2. Add visual-test snapshots for each changed page
3. Deploy behind feature flag / to limited audience
4. Monitor metrics for 1-2 weeks, fix regressions

---

## Notes & Next Steps

- Start with Audit & Baseline (todo #1). After baseline, tackle Navigation & Map/Listing layout first (highest user impact).
- I can open PRs with example UI changes once you'd like me to start implementing.

---

## Automated audit script 🧭

I added a Playwright-based audit script that captures screenshots at three viewports and produces a JSON report:

- Script path: `tools/audit/run-audit.mjs`
- Pages list: `tools/audit/pages.json`
- Output: `docs/audit-output/screenshots` and `docs/audit-output/report.json`

Run it with:

```bash
npm install -D playwright
npm run dev # starts dev server (defaults to port 3000)
npm run audit:mobile
```

(You can set `BASE_URL` to point to a staging URL.)

If you'd like, I can install Playwright here and run the audit now — tell me to "run the audit" and I'll proceed.

---

If you'd like, I can: run the full audit (capture screenshots + create a small report), then implement the highest priority fixes and add visual tests.
