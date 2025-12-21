# Beebol Marketplace — Milestones Plan (Syria-first)

Date: 2025-12-21

## Scope Decisions (Confirmed)
- Launch geography: **Syria only** (at first).
- Monetization: **free at first** (design for future featured/subscriptions/ads, but keep disabled).
- Messaging (v1): **listing-scoped only**
  - **Public Q&A**: questions visible on listing, seller can answer, moderated.
  - **Private messages**: 1:1 buyer↔seller thread tied to the listing.

## Target Architecture
- **backend/**: Django + Django REST Framework (API-first)
- **web/**: React + Webpack (RTL + i18n from day 1)
- **mobile/**: Flutter (after web v1 stabilizes)
- Infra targets:
  - Postgres + **PostGIS** (map + nearby)
  - Redis (cache + Celery broker)
  - Celery (background tasks: media processing, notifications, indexing)
  - S3-compatible media storage (local: MinIO; prod: S3)

## Monorepo Folder Structure
```
beebol-marketplace/
  backend/        # Django project + apps + DRF API
  web/            # React app bundled with Webpack
  mobile/         # Flutter app
  docs/           # Product/tech docs
```

## Milestone 0 — Project Baseline & Developer Experience
**Goal:** A repeatable local/dev/staging workflow so the team can ship quickly.

**Deliverables**
- Define Django project layout in `backend/` (project + apps separated).
- Local dev via Docker Compose for Postgres+PostGIS + Redis (+ optional MinIO).
- Environment configuration: `.env` templates, settings split (dev/stage/prod).
- CI baseline: lint + tests for backend and web.

**Acceptance Criteria**
- A new developer can run: DB + backend + web locally in <30 minutes.
- One command starts required services; one command runs tests.

---

## Milestone A — MVP Web (Syria-first, no chat yet)
**Goal:** A usable classifieds product with Arabic/RTL + location + search.

### A1 — Core domain + admin operations
**Deliverables**
- Listings lifecycle: create/edit/publish/unpublish/archive.
- Category tree + **dynamic attributes** (category-specific fields).
- Media: multi-image upload, thumbnails, storage backend.
- Admin workflows: manage categories/attributes, review listings, ban users.

**Acceptance Criteria**
- Users can post listings with images and category attributes.
- Admin can approve/reject/disable listings and users.

### A2 — Syria location model
**Deliverables**
- Location hierarchy (at minimum): Syria → governorate → city → district (if data available).
- Seed data script(s) and admin editor.
- Address fields + optional geo point on listing.

**Acceptance Criteria**
- Every listing is linked to a Syria location.
- Users can filter by governorate/city.

### A3 — Search & discovery (MVP)
**Deliverables**
- Postgres full-text search across listing title/description.
- Filters: category, location, price range, attributes, date.
- Sorting: newest, price, relevance (basic).

**Acceptance Criteria**
- Search returns relevant results and supports filters without timeouts.

### A4 — Arabic + RTL + UX baseline (web)
**Deliverables**
- Arabic UI strings (i18n) + RTL layout.
- Locale formatting for dates/numbers.
- Arabic-friendly slugs/URLs (and safe fallback when missing).

**Acceptance Criteria**
- Full core user journey works in Arabic/RTL without layout breakage.

### A5 — Basic map browsing (MVP)
**Deliverables**
- Map view with markers for listings that have coordinates.
- Backend endpoints for bounding-box query.

**Acceptance Criteria**
- Map can load listings in the current viewport (bbox query) within acceptable latency.

---

## Milestone B — v1 Web (chat + map-first + trust)
**Goal:** Add listing-scoped messaging (public + private) and production trust features.

### B1 — Listing-scoped messaging model
**Deliverables**
- Public Q&A:
  - Ask question on listing; seller replies.
  - Moderation actions: hide/delete question/answer; report abuse.
- Private messages:
  - Start thread from listing; buyer↔seller only.
  - Read/unread state, blocking, reporting.

**Acceptance Criteria**
- A user can ask a public question and the seller can reply.
- A user can privately message the seller from the listing.
- Moderators can remove abusive content.

### B2 — Notifications (web)
**Deliverables**
- Email notifications (MVP): new private message, reply to Q&A, listing status changes.
- Background processing via Celery.

**Acceptance Criteria**
- Notifications are queued and delivered asynchronously.

### B3 — Map-first relevance + geo queries
**Deliverables**
- PostGIS-powered queries: bbox + radius + location relevance.
- Ranking heuristics: location match + recency + quality signals.

**Acceptance Criteria**
- Nearby search works and can be tuned without schema rewrites.

### B4 — Anti-spam and trust
**Deliverables**
- Rate limiting for posting and messaging.
- Abuse reporting workflows; basic audit logs.
- Optional phone verification design (feature-flagged; not required for v1).

**Acceptance Criteria**
- Basic spam abuse is throttled and reviewable.

---

## Milestone C — Mobile (Flutter)
**Goal:** Flutter app with parity to web v1 for Syria launch.

**Deliverables**
- Auth + browse/search + map + listing details.
- Post/edit listing + media upload.
- Public Q&A and private messaging threads.
- Push notifications (after backend notification foundation is stable).

**Acceptance Criteria**
- Core flows match web v1 behavior and pass QA smoke tests on Android.

---

## Cross-cutting Production Requirements (Apply from Milestone A onward)
- Security: secure headers, CORS policy, secrets via env, least-privilege permissions.
- Observability: structured logs + error tracking (Sentry) + health endpoints.
- Performance: pagination everywhere; image optimization; caching for hot endpoints.
- Data: backups, migrations, and admin auditability.

## Notes
- `django-classified` upstream is a great reference/domain starting point, but the production product should be **API-first** so React + Flutter stay aligned.
- Monetization is intentionally deferred; we’ll keep the code structured so it can be added without rewriting listings/search.
