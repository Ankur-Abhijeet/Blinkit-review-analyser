import { createClient, Client } from '@libsql/client'
import fs from 'fs'
import path from 'path'

const url = process.env.TURSO_DATABASE_URL || ('file:' + path.join(process.cwd(), 'local.db'))
const authToken = process.env.TURSO_AUTH_TOKEN

export const db: Client = createClient({
  url,
  authToken,
})

let migrated = false

export async function runMigrations() {
  if (migrated) return
  
  // For in-memory or local file SQLite, read schema.sql and execute
  const schemaPath = path.join(process.cwd(), 'lib/db/schema.sql')
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`)
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  
  // Strip SQL comments: both -- and /* ... */ blocks
  const cleanSchema = schema
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  // Split statements by semicolon
  const statements = cleanSchema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  try {
    for (const statement of statements) {
      console.log('[DB] Executing migration statement:', statement)
      await db.execute(statement)
    }
    migrated = true
    console.log('[DB] Migrations completed successfully.')
  } catch (err) {
    console.error('[DB] Migrations failed:', err)
    throw err
  }
}
