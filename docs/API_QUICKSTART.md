# API Quickstart (v1)

Base path: `/api/v1/`

## Health

```bash
curl -s http://127.0.0.1:8000/api/v1/health/
```

## Register

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo1","email":"demo1@example.com","password":"password123"}'
```

## Token (JWT)

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo1","password":"password123"}'
```

Set an env var (PowerShell):

```powershell
$env:ACCESS_TOKEN = (curl -s -X POST http://127.0.0.1:8000/api/v1/auth/token/ -H "Content-Type: application/json" -d '{"username":"demo1","password":"password123"}' | ConvertFrom-Json).access
```

## Me

```bash
curl -s http://127.0.0.1:8000/api/v1/me/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Locations

```bash
curl -s http://127.0.0.1:8000/api/v1/governorates/
curl -s "http://127.0.0.1:8000/api/v1/cities/?governorate=1"
curl -s "http://127.0.0.1:8000/api/v1/neighborhoods/?city=1"
```

## Categories

Categories are seeded by migration. Fetch one to use its `id` when creating listings.

```bash
curl -s http://127.0.0.1:8000/api/v1/categories/
```

## Listings

### Create a listing (seller)

First, pick IDs from:
- `GET /api/v1/categories/`
- `GET /api/v1/governorates/` → `GET /api/v1/cities/?governorate=<id>`

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/listings/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"iPhone 12",
    "description":"Used, good condition",
    "price":"2500000.00",
    "currency":"SYP",
    "status":"draft",
    "category": 1,
    "governorate": 1,
    "city": 1,
    "neighborhood": null
  }'
```

### Browse listings

Public visibility is **published + approved + not removed**.

```bash
curl -s "http://127.0.0.1:8000/api/v1/listings/?city=1"
curl -s "http://127.0.0.1:8000/api/v1/listings/?category=1"
```

### Search listings

If `search` is provided and `ordering` is not set, the API applies a simple relevance ranking.

```bash
curl -s "http://127.0.0.1:8000/api/v1/listings/?search=iphone"
curl -s "http://127.0.0.1:8000/api/v1/listings/?search=iphone%2012"
```

### Facets (grouped counts)

```bash
curl -s "http://127.0.0.1:8000/api/v1/listings/facets/?search=iphone"
```

### Trending

```bash
curl -s "http://127.0.0.1:8000/api/v1/listings/trending/?city=1"
```

### New in city

```bash
curl -s "http://127.0.0.1:8000/api/v1/listings/new-in-city/?city=1"
```

### Similar listings

```bash
curl -s "http://127.0.0.1:8000/api/v1/listings/1/similar/"
```

Authenticated sellers see public listings plus their own drafts.

## Listing Q&A (public questions)

```bash
# list questions
curl -s http://127.0.0.1:8000/api/v1/listings/1/questions/

# ask a question (requires auth)
curl -s -X POST http://127.0.0.1:8000/api/v1/listings/1/questions/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"هل السعر قابل للتفاوض؟"}'
```

## Private messaging

```bash
# create/get a thread for a listing (requires auth)
curl -s -X POST http://127.0.0.1:8000/api/v1/threads/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"listing_id": 1}'

# list my threads
curl -s http://127.0.0.1:8000/api/v1/threads/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# list messages
curl -s http://127.0.0.1:8000/api/v1/threads/1/messages/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# send message
curl -s -X POST http://127.0.0.1:8000/api/v1/threads/1/messages/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"مرحبا، هل ما زال الإعلان متاح؟"}'
```

## Notifications

```bash
# list my notifications (requires auth)
curl -s http://127.0.0.1:8000/api/v1/notifications/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# mark a notification as read
curl -s -X POST http://127.0.0.1:8000/api/v1/notifications/1/read/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# view/update my notification preferences
curl -s http://127.0.0.1:8000/api/v1/me/notification-preferences/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"

curl -s -X PATCH http://127.0.0.1:8000/api/v1/me/notification-preferences/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email_private_message": true}'
```

## Blocking users

```bash
# block a user
curl -s -X POST http://127.0.0.1:8000/api/v1/blocks/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blocked_user_id": 2}'

# list my blocks
curl -s http://127.0.0.1:8000/api/v1/blocks/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Listing reports

```bash
# create a listing report
curl -s -X POST http://127.0.0.1:8000/api/v1/reports/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"listing": 1, "reason": "spam", "message": "Looks suspicious"}'

# list my reports
curl -s http://127.0.0.1:8000/api/v1/reports/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# get report events (reporter or staff)
curl -s http://127.0.0.1:8000/api/v1/reports/1/events/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## User reports

```bash
# report a user (optionally include listing and/or thread context)
curl -s -X POST http://127.0.0.1:8000/api/v1/user-reports/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reported": 2, "reason": "spam", "message": "Spammy behavior"}'

# convenience: report seller from a listing
curl -s -X POST http://127.0.0.1:8000/api/v1/listings/1/report-seller/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "spam", "message": "Spammy seller"}'

# convenience: report the other participant from a thread
curl -s -X POST http://127.0.0.1:8000/api/v1/threads/1/report/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "harassment", "message": "Abusive messages"}'
```

## Staff moderation (requires a staff token)

```bash
# moderation queue (default: pending)
curl -s "http://127.0.0.1:8000/api/v1/listings/moderation_queue/" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# other queues: flagged / rejected / removed / all
curl -s "http://127.0.0.1:8000/api/v1/listings/moderation_queue/?queue=flagged" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# bulk moderation actions
curl -s -X POST http://127.0.0.1:8000/api/v1/listings/bulk_moderate/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": [1,2,3], "action": "approve"}'

# admin preview for a listing (works even if removed)
curl -s http://127.0.0.1:8000/api/v1/listings/1/admin_preview/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# shadow-ban toggle (staff-only)
curl -s -X PATCH http://127.0.0.1:8000/api/v1/admin/users/2/shadow-ban/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shadow_banned": true}'

# list shadow-banned users (staff-only)
curl -s http://127.0.0.1:8000/api/v1/admin/users/shadow-banned/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
