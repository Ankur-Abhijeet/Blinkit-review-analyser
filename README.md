# ReviewLens

Fetches Blinkit-related reviews from multiple public sources, curates and classifies
them with an LLM, and turns the result into an evidence-backed product report.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With no configuration the app runs against a local `./local.db` SQLite file and,
with `MOCK_LLM=true`, a heuristic classifier that consumes no LLM quota. Set
`LLM_API_KEY` (Groq) for live classification.

## Deploy on Vercel

The app is deployable as-is — Vercel auto-detects Next.js, so no build settings
need changing. Two things must be set up first, because Vercel's filesystem is
read-only and its functions are time-limited.

### 1. Provision a Turso database

The `./local.db` fallback cannot work in a serverless environment, so a remote
libSQL database is required. Create one at [turso.tech](https://turso.tech), then
grab its URL and an auth token. Schema migrations run automatically on the first
request that touches the database.

### 2. Set environment variables

In the Vercel project, under Settings → Environment Variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | `libsql://…` — deploys fail at request time without it |
| `TURSO_AUTH_TOKEN` | yes | Token for the above |
| `LLM_API_KEY` | for live runs | Groq API key; `GROQ_API_KEY` also works |
| `LLM_PROVIDER` | no | Defaults to `groq` |
| `LLM_MODEL` | no | Defaults to `llama-3.3-70b-versatile` |
| `MOCK_LLM` | no | Set `true` to deploy a demo build with no LLM spend |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | no | Improves Reddit collector yield |

See `.env.example` for the full list including throughput tuning.

### 3. Deploy

```bash
npx vercel --prod
```

Or import the GitHub repo at [vercel.com/new](https://vercel.com/new) and let it
deploy on push to `main`.

### Serverless notes

- **Function timeout.** API routes declare `maxDuration = 60`, the Vercel Hobby
  ceiling. Large fetch-and-classify runs can exceed that; the UI already splits
  large corpora into parts, so classify in batches. On Pro, raise `maxDuration`
  in `app/api/*/route.ts` up to 300.
- **Classification cache.** `data/classification-cache.json` is a local-dev
  convenience. In production the cache is in-memory per warm instance, with the
  `classification_cache` table in Turso as the durable layer — no behavior change,
  just a cold-start miss.
- **Seed corpus.** `data/seed-corpus.csv` is read at runtime and is explicitly
  bundled via `outputFileTracingIncludes` in `next.config.ts`.
- **Scraping politeness.** `SCRAPER_DELAY_MIN` / `SCRAPER_DELAY_MAX` still apply,
  and count against the function timeout.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run analyze` | Offline analysis pipeline |

Further docs live in [`docs/`](docs/) — see `docs/RUNBOOK.md` and
`docs/architecture.md`.
