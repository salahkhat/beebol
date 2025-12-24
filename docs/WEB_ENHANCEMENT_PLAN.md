# Beebol Web – Enhancement Plan (Execution-Ready)

Date: 2025-12-23
Updated: 2025-12-24

## Scope & Constraints

- Improve the existing web app experience significantly. (Later phases may introduce new routes/pages when needed.)
- Stay consistent with the existing design system (Radix Themes + Tailwind tokens already in use).
- Focus on “high leverage” work: reliability, accessibility, performance, and UI polish.

## Goals

1. **Never crash to a blank screen**: global error boundary with a friendly recovery path.
2. **Feel fast**: skeleton loaders and less jarring loading transitions.
3. **Clear states**: consistent empty/error states with retry where applicable.
4. **Accessible by default**: keyboard navigation, skip link, landmarks.
5. **Consistent page structure**: shared header patterns and spacing.

## Implementation Steps

### 1) Global UX hardening

- Add an `ErrorBoundary` wrapper around the routed app:
  - Displays a Radix `Callout` fallback.
  - Provides actions: “Reload” and “Go to listings”.
- Add `ScrollToTop` on route change.
- Add `Skip to content` link and a `<main id="main">` landmark.

### 2) Reusable UI primitives

- Add a small `ui/Skeleton.jsx` for loading placeholders.
- Add a `ui/EmptyState.jsx` wrapper for consistent empty states.
- Add a `ui/InlineError.jsx` component for consistent error callouts + optional retry.

### 3) Page upgrades (existing routes)

- **Listings**: show skeleton cards while loading, add “Clear filters” action (uses existing filters), better pagination affordances.
- **Listing detail**: skeleton for header/body while loading, improve image grid loading/spacing, clearer owner reorder hint.
- **Threads**: skeleton list while loading, improve empty state.
- **Thread detail**: keep refresh from wiping UI, add scroll-to-bottom on new messages, consistent send-button busy state.
- **My listings / Moderation**: consistent skeleton/error/empty states.

### 4) Form polish

- Improve login/register error feedback consistency (use shared inline error component where appropriate).
- Improve disabled/loading states consistency across forms.

### 5) Verification

- Run `npm --prefix web run build`.
- Fix any build/lint errors introduced by changes.

## Phase 2 – Production-level features (no new routes)

### A) Dark mode (Theme toggle)

- Add an app-level appearance setting (light/dark) persisted in `localStorage`.
- Add a toggle button in the header next to the language switch.
- Keep Radix Theme tokens (no custom hard-coded palette).

### B) Favorites (client-side)

- Allow users to favorite/unfavorite listings from:
  - Listings list cards
  - Listing detail header
- Persist favorites in `localStorage`.
- Ensure buttons are accessible (`aria-pressed`, keyboard focus).

### C) Recently viewed (client-side)

- Track recently viewed listings whenever a listing detail is loaded.
- Show a small “Recently viewed” section at the top of Listings page (limited count).

### D) Share listing

- Add “Copy link” button in listing detail.
- Use `navigator.clipboard` when available with a safe fallback.
- Confirm via toast.

### E) Web app metadata (SEO + installability)

- Add meta description + basic Open Graph tags.
- Add `manifest.json` and link it from the HTML template.

### F) Bundle performance

- Ensure route-level code splitting is effective.
- Enable `splitChunks`/`runtimeChunk` in webpack to reduce initial bundle size.

## Phase 3 – Functional features (no new routes)

### A) Listing Q&A (backend-powered)

- Add a “Questions” section on listing detail.
- Authenticated users can ask a question (POST `listings/:id/questions/`).
- Sellers can answer questions (POST `questions/:id/answer/`).

### B) Listing owner management (backend-powered)

- My Listings: inline edit listing fields (title/price/currency) with save/cancel.
- Listing Detail (owner): upload multiple images, reorder (drag or buttons), and delete images.
- Backend support: `POST api/v1/listings/bulk_update/` for bulk status changes (seller) and bulk moderation changes (staff).

