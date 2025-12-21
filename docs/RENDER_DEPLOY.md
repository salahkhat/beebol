# Deploy to Render

This repo is set up to deploy on Render using the blueprint file [render.yaml](../render.yaml).

## One-time setup (Render UI)

1) Push this repo to GitHub.
2) In Render, choose **New +** → **Blueprint**.
3) Select the repo and approve the resources.

Render will create:
- A Postgres database (`beebol-db`)
- A Django web service (`beebol-backend`)
- A React static site (`beebol-web`)

## What to expect

- Backend URL: `https://beebol-backend.onrender.com`
- Web URL: `https://beebol-web.onrender.com`

The web build uses `API_BASE_URL` to call the backend. The backend uses `WEB_ORIGIN` for CORS/CSRF.

After deploy, use the API smoke tests in [API_QUICKSTART.md](API_QUICKSTART.md).

## Environment variables

The blueprint provisions these automatically:
- Backend: `SECRET_KEY`, `DATABASE_URL`, `DEBUG=False`, `WEB_ORIGIN`
- Web: `API_BASE_URL`

If you rename services, update the two URL values in [render.yaml](../render.yaml).

## Local production-ish test

Backend (PowerShell):
- `cd backend`
- `py -3.11 -m venv .venv`
- `.\.venv\Scripts\pip install -r requirements-prod.txt`
- `.\.venv\Scripts\python manage.py migrate`
- `.\.venv\Scripts\python manage.py collectstatic --noinput`
- `.\.venv\Scripts\python -m gunicorn beebol_backend.wsgi:application --bind 127.0.0.1:8000`

Web:
- `cd web`
- `npm ci`
- `$env:API_BASE_URL='http://127.0.0.1:8000' ; npm run build`

(For local dev, keep using `npm run dev` at the repo root.)
