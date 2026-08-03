# ReviewLens

Fetches Blinkit-related reviews from multiple public sources, curates and classifies
them with an LLM, and turns the result into an evidence-backed product report.

## Architecture

Two deployable services out of one repo:

| Service | Code | Host | Role |
| --- | --- | --- | --- |
| API | `server/` + `lib/` | Render (free web service) | Scraping, curation, classification, persistence |
| Frontend | `app/` + `components/` | Vercel (Hobby) | UI; calls the API cross-origin |

The split exists because scraping and classifying a large corpus runs for many
minutes — well past the 60s ceiling on Vercel's functions. Render's web services
have no such cap.

The frontend addresses the API absolutely via `NEXT_PUBLIC_API_BASE_URL`
(see [lib/api.ts](lib/api.ts)). Left unset, `apiFetch` emits relative paths and
`next.config.ts` proxies `/api/*` to `localhost:3001`, so local development needs
no CORS setup.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev:all
```

`dev:all` runs the API on :3001 and the frontend on :3000. Open
[http://localhost:3000](http://localhost:3000).

With no configuration the API uses a local `./local.db` SQLite file. Set
`LLM_API_KEY` (Groq) for live classification; without it the classify and curate
endpoints return a 400.

| Command | Purpose |
| --- | --- |
| `npm run dev:all` | Both services |
| `npm run dev` | Frontend only (:3000) |
| `npm run dev:server` | API only (:3001), with watch |
| `npm run build` | Production build of the frontend |
| `npm run start:server` | Run the API as Render does |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |

## Deploying — all free tier

### 1. Database — Turso

Both hosts have a filesystem that cannot hold a database: Render's free instances
are wiped on deploy and spin-down, and Vercel's is read-only. Create a free
database at [turso.tech](https://turso.tech) and keep its URL and auth token.
Schema migrations run automatically on the first request that hits the database.

### 2. API — Render

Create a **Web Service** from this repo. [render.yaml](render.yaml) declares the
settings, or set them manually:

- Build command: `npm install`
- Start command: `npm run start:server`
- Health check path: `/healthz`
- Instance type: Free

Environment variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | `libsql://…` — the API refuses to start a request without it in production |
| `TURSO_AUTH_TOKEN` | yes | Token for the above |
| `CORS_ORIGINS` | yes | Your Vercel domain, e.g. `https://reviewlens.vercel.app,*.vercel.app` |
| `LLM_API_KEY` | for live runs | Groq key; `GROQ_API_KEY` also works |
| `LLM_PROVIDER` / `LLM_MODEL` | no | Default to `groq` / `llama-3.3-70b-versatile` |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | no | Improves Reddit collector yield |

Note the service URL Render assigns — the frontend needs it.

### 3. Frontend — Vercel

Import the same repo at [vercel.com/new](https://vercel.com/new). Framework and
build settings are auto-detected; the only variable to set is:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | The Render service URL, e.g. `https://reviewlens-api.onrender.com` |

It is inlined at build time, so changing it needs a redeploy. Once Vercel assigns
the production domain, add it to `CORS_ORIGINS` on Render.

### Free-tier limits worth knowing

- **Cold starts.** Render spins a free instance down after ~15 minutes idle;
  the next request takes roughly 50 seconds to wake it. The first page load after
  a quiet period will feel broken but is not — `/healthz` is the cheapest way to
  warm it.
- **Free instance hours.** Render's free tier allots a fixed number of instance
  hours per month across all free services in the account.
- **Groq quota.** Defaults assume the free tier (100k tokens/day, 14.4k
  requests/day); the pre-flight panel tracks consumption against those numbers.
- **Turso free tier** is generous but finite — 500 databases, 9 GB total.

### Serverless notes

- The classification cache (`data/classification-cache.json`) is a local-dev
  convenience. In production it lives in memory for the life of the process, with
  the `classification_cache` table in Turso as the durable layer — so a cold start
  costs cache hits, not data.
- `data/seed-corpus.csv` is read at runtime by the collectors and ships with the
  Render service.
- `SCRAPER_DELAY_MIN` / `SCRAPER_DELAY_MAX` govern politeness delays between
  scraper requests.

Further docs live in [`docs/`](docs/) — see `docs/RUNBOOK.md` and
`docs/architecture.md`.
