# Playwright E2E

## Prereqs
- Backend running on `http://127.0.0.1:8000`
- Web running on `http://localhost:3000`

## Install
- `npm install`
- `npx playwright install`

## Run
- `npm run e2e`

## Staff user (for moderation-gated flows)
Some E2E tests need a staff user to approve listings (so they become interactable for favorites/messages).

- Create/update the staff user: `python backend/manage.py ensure_e2e_staff --username e2e_staff --password e2e_staff_pass`
- Or override credentials via `E2E_STAFF_USERNAME` / `E2E_STAFF_PASSWORD`

## Environment overrides
- `API_BASE_URL` (default: `http://127.0.0.1:8000`)
- `BASE_URL` (default: `http://localhost:3000`)
- `E2E_STAFF_USERNAME` (default: `e2e_staff`)
- `E2E_STAFF_PASSWORD` (default: `e2e_staff_pass`)
