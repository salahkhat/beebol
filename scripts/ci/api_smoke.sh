#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"

# Minimal helper to extract JSON using Python (avoids jq dependency)
json_get() {
  local expr="$1"
  python - <<PY
import json,sys
obj=json.load(sys.stdin)
print($expr)
PY
}

wait_for() {
  local url="$1"
  local attempts="${2:-40}"
  local sleep_s="${3:-0.5}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_s"
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

echo "== wait for server =="
wait_for "$BASE_URL/api/v1/health/"

echo "== health endpoints =="
H1=$(curl -fsS "$BASE_URL/api/v1/health/")
echo "$H1" >&2
printf '%s' "$H1" | json_get "obj.get('status','')" >/dev/null

H2=$(curl -fsS "$BASE_URL/api/health/")
echo "$H2" >&2
printf '%s' "$H2" | json_get "obj.get('status','')" >/dev/null

echo "== seeded categories =="
CATS_JSON=$(curl -fsS "$BASE_URL/api/v1/categories/")
CATS_COUNT=$(printf '%s' "$CATS_JSON" | json_get "obj['count']")
if [[ "$CATS_COUNT" -lt 1 ]]; then
  echo "Expected at least 1 category, got $CATS_COUNT" >&2
  exit 1
fi
CAT_ID=$(printf '%s' "$CATS_JSON" | json_get "obj['results'][0]['id']")

echo "== seeded locations =="
GOVS_JSON=$(curl -fsS "$BASE_URL/api/v1/governorates/")
GOVS_COUNT=$(printf '%s' "$GOVS_JSON" | json_get "obj['count']")
if [[ "$GOVS_COUNT" -lt 1 ]]; then
  echo "Expected at least 1 governorate, got $GOVS_COUNT" >&2
  exit 1
fi
GOV_ID=$(printf '%s' "$GOVS_JSON" | json_get "obj['results'][0]['id']")

CITIES_JSON=$(curl -fsS "$BASE_URL/api/v1/cities/?governorate=$GOV_ID")
CITY_COUNT=$(printf '%s' "$CITIES_JSON" | json_get "obj['count']")
if [[ "$CITY_COUNT" -lt 1 ]]; then
  echo "Expected at least 1 city for governorate=$GOV_ID, got $CITY_COUNT" >&2
  exit 1
fi
CITY_ID=$(printf '%s' "$CITIES_JSON" | json_get "obj['results'][0]['id']")

NEI_JSON=$(curl -fsS "$BASE_URL/api/v1/neighborhoods/?city=$CITY_ID")
NEI_COUNT=$(printf '%s' "$NEI_JSON" | json_get "obj['count']")
NEI_ID="null"
if [[ "$NEI_COUNT" -ge 1 ]]; then
  NEI_ID=$(printf '%s' "$NEI_JSON" | json_get "obj['results'][0]['id']")
fi

echo "== register seller + get token =="
SELLER="ci_seller_$(date +%s)"
PASS="password123"
REG1=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/register/" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SELLER\",\"email\":\"$SELLER@example.com\",\"password\":\"$PASS\"}")
SELLER_ID=$(printf '%s' "$REG1" | json_get "obj['id']")

TOK1=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/token/" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SELLER\",\"password\":\"$PASS\"}")
ACCESS1=$(printf '%s' "$TOK1" | json_get "obj['access']")

ME1=$(curl -fsS "$BASE_URL/api/v1/me/" -H "Authorization: Bearer $ACCESS1")
ME_ID=$(printf '%s' "$ME1" | json_get "obj['id']")
if [[ "$ME_ID" != "$SELLER_ID" ]]; then
  echo "Expected /me id=$SELLER_ID, got $ME_ID" >&2
  exit 1
fi

echo "== create listing (published but pending moderation) =="
LISTING=$(curl -fsS -X POST "$BASE_URL/api/v1/listings/" \
  -H "Authorization: Bearer $ACCESS1" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"CI Listing\",\"description\":\"Smoke test\",\"price\":\"123.00\",\"currency\":\"SYP\",\"status\":\"published\",\"category\":$CAT_ID,\"governorate\":$GOV_ID,\"city\":$CITY_ID,\"neighborhood\":$NEI_ID}")
LISTING_ID=$(printf '%s' "$LISTING" | json_get "obj['id']")

OWNER_DETAIL=$(curl -fsS "$BASE_URL/api/v1/listings/$LISTING_ID/" -H "Authorization: Bearer $ACCESS1")
MOD_STATUS=$(printf '%s' "$OWNER_DETAIL" | json_get "obj['moderation_status']")
if [[ "$MOD_STATUS" != "pending" ]]; then
  echo "Expected moderation_status=pending, got $MOD_STATUS" >&2
  exit 1
fi

echo "== public cannot see pending listing =="
HTTP_CODE=$(curl -s -o /tmp/public_listing.json -w "%{http_code}" "$BASE_URL/api/v1/listings/$LISTING_ID/")
if [[ "$HTTP_CODE" != "404" ]]; then
  echo "Expected 404 for public listing detail, got $HTTP_CODE" >&2
  cat /tmp/public_listing.json >&2 || true
  exit 1
fi

PUB_LIST=$(curl -fsS "$BASE_URL/api/v1/listings/")
PUB_IDS=$(printf '%s' "$PUB_LIST" | python - <<PY
import json,sys
obj=json.load(sys.stdin)
ids=[str(r.get('id')) for r in obj.get('results',[])]
print(' '.join(ids))
PY
)
if echo " $PUB_IDS " | grep -q " $LISTING_ID "; then
  echo "Expected listing id=$LISTING_ID not to be public" >&2
  exit 1
fi

echo "== buyer cannot create thread on pending listing (expects 404) =="
BUYER="ci_buyer_$(date +%s)"
REG2=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/register/" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$BUYER\",\"email\":\"$BUYER@example.com\",\"password\":\"$PASS\"}")
TOK2=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/token/" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$BUYER\",\"password\":\"$PASS\"}")
ACCESS2=$(printf '%s' "$TOK2" | json_get "obj['access']")

THREAD_CODE=$(curl -s -o /tmp/thread.json -w "%{http_code}" -X POST "$BASE_URL/api/v1/threads/" \
  -H "Authorization: Bearer $ACCESS2" \
  -H "Content-Type: application/json" \
  -d "{\"listing_id\":$LISTING_ID}")
if [[ "$THREAD_CODE" != "404" ]]; then
  echo "Expected 404 when creating thread for pending listing, got $THREAD_CODE" >&2
  cat /tmp/thread.json >&2 || true
  exit 1
fi

echo "OK: API smoke tests passed"
