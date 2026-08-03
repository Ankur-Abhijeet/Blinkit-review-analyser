import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { query, transaction, runMigrations, isEmbedded } from './client'
import { ClassifiedReview } from '../types'
import * as taxonomy from '../taxonomy'

const CACHE_FILE = path.join(process.cwd(), 'data/classification-cache.json')

/**
 * The JSON cache file is a local-development convenience. In production the
 * filesystem is ephemeral or read-only, so the cache lives in memory for the
 * life of the process and the `classification_cache` table is the durable layer.
 */
let fileCacheWritable = isEmbedded

let memoryCache: Record<string, ClassifiedReview> | null = null

function ensureCacheDirectory(): boolean {
  if (!fileCacheWritable) return false
  try {
    const dir = path.dirname(CACHE_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return true
  } catch (err) {
    console.warn('[CACHE] Cache directory is not writable, using memory + DB only:', err)
    fileCacheWritable = false
    return false
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
    // Hash the exported label sets rather than the source file: the source tree
    // is not on disk in a serverless bundle, and the labels are what actually
    // invalidate cached classifications.
    const labels = Object.entries(taxonomy)
      .filter(([, value]) => Array.isArray(value) || typeof value === 'object')
      .sort(([a], [b]) => a.localeCompare(b))
    return crypto.createHash('sha256').update(JSON.stringify(labels)).digest('hex').slice(0, 12)
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

  if (!fileCacheWritable || !fs.existsSync(CACHE_FILE)) {
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
  if (!ensureCacheDirectory()) return
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[CACHE] Cache file is not writable, using memory + DB only:', err)
    fileCacheWritable = false
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
    // One round trip for the whole batch rather than a query per hash — over a
    // network-attached Postgres the per-hash version dominated classify latency.
    const res = await query(
      `SELECT hash, review_json FROM classification_cache WHERE hash = ANY($1)`,
      [missingFromMemory],
    )

    const found = new Map<string, ClassifiedReview>()
    for (const row of res.rows) {
      if (!row.review_json) continue
      found.set(String(row.hash), JSON.parse(String(row.review_json)) as ClassifiedReview)
    }

    for (const hash of missingFromMemory) {
      const review = found.get(hash)
      if (review) {
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
  const entries = Object.entries(items)

  for (const [hash, review] of entries) {
    fileCache[hash] = review
  }

  saveCacheToFile()

  if (entries.length > 0) {
    try {
      await runMigrations()
      await transaction(async (q) => {
        for (const [hash, review] of entries) {
          await q(
            `INSERT INTO classification_cache (hash, review_json, created_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (hash) DO UPDATE SET review_json = EXCLUDED.review_json, created_at = EXCLUDED.created_at`,
            [hash, JSON.stringify(review), now],
          )
        }
      })
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
    await query(`DELETE FROM classification_cache`)
  } catch (err) {
    console.error('[CACHE] Failed to clear DB classification cache:', err)
  }
}
