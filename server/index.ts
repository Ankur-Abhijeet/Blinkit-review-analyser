import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { registerRoutes } from './routes'

class CorsError extends Error {}

const app = express()

// Corpora of tens of thousands of reviews are POSTed in a single body.
app.use(express.json({ limit: '50mb' }))

/**
 * The browser calls this API cross-origin from the Vercel deployment, so the
 * frontend origins must be allowed explicitly. CORS_ORIGINS is a comma-separated
 * list; Vercel preview deployments are matched by suffix so every preview URL
 * does not need to be enumerated.
 */
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true
  return allowedOrigins.some((allowed) => {
    if (!allowed.startsWith('*.')) return false
    return origin.endsWith(allowed.slice(1))
  })
}

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, health checks) send no Origin.
      if (!origin) return callback(null, true)
      if (isAllowedOrigin(origin)) return callback(null, true)
      callback(new CorsError(`Origin ${origin} is not permitted by CORS_ORIGINS`))
    },
  })
)

// Render polls this to decide whether the instance is live.
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

registerRoutes(app)

// A blocked origin is a configuration problem, not a server fault — report it as
// 403 with the cause, rather than letting it surface as an opaque 500.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CorsError) {
    console.warn(`[CORS] ${err.message}`)
    return res.status(403).json({ error: err.message })
  }
  next(err)
})

const port = Number(process.env.PORT) || 3001
const server = app.listen(port, () => {
  console.log(`[SERVER] ReviewLens API listening on port ${port}`)
  console.log(`[SERVER] Allowed origins: ${allowedOrigins.join(', ')}`)
})

// Scrape-and-classify requests legitimately run for many minutes. Node's 2-minute
// default would sever them mid-run, so disable the timeouts and let the work finish.
server.requestTimeout = 0
server.headersTimeout = 0
server.setTimeout(0)
