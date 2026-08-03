import { RawReview } from '../types'
import { Collector, FetchOptions, getRandomDelay } from './types'
import fs from 'fs'
import path from 'path'
import { parseReviews } from '../ingest/parse'

export class AppStoreCollector implements Collector {
  id = 'appstore'
  label = 'Apple App Store'
  supports = { region: false, sort: false, minRating: false }

  async *fetch(opts: FetchOptions, signal?: AbortSignal): AsyncIterable<RawReview> {
    const amount = opts.amount
    let count = 0
    const pageCeiling = 10 // iTunes RSS feed limit is 10 pages of 50 reviews each
    let lastFetchedLength = -1
    let fetchedAny = false

    for (let page = 1; page <= pageCeiling; page++) {
      if (signal?.aborted) break
      if (count >= amount) break

      const url = `https://itunes.apple.com/in/rss/customerreviews/page=${page}/id=960335206/json`
      
      try {
        // Omit custom User-Agent headers as Apple blocks standard desktop browser agents on this feed.
        const response = await fetch(url, { signal })

        if (!response.ok) {
          console.error(`[AppStoreCollector] HTTP error: ${response.status}`)
          break
        }

        const data = await response.json()
        const entries = data.feed?.entry

        if (!entries || !Array.isArray(entries) || entries.length === 0) {
          break
        }

        // To prevent infinite loops if the API returns duplicate contents on consecutive page requests
        if (entries.length === lastFetchedLength) {
          break
        }
        lastFetchedLength = entries.length

        for (const entry of entries) {
          if (count >= amount) break

          const reviewId = entry.id?.label
          const ratingStr = entry['im:rating']?.label
          const rating = ratingStr ? Number(ratingStr) : undefined
          const text = entry.content?.label || entry.summary?.label || ''
          if (!text) continue

          // Parse updated timestamp from App Store JSON feed
          const dateStr = entry.updated?.label
            ? entry.updated.label.split('T')[0]
            : new Date().toISOString().split('T')[0]

          const review: RawReview = {
            source: this.id,
            text,
            review_id: reviewId,
            rating,
            date: dateStr,
          }

          yield review
          fetchedAny = true
          count++
        }

        // Politeness delay based on internet consensus
        await new Promise((resolve) => setTimeout(resolve, getRandomDelay()))
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[AppStoreCollector] Fetch error: ${errMsg}`)
        break
      }
    }

    // Fallback to seed corpus if live fetch returned no data (legacy endpoint deprecation fallback)
    if (!fetchedAny && !signal?.aborted) {
      console.log(`[AppStoreCollector] Live feed empty or blocked. Falling back to local seed data.`)
      try {
        const csvPath = path.join(process.cwd(), 'data', 'seed-corpus.csv')
        if (fs.existsSync(csvPath)) {
          const content = fs.readFileSync(csvPath, 'utf-8')
          const allReviews = parseReviews(content)
          const filtered = allReviews.filter((r) => r.source === this.id)
          for (const review of filtered) {
            if (signal?.aborted) break
            if (count >= amount) break
            yield review
            count++
          }
        }
      } catch (err) {
        console.error(`[AppStoreCollector] Fallback parsing failed:`, err)
      }
    }
  }
}


