import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { db, runMigrations } from './client'
import { ClassifiedReview } from '../types'

const CACHE_FILE = path.join(process.cwd(), 'data/classification-cache.json')

let memoryCache: Record<string, ClassifiedReview> | null = null

function ensureCacheDirectory() {
  const dir = path.dirname(CACHE_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Computes sha256(normalizedText + '::' + source) for cache keying (ADR-009).
 */
export function computeContentHash(text: string, source: string): string {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const rawKey = `${normalized}::${source.toLowerCase().trim()}`
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

/**
 * Computes sha256 hash of lib/taxonomy.ts for taxonomy version tracking.
 */
export function getTaxonomyHash(): string {
  try {
    const taxonomyPath = path.join(process.cwd(), 'lib/taxonomy.ts')
    if (fs.existsSync(taxonomyPath)) {
      const content = fs.readFileSync(taxonomyPath, 'utf-8')
      return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12)
    }
  } catch (err) {
    console.error('[CACHE] Error computing taxonomy hash:', err)
  }
  return 'unknown'
}

function loadCacheFromFile(): Record<string, ClassifiedReview> {
  if (memoryCache !== null) {
    return memoryCache
  }

  ensureCacheDirectory()

  if (!fs.existsSync(CACHE_FILE)) {
    memoryCache = {}
    return memoryCache
  }

  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8')
    memoryCache = JSON.parse(raw)
  } catch (err) {
    console.error('[CACHE] Failed to read classification cache file:', err)
    memoryCache = {}
  }

  return memoryCache || {}
}

function saveCacheToFile() {
  if (memoryCache === null) return
  ensureCacheDirectory()
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2), 'utf-8')
  } catch (err) {
    console.error('[CACHE] Failed to save classification cache file:', err)
  }
}

export function getCache(hash: string): ClassifiedReview | null {
  const fileCache = loadCacheFromFile()
  return fileCache[hash] || null
}

export async function getCacheBatch(hashes: string[]): Promise<{ hits: Record<string, ClassifiedReview>; misses: string[] }> {
  const hits: Record<string, ClassifiedReview> = {}
  const misses: string[] = []

  if (hashes.length === 0) {
    return { hits, misses }
  }

  const fileCache = loadCacheFromFile()

  // First check memory/file cache
  const missingFromMemory: string[] = []
  for (const hash of hashes) {
    if (fileCache[hash]) {
      hits[hash] = fileCache[hash]
    } else {
      missingFromMemory.push(hash)
    }
  }

  if (missingFromMemory.length === 0) {
    return { hits, misses }
  }

  // Check DB for any missing items
  try {
    await runMigrations()
    for (const hash of missingFromMemory) {
      const res = await db.execute({
        sql: `SELECT review_json FROM classification_cache WHERE hash = ?`,
        args: [hash],
      })

      if (res.rows.length > 0 && res.rows[0].review_json) {
        const review = JSON.parse(String(res.rows[0].review_json)) as ClassifiedReview
        hits[hash] = review
        fileCache[hash] = review // update memory/file cache
      } else {
        misses.push(hash)
      }
    }
    saveCacheToFile()
  } catch (err) {
    console.error('[CACHE] DB query failed, falling back to misses:', err)
    missingFromMemory.forEach((h) => misses.push(h))
  }

  return { hits, misses }
}

export function setCache(hash: string, data: ClassifiedReview): void {
  const fileCache = loadCacheFromFile()
  fileCache[hash] = data
  saveCacheToFile()
}

export async function writeThroughCache(items: Record<string, ClassifiedReview>): Promise<void> {
  const fileCache = loadCacheFromFile()
  const now = new Date().toISOString()
  const statements: Array<{ sql: string; args: unknown[] }> = []

  for (const [hash, review] of Object.entries(items)) {
    fileCache[hash] = review
    statements.push({
      sql: `INSERT OR REPLACE INTO classification_cache (hash, review_json, created_at) VALUES (?, ?, ?)`,
      args: [hash, JSON.stringify(review), now],
    })
  }

  saveCacheToFile()

  if (statements.length > 0) {
    try {
      await runMigrations()
      await db.batch(statements as any)
    } catch (err) {
      console.error('[CACHE] Failed to write-through to DB:', err)
    }
  }
}

export async function clearCache(): Promise<void> {
  memoryCache = {}
  saveCacheToFile()

  try {
    await runMigrations()
    await db.execute({
      sql: `DELETE FROM classification_cache`,
      args: [],
    })
  } catch (err) {
    console.error('[CACHE] Failed to clear DB classification cache:', err)
  }
}
