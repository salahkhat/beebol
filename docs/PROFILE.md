# User Profiles — Design & Implementation Plan ✅

## Overview
This document defines the design, API, data model, and rollout plan for a comprehensive User Profile feature.
Goals:
- Provide a public profile page with contact & seller info
- Provide a secure Edit Profile experience for owners
- Support avatars/covers, privacy settings, ratings/reviews, and profile-related metrics
- Ship with tests, docs, migrations, and staged rollout

---

## 1) Data model (profile)
Fields (recommended):
- id (UUID/int)
- user_id (FK to users) — unique
- display_name (string, 1-80)
- bio (text, optional)
- avatar_url (string, optional)
- cover_url (string, optional)
- location: { country_code, governorate_id, city_id, neighborhood_id } (nullable)
- contact: { phone (masked), phone_public (bool), email_public (bool) } — store only verified contact references; never expose raw PII in public views
- social_links: array of { type: 'twitter'|'facebook'|'instagram'|'website', url } — editable by the user via the Edit Profile page; visible on public profiles only when `privacy_settings.show_contact` is true.
- seller_rating: decimal (computed), listings_count (int), followers_count (int)
- joined_at (timestamp), last_seen (timestamp)
- verification_flags: { email_verified, phone_verified, id_verified }
- privacy_settings: { show_contact: bool, show_activity: bool, followers_visible: bool }
- notification_prefs: JSON
- metadata: JSON (free-form)
- created_at, updated_at

Indexes:
- unique(user_id)
- index on display_name (for quick lookups)
- index on joined_at, listings_count (for sorting)

Acceptance criteria:
- Model validated server-side; display_name/lengths enforced; images limited to configured sizes.

---

## 2) API contract
Authentication: token/session-based. Public vs private responses.

Endpoints (minimal):
- GET /api/users/:id/profile — public view (obeys privacy settings)
- GET /api/users/me/profile — full view for owner
- PATCH /api/users/me/profile — edit profile (partial updates)
- POST /api/users/me/avatar — multipart upload (returns avatar_url)
- POST /api/users/me/cover — multipart upload (returns cover_url)
- GET /api/users/:id/listings — listings by user (paginated)
- GET /api/users/:id/reviews — seller reviews (paginated)

Example: GET /api/users/123/profile
```json
{
  "id": 123,
  "display_name": "Sara",
  "bio": "Seller of vintage cameras",
  "avatar_url": "https://cdn.example.com/avatars/123.jpg",
  "location": {"country_code":"SY","governorate_id":1, "city_id":5},
  "seller_rating": 4.8,
  "listings_count": 24,
  "followers_count": 120,
  "joined_at": "2023-04-01T12:00:00Z"
}
```

Example: PATCH /api/users/me/profile
Request body (application/json):
```json
{
  "display_name": "New Name",
  "bio": "Updated bio",
  "privacy_settings": { "show_contact": false }
}
```

Validation & security rules:
- Only profile owner can PATCH their profile.
- Avatar uploads: max size 5MB, allowed formats jpeg/png/webp; server resizes and rejects strange EXIF or suspicious files. The API creates a medium (max 400x400) and thumbnail (max 128x128) variant and exposes `avatar_medium` and `avatar_thumbnail` in the profile payload. The response also includes a simple cache hint `avatar_cache_control` (e.g. `max-age=86400`).
- Public GET must respect privacy flags (e.g., hide contact info unless show_contact true)
- Rate-limit profile edits and uploads.

OpenAPI snippet (example):
```yaml
paths:
  /api/users/{id}/profile:
    get:
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer }
      responses:
        '200':
          description: Public profile view
```

---

## 3) Backend implementation notes
- Add Profile model (one-to-one with User) + migrations.
- Provide serializers (with public view serializer that omits private fields when needed).
- Provide avatar upload endpoint that returns CDN URL and stores sizes (thumb/medium/large).
- Compute and persist listings_count and seller_rating via async job or DB triggers (keep eventual consistency).
- Add unit tests (model, serializer, permission tests) and integration tests for upload endpoints.

---

## 4) Frontend UI & components (priority list)
- Profile page (public): header (avatar, name, stats), badges, about, contact CTA, listings grid, reviews, activity feed
- Edit Profile: WYSIWYG bio editor, avatar & cover upload with preview, social links editor, privacy and notification toggles
- Reusable components: ProfileHeader, ProfileStats, ProfileCard (compact), ProfileListingsGrid, ProfileReviews
- Accessibility: keyboard nav, proper ARIA roles, color contrast, RTL support
- Mobile-first responsive layout and Playwright visual tests

---

## 5) Privacy & compliance
- Do not reveal PII unless user opted-in; mask phone/email in public views unless allowed
- Allow account owners to download their profile data (GDPR) — provide an export endpoint
- Document retention & deletion policies

---

## 6) Testing, QA & rollout
- Unit tests + integration tests for APIs.
- Playwright e2e: view public profile, edit profile, upload avatar, confirm privacy toggles.
- Feature-flag rollout (beta -> 10% -> 100%) with monitoring and rollback plan.

---

## 7) Migration & backfill
- Migration: add profile table and backfill display_name from users table
- Backfill tasks: count listings per user, followers_count
- Run migration in staging and verify with sample data

---

## 8) Acceptance criteria
- End-to-end tests pass
- Profile pages render correctly (mobile & desktop)
- Avatar uploads work and served via CDN
- Privacy flags respected in public views
- Metrics & monitoring active

---

## Next steps (short)
1. Draft DB schema + migration SQL and OpenAPI snippets (I'll do this next). 
2. Implement API endpoints and serializer tests.
3. Add frontend pages and Playwright tests.

---

If you'd like, I can open a branch and implement the DB model + endpoints now — say "Proceed with backend" and I'll start task #2 and mark it in-progress in the TODOs.