### C) Moderation bulk actions (backend-powered)

- On Moderation, staff can select multiple pending listings and bulk approve/reject.

### D) Moderation listing details (backend-powered)

- On Moderation, staff can expand a listing to view full description and images (fetched on demand) before deciding.

### E) Moderation removed/restore (backend-powered)

- On Moderation, staff can toggle “Show removed” to view removed listings.
- Staff can restore removed listings (per-item or bulk).

### F) Moderation flagged filter (backend-powered)

- On Moderation, staff can toggle “Show flagged” to view flagged listings only.

## Phase 4 – New routes (feature expansion)

### A) Seller profile

- Add a public seller profile route: `/sellers/:id`
- Show seller listings with pagination.

### B) Admin dashboard

- Add a staff-only dashboard route: `/admin/dashboard`
- Show quick counts for pending/flagged/removed listings, and link into moderation.

## Phase 5 – New routes (functional expansion)

### A) Saved searches (client-side)

- Add an authenticated route: `/saved-searches`
- Listings page: add “Save search” action when filters are active.
- Persist saved searches (name + querystring) in `localStorage`.

### B) Listing compare (client-side)

- Add a public route: `/compare?ids=1,2,3`
- Listing detail: add “Add to compare” action.
- Persist compare list in `localStorage`, keep URL shareable.

### C) Reports workflow (backend-powered + staff review)

- Add an authenticated report flow: `/reports/new?listing=<id>`
  - Users submit a report with a reason and optional details.
- Backend: add a `reports` app + `ListingReport` model and expose `/api/v1/reports/`.
- Staff: surface open reports inside Moderation via a “Reports” mode toggle (resolve/dismiss).

## Phase 6 – Reports UX enhancements

### A) My reports (user-facing)

- Add an authenticated route: `/reports`
- Users can see their submitted reports with status and a link back to the listing.
- Optional status filter via querystring: `/reports?status=open|resolved|dismissed`

### B) Staff reports filtering

- In Admin Moderation “Reports” mode, allow filtering by status (open/resolved/dismissed).

## Phase 7 – Notifications UI + Watchlist + Staff report preview

### A) Saved-search notifications UI (client-side)

- Saved searches now support a per-search **Notify on/off** toggle.
- Added a **Check now** action that queries the listings API and stores the latest result count for that saved search.

### B) Watchlist with price-change highlights (client-side)

- Added an authenticated route: `/watchlist`
- Watchlist loads watched listings, shows whether price went up/down/same (or currency changed), and lets users “mark seen” / remove.
- Listing detail includes a **Watch/Unwatch** action to add/remove the listing.

### C) Staff report listing preview (staff-only UX)

- In Admin Moderation “Reports” mode, each report can toggle a compact listing preview fetched on-demand to speed up triage.

## Phase 8 – Buyer & seller retention (client-side)

### A) Following sellers

- Added an authenticated route: `/following`
- Buyers can **Follow/Unfollow** a seller from:
  - Seller profile header
  - Listing detail seller row
- Following list aggregates “latest listings per followed seller” using the existing listings endpoint filtered by seller.

### B) Watch/Unwatch entry points on cards

- Listings grid cards include **Watch/Unwatch** alongside Favorite.
- Seller profile listing cards include **Watch/Unwatch** alongside View.

### C) Saved-search “new matches” indicator

- Saved searches track “new matches since last check” and display a `+N` delta after **Check now**.

## Acceptance Criteria

- Phases 1–3 introduced no new routes; Phases 4–5 introduce routes intentionally.
- All pages render a skeleton instead of a single spinner during load.
- Every error state is actionable (retry where possible).
- Keyboard users can reach main content quickly (skip link).
- Web build succeeds.

### Routes added in Phases 4–5

- `/sellers/:id`
- `/admin/dashboard`
- `/saved-searches`
- `/compare`
- `/reports/new`

### Routes added in later phases

- `/reports`
- `/watchlist`
- `/following`
