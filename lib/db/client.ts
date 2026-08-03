import { createClient, Client } from '@libsql/client'
import path from 'path'
import { SCHEMA_STATEMENTS } from './schema'

/**
 * On Vercel the filesystem is read-only, so a `file:` SQLite database cannot be
 * used. Turso (TURSO_DATABASE_URL) is required in that environment; locally we
 * fall back to ./local.db so `npm run dev` works with no configuration.
 */
export const isServerless = Boolean(process.env.VERCEL)

function resolveUrl(): string {
  const remote = process.env.TURSO_DATABASE_URL
  if (remote) return remote

  if (isServerless) {
    throw new Error(
      'TURSO_DATABASE_URL is not set. A remote libSQL/Turso database is required ' +
        'when running on Vercel — the serverless filesystem is read-only, so the ' +
        'local.db fallback cannot be used. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN ' +
        'in the project environment variables.'
    )
  }

  return 'file:' + path.join(process.cwd(), 'local.db')
}

let client: Client | null = null

/** Lazily constructed so a missing Turso URL fails per-request, not at import. */
export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: resolveUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return client
}

/**
 * Proxy kept for backwards compatibility with `import { db } from './client'`.
 * Defers client construction to first property access.
 */
export const db: Client = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb() as object, prop, receiver)
    return typeof value === 'function' ? value.bind(getDb()) : value
  },
})

let migrated = false

export async function runMigrations() {
  if (migrated) return

  try {
    for (const statement of SCHEMA_STATEMENTS) {
      await getDb().execute(statement)
    }
    migrated = true
    console.log('[DB] Migrations completed successfully.')
  } catch (err) {
    console.error('[DB] Migrations failed:', err)
    throw err
  }
}
