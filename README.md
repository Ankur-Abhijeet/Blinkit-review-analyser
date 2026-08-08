# ReviewLens

Fetches Blinkit-related reviews from multiple public sources, curates and classifies
them with an LLM, and turns the result into an evidence-backed product report.

## Architecture

Two deployable services out of one repo:

| Service | Code | Host | Role |
| --- | --- | --- | --- |
| API | `server/` + `lib/` | Render (free web service) | Scraping, curation, classification |
| Database | — | Render Postgres (free) | Runs, reviews, classification cache |
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

With no configuration the API stores to an embedded PGlite database in
`./.pglite` — same Postgres dialect as production, no server to install. Set
`DATABASE_URL` to point at a real PostgreSQL instead. Set `LLM_API_KEY` (Groq)
for live classification; without it the classify and curate endpoints return
a 400.

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

### 1. Database — Render Postgres

Neither host has a filesystem that can hold a database: Render's free instances
are wiped on deploy and spin-down, and Vercel's is read-only. Create a
**PostgreSQL** instance on Render (free plan) in the same region as the API.
[render.yaml](render.yaml) declares it and wires `DATABASE_URL` into the service
automatically. Schema migrations run on the first request that hits the database.

> **Free Postgres expires.** Render deletes free PostgreSQL instances 30 days
> after creation. When that happens you create a new one and update
> `DATABASE_URL`; the schema rebuilds itself, but stored runs are gone. Upgrade
> the database to a paid tier if the history needs to survive.

**Put the database in the same region as the web service.** Render offers two
connection strings, and the Internal one — a bare `dpg-xxxx-a` hostname — only
resolves from a Render service in that same region. Cross-region, or from your
laptop, it fails as `getaddrinfo ENOTFOUND dpg-xxxx-a`. Use the External URL
(the long `.render.com` form) when connecting from outside Render.

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
| `DATABASE_URL` | yes | Wired automatically from the Render Postgres instance; the API refuses to serve requests without it in production |
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
- **Free Postgres is deleted after 30 days,** and is capped at 1 GB storage.

### Runtime notes

- The classification cache (`data/classification-cache.json`) is a local-dev
  convenience. In production it lives in memory for the life of the process, with
  the `classification_cache` table in Postgres as the durable layer — so a cold
  start costs cache hits, not data.
- `data/seed-corpus.csv` is read at runtime by the collectors and ships with the
  Render service.
- `SCRAPER_DELAY_MIN` / `SCRAPER_DELAY_MAX` govern politeness delays between
  scraper requests.

Further docs live in [`docs/`](docs/) — see `docs/RUNBOOK.md` and
`docs/architecture.md`.
