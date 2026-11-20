# Run EVIDENT AI locally

The MVP supports an opt-in, single-user SQLite mode. It runs on localhost without Supabase or Redis. Real Gemini and Tavily keys are still required for claim extraction and research-backed verdicts. If they are missing, an investigation is saved as failed with a clear message; no verdict or citations are fabricated.

## 1. Prepare the backend

Use Python 3.11 or newer. Open a terminal at the repository root:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Edit `backend/.env`:

- Keep `LOCAL_DEV_MODE=true` and `APP_ENV=development`.
- Set `LOCAL_DEV_TOKEN` to a random value at least 32 characters long.
- Add `GEMINI_API_KEY` and `TAVILY_API_KEY` for real claim extraction, source retrieval, and assessment.
- Optionally set `GEMINI_FALLBACK_MODEL` to an alternate model available to the same API key. Before calling it, the backend checks Gemini model metadata for `generateContent` support. Transient Gemini 429, 500, and 503 responses are retried up to three attempts per model.
- Leave Supabase and Redis blank for the local SQLite MVP.

Start the API bound to loopback only:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1
```

API docs: `http://127.0.0.1:8000/docs`. Health check: `http://127.0.0.1:8000/health`.

## 2. Prepare the frontend

In another terminal at the repository root:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
npm install
```

Edit `frontend/.env.local` and set `NEXT_PUBLIC_LOCAL_DEV_TOKEN` to the **same value** as backend `LOCAL_DEV_TOKEN`. Keep `NEXT_PUBLIC_LOCAL_DEV_MODE=true`. Start the frontend:

```powershell
npm run dev
```

Open `http://127.0.0.1:3001`, choose **Open local workspace**, then submit text/URL or use the image lab. SQLite data and private image uploads are saved under `backend/data/` and are excluded from Git. Local image analysis reports decoded format, dimensions, a perceptual hash, and available safe EXIF indicators; it does not determine whether an image is authentic or manipulated. Reports can be downloaded as JSON or printed to PDF from the browser.

The local token is delivered to the local browser app and is only appropriate for localhost development. Keep the API bound to `127.0.0.1`; never enable local mode on a public host. Local mode is deliberately single-user and has no account registration or multi-user isolation. Set `LOCAL_DEV_MODE=false` when using Supabase Auth in a hosted setup.

## 3. Supabase hosted development (optional)

For multi-user development, set `LOCAL_DEV_MODE=false`, configure the Supabase variables in both environment files, apply `supabase/migrations/20261118000000_initial_schema.sql`, and configure Auth redirects/private storage. The existing Supabase path uses Redis/ARQ for long-running jobs:

```powershell
cd backend
arq app.workers.settings.WorkerSettings
```

See [`SUPABASE.md`](SUPABASE.md) and [`INTEGRATIONS.md`](INTEGRATIONS.md). Keep server-only credentials out of the frontend env file.

## Checks

From repository root:

```powershell
npm run lint
npm run build
```

Backend tests, when Python is installed and the backend environment is activated:

```powershell
cd backend
pytest
```

## Deployment

The local SQLite/token mode is not deployable for shared or public use. For a hosted MVP, use Vercel for `frontend/`, Render for the FastAPI API and a separate ARQ worker, managed Redis for the queue, and Supabase for PostgreSQL/Auth/private storage. Configure production environment secrets in each host’s secret manager, set `LOCAL_DEV_MODE=false`, use the production API URL in the frontend, configure Supabase redirect/CORS URLs, and apply/test the migration and RLS policies before accepting user uploads. Configure health checks and verify provider failure behavior before launch. No deployment has been performed.
