# Beebol Web – Enhancement Plan (Execution-Ready)

Date: 2025-12-23

## Scope & Constraints

- Improve the existing web app experience significantly **without adding new routes/pages**.
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

## Acceptance Criteria

- No new routes were introduced.
- All pages render a skeleton instead of a single spinner during load.
- Every error state is actionable (retry where possible).
- Keyboard users can reach main content quickly (skip link).
- Web build succeeds.
