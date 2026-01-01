# Beebol — App Improvement Plan (2026)

Date: 2026-01-01

## Purpose
This document is the **app-wide roadmap** for improving Beebol beyond the current baseline.
It complements (and does not replace) these existing execution-ready docs:
- `docs/WEB_ENHANCEMENT_PLAN.md` (web UX hardening + feature phases)
- `docs/MOBILE_RESPONSIVENESS_PLAN.md` (web mobile UX)
- `docs/PROFILE.md` (profile feature spec)
- `docs/MILESTONES.md` (high-level product milestones)

The focus here is broader: **product features**, **backend capabilities**, **trust & safety**, **performance**, **reliability**, and **delivery process**.

---

## Guiding principles
- **Syria-first + Arabic/RTL-first**: all features should work well in Arabic and on low/mid devices.
- **API-first**: every major capability should be accessible via the backend API so web and mobile can share it.
- **Trust wins**: prioritize anti-spam, reporting, moderation tooling, and user safety.
- **Fast by default**: pagination everywhere, optimized images, predictable loading states.
- **Ship in slices**: each phase should be deployable independently.

---

## Current baseline (from repo state)
Already present or explicitly planned in docs:
- Listings lifecycle + categories + Syria locations (governorate/city/neighborhood)
- Listing-scoped messaging:
  - Public Q&A (`PublicQuestion` model exists)
  - Private threads/messages (`PrivateThread` / `PrivateMessage` models exist)
- Reports app (`ListingReport` model exists)
- Web UX upgrade plan with multiple phases (favorites, recently viewed, saved searches, compare, etc.)
- Web mobile responsiveness plan + audit tooling
- Deploy target: Render blueprint (`render.yaml`)

Gaps this plan targets:
- Stronger discovery/search, personalization, engagement
- Moderation workflow completeness and tooling
- Background jobs for media + notifications
- Security hardening + rate limits
- Observability (logs/metrics/tracing)
- Mobile app parity strategy

---

## Success metrics (pick a small set and track)
Product:
- **Conversion**: listing views → messages/Q&A → successful contact
- **Retention**: returning users (7-day / 30-day)
- **Supply**: new listings per day, % approved, median time-to-approval
- **Trust**: reports per 1k listings, spam rate, repeat offender rate

Engineering:
- **API p95 latency** for key endpoints (listings browse, listing detail, messaging)
- **Error rate** (5xx, client errors)
- **Image load performance** (LCP/CLS on listing pages)
- **Build stability** (CI pass rate)

---

## Roadmap (phased)
Each phase is designed to be shippable. Within a phase, implement top-to-bottom slices (DB → API → web → mobile) so features are end-to-end.

### Phase 0 — Reliability, security, and delivery (foundation)
Goal: safer releases and fewer regressions.

Deliverables:
- **Backend**
  - Structured logging (request id, user id when present, endpoint, duration)
  - Rate limiting for auth + posting + messaging (per IP + per user)
  - Standardized error envelope + consistent status codes
  - Health checks expanded (DB connectivity, migrations applied, storage health if used)
- **Web**
  - Global error boundary + consistent empty/error/loading states (already planned)
  - Basic analytics hooks (page view + key actions) behind a config flag
- **CI/CD**
  - Minimal CI: backend unit tests + web build on PR
  - Smoke test script for deployed API (build on `docs/API_QUICKSTART.md`)

Acceptance criteria:
- Release can be validated via smoke tests in <10 minutes.
- Rate limits stop basic spam without breaking legitimate use.

Dependencies:
- None (can be done on existing stack).

---

### Phase 1 — Search, discovery, and “quality listings”
Goal: users find what they want quickly; sellers create better listings.

Deliverables:
- **Search v2 (backend-powered)**
  - Full-text search on title/description + Arabic-friendly tokenization strategy
  - Relevance scoring (recency + quality signals + location match)
  - Faceted counts (category/location counts) for better filtering UX
- **Listing quality signals**
  - Enforce minimum images for publish (configurable)
  - Basic duplicate detection (same title+price+seller within time window)
  - Automatic image checks (min resolution; reject tiny images)
- **Discovery UX**
  - “Trending” and “New in your city” sections (server-driven)
  - “Similar listings” on listing detail (category + price band + location)

Acceptance criteria:
- Search results are stable, relevant, and paginated.
- No timeouts for common filtered queries.

Dependencies:
- If staying on SQLite for now, keep it simple; for best results plan Postgres FTS in Phase 6.

---

### Phase 2 — Trust & Safety v1 (abuse prevention + stronger moderation)
Goal: reduce spam/abuse and speed up moderation decisions.

Deliverables:
- **Reports workflow completion**
  - Report reasons enum + optional details (already exists; extend as needed)
  - Report status transitions: open → resolved/dismissed
  - Staff audit trail: who handled, when, and action taken
- **User blocking & safety**
  - Block user: prevents messaging and hides public Q&A interactions
  - “Report user” (links to recent listings/threads)
- **Anti-spam**
  - Posting/messaging cooldowns
  - Content heuristics: repeated text, phone-number spam patterns
  - Shadow-banning option (staff only)
