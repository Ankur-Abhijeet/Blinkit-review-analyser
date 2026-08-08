import path from 'path'
import { SCHEMA_STATEMENTS } from './schema'

/**
 * Persistence is PostgreSQL — Render Postgres in production.
 *
 * With no DATABASE_URL the driver falls back to PGlite, an embedded Postgres
 * that stores to a local directory. Same SQL dialect, no server to install, so
 * `npm run dev:all` and the test suite work with zero setup. Production always
 * uses the real thing.
 */
export type Row = Record<string, unknown>
export type QueryResult = { rows: Row[] }

const DATABASE_URL = process.env.DATABASE_URL || ''
export const isEmbedded = !DATABASE_URL

const isProduction = Boolean(process.env.RENDER || process.env.NODE_ENV === 'production')

if (isEmbedded && isProduction) {
  throw new Error(
    'DATABASE_URL is not set. A PostgreSQL database is required in production — the ' +
      'embedded PGlite fallback writes to the instance filesystem, which Render wipes ' +
      'on every deploy and spin-down. Attach a Render Postgres instance and set ' +
      'DATABASE_URL from its Internal Database URL.'
  )
}

/** Driver-agnostic handle so callers do not care which backend is live. */
type Driver = {
  query(sql: string, params: unknown[]): Promise<QueryResult>
  transaction(work: (q: Driver['query']) => Promise<void>): Promise<void>
}

let driverPromise: Promise<Driver> | null = null

/**
 * Render hands out two connection strings. The internal one has a bare hostname
 * (`dpg-xxxx-a`) that only resolves from inside the same Render region; the
 * external one is fully qualified (`dpg-xxxx-a.<region>-postgres.render.com`).
 * Using the internal host from a laptop, or from a service in another region,
 * fails as a DNS lookup — an error that says nothing about the real mistake.
 */
function explainConnectionError(err: unknown): unknown {
  const e = err as { code?: string; hostname?: string; message?: string }
  if (e?.code !== 'ENOTFOUND') return err

  const host = e.hostname || 'the database host'
  const looksInternal = /^dpg-[a-z0-9]+-a$/i.test(host)

  if (!looksInternal) {
    return new Error(
      `Cannot resolve database host "${host}". Check DATABASE_URL is correct and the database still exists.`
    )
  }

  return new Error(
    `Cannot resolve "${host}" — that is Render's INTERNAL database hostname, which only ` +
      `resolves from a Render service in the SAME region as the database. Either move the ` +
      `service and database into one region, or switch DATABASE_URL to the External Database ` +
      `URL (the long ".render.com" form) if you are connecting from outside Render.`
  )
}

async function createPgDriver(): Promise<Driver> {
  const { Pool } = await import('pg')

  const pool = new Pool({
    connectionString: DATABASE_URL,
    // Render Postgres terminates TLS with a certificate the default trust store
    // does not recognise. External connections still require SSL.
    ssl: DATABASE_URL.includes('localhost') ? undefined : { rejectUnauthorized: false },
    // Free instances allow few connections; keep the pool small.
    max: Number(process.env.PGPOOL_MAX) || 5,
    idleTimeoutMillis: 30_000,
  })

  pool.on('error', (err) => console.error('[DB] Idle client error:', err))

  return {
    async query(sql, params) {
      try {
        const res = await pool.query(sql, params as unknown[])
        return { rows: res.rows as Row[] }
      } catch (err) {
        throw explainConnectionError(err)
      }
    },
    async transaction(work) {
      let client
      try {
        client = await pool.connect()
      } catch (err) {
        throw explainConnectionError(err)
      }
      try {
        await client.query('BEGIN')
        await work(async (sql, params) => {
          const res = await client.query(sql, params as unknown[])
          return { rows: res.rows as Row[] }
        })
        await client.query('COMMIT')
      } catch (err) {
        // Rolling back a connection that already died would mask the real cause.
        await client.query('ROLLBACK').catch(() => {})
        throw explainConnectionError(err)
      } finally {
        client.release()
      }
    },
  }
}

async function createPgliteDriver(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite')
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), '.pglite')
  const pglite = new PGlite(dataDir)
  await pglite.waitReady
  console.log(`[DB] Using embedded PGlite at ${dataDir} (set DATABASE_URL to use PostgreSQL)`)

  const query = async (sql: string, params: unknown[]): Promise<QueryResult> => {
    const res = await pglite.query(sql, params as unknown[])
    return { rows: (res.rows || []) as Row[] }
  }

  return {
    query,
    async transaction(work) {
      await query('BEGIN', [])
      try {
        await work(query)
        await query('COMMIT', [])
      } catch (err) {
        await query('ROLLBACK', [])
        throw err
      }
    },
  }
}

function getDriver(): Promise<Driver> {
  if (!driverPromise) {
    driverPromise = isEmbedded ? createPgliteDriver() : createPgDriver()
  }
  return driverPromise
}

/** Runs a parameterised statement. Placeholders are Postgres-style ($1, $2, …). */
export async function query(sql: string, params: unknown[] = []): Promise<QueryResult> {
  const driver = await getDriver()
  return driver.query(sql, params)
}

/** Runs `work` inside a transaction, rolling back if it throws. */
export async function transaction(
  work: (q: (sql: string, params?: unknown[]) => Promise<QueryResult>) => Promise<void>
): Promise<void> {
  const driver = await getDriver()
  await driver.transaction((q) => work((sql, params = []) => q(sql, params)))
}

let migrated: Promise<void> | null = null

export async function runMigrations(): Promise<void> {
  // Memoise the promise, not a boolean: concurrent first requests would
  // otherwise each start their own migration run.
  if (!migrated) {
    migrated = (async () => {
      try {
        for (const statement of SCHEMA_STATEMENTS) {
          await query(statement)
        }
        console.log('[DB] Migrations completed successfully.')
      } catch (err) {
        migrated = null
        console.error('[DB] Migrations failed:', err)
        throw err
      }
    })()
  }
  return migrated
}
