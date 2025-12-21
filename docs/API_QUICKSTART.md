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

## Listings

### Create a listing (seller)

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