- **Moderation UX**
  - Bulk actions (approve/reject/restore)
  - On-demand listing preview inside moderation and reports

Acceptance criteria:
- Staff can handle a report from start to finish in one place.
- Repeat spam offenders can be blocked quickly.

Dependencies:
- Phase 0 rate limiting.

---

### Phase 3 — Messaging & engagement upgrades
Goal: messaging feels reliable, and users come back.

Deliverables:
- **Messaging quality**
  - Read/unread per thread, last-read timestamp
  - Typing indicator and “delivered” semantics (optional; start with read receipts only)
  - Attachment support (images) with strict safety controls (optional)
- **Notifications**
  - Email notifications for: new private message, Q&A answer, listing status
  - In-app notification center (simple list) to avoid email dependency
  - Notification preferences per user

Acceptance criteria:
- Users can’t “miss” messages; there’s a clear unread indicator.
- Notifications can be disabled by the user.

Dependencies:
- Background jobs (Phase 6) for best experience; can start synchronous MVP.

---

### Phase 4 — Seller tools (power features)
Goal: sellers can manage inventory faster and sell more.

Deliverables:
- **My Listings v2**
  - Bulk edit status (publish/unpublish/archive)
  - Inline edit title/price/currency
  - Draft templates / “duplicate listing”
- **Media management**
  - Multi-image upload + reorder + delete (owner-only)
  - Automatic thumbnail generation and compression
- **Seller insights (lightweight)**
  - Views count, messages count, save/favorite count per listing
  - Daily/weekly summary

Acceptance criteria:
- Sellers can update many listings quickly without errors.

Dependencies:
- Strong storage story for images (Phase 6 recommended).

---

### Phase 5 — Marketplace growth features
Goal: make browsing sticky and increase conversion.

Deliverables:
- **Saved searches (server-backed)**
  - Move from `localStorage` to backend so it syncs across web/mobile
  - “New matches since last check”
- **Favorites & watchlist (server-backed)**
  - Persist favorites/watchlist in DB
  - Optional price-drop highlighting
- **Buyer flows**
  - “Make offer” (structured negotiation) for supported categories
  - Lightweight buyer checklist (e.g., condition, location confirmation)

Acceptance criteria:
- Saved searches and favorites sync across devices.

Dependencies:
- Auth/session stability; notifications (Phase 3) enhances this.

---

### Phase 6 — Infrastructure upgrades (scale-ready)
Goal: support growth and add background processing.

Deliverables:
- **Database**
  - Move to Postgres (Render already provisions Postgres) with safe migrations
  - Add proper indexes for browse/search/messaging
  - If/when needed: PostGIS for geo queries
- **Background processing**
  - Redis + Celery for: image processing, notifications, digest emails, cleanup jobs
- **Media storage**
  - S3-compatible storage for uploaded media (and signed URLs)
  - CDN caching headers

Acceptance criteria:
- Image uploads don’t block requests; thumbnails appear reliably.
- Backups and restore procedure documented and tested.

Dependencies:
- Deployment environment variables and secrets management.

---

### Phase 7 — Mobile app strategy (Flutter)
Goal: ship a real mobile experience with parity to web.

Deliverables:
- Define a **parity checklist**: auth, listings browse/search, listing detail, messaging, Q&A, reports, profile.
- Push notifications (after Phase 3 + Phase 6): FCM/APNS.
- Offline-friendly browsing cache (recent listings, favorites).

Acceptance criteria:
- Android MVP matches the core web flows.

Dependencies:
- Stable API contracts + versioning policy.

---

### Phase 8 — Monetization (feature-flagged, optional)
Goal: introduce monetization without harming trust.

Deliverables:
- Featured listings (time-boxed boosts)
- Subscriptions for sellers (limits + perks)
- Payments integration plan + compliance review

Acceptance criteria:
- Monetization is fully optional and disabled by default.

Dependencies:
- Trust & safety maturity (Phase 2).

---

## Cross-cutting improvements (do continuously)
Security:
- Strong password policy, account lockout for repeated failures
- Audit admin actions and staff access
- Secure uploads (content-type sniffing, size limits, virus scanning if feasible)

Performance:
- Tight pagination defaults + max limits
- Cache hot endpoints where safe
- Image optimization + lazy loading

Quality:
- Add integration tests for the API (critical flows)
- Add Playwright e2e smoke tests for web

---

## Execution notes (how to run this plan)
- Work in **2-week slices**: pick 1–2 deliverables and ship end-to-end.
- For each feature:
  - Define API contract (request/response + permissions)
  - Implement backend with tests
  - Implement web UI + empty/error/loading states
  - Add at least 1 e2e smoke path
- Keep a short “definition of done”:
  - Tests pass, builds pass, basic telemetry/logging, documentation updated

---

## Suggested next 3 picks (high ROI)
1) Phase 0 rate limiting + structured logs (reduces spam + improves debugging).
2) Phase 2 reports workflow completion + moderation bulk actions (trust).
3) Phase 1 search improvements (conversion).
