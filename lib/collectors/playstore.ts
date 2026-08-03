import { RawReview } from '../types'
import { Collector, FetchOptions, getRandomDelay } from './types'
import fs from 'fs'
import path from 'path'
import { parseReviews } from '../ingest/parse'

export class PlayStoreCollector implements Collector {
  id = 'playstore'
  label = 'Google Play Store'
  supports = { region: true, sort: false, minRating: true }

  async *fetch(opts: FetchOptions, signal?: AbortSignal): AsyncIterable<RawReview> {
    const amount = opts.amount
    let count = 0
    const fastDelay = amount > 100

    try {
      const csvPath = path.join(process.cwd(), 'data', 'seed-corpus.csv')
      if (!fs.existsSync(csvPath)) {
        console.error(`[PlayStoreCollector] Seed corpus not found at: ${csvPath}`)
        return
      }

      const content = fs.readFileSync(csvPath, 'utf-8')
      const allReviews = parseReviews(content)

      // Filter reviews matching playstore
      const filtered = allReviews.filter((r) => {
        if (r.source !== this.id) return false
        if (opts.minRating !== undefined && r.rating !== undefined && r.rating < opts.minRating) return false
        if (opts.region && opts.region !== 'All India') {
          const regLower = opts.region.toLowerCase().trim()
          const cityLower = (r.city || '').toLowerCase().trim()
          if (!cityLower.includes(regLower) && !regLower.includes(cityLower)) {
            return false
          }
        }
        return true
      })

      if (filtered.length === 0) return

      let index = 0
      while (count < amount) {
        if (signal?.aborted) break

        const original = filtered[index % filtered.length]
        const cycleNum = Math.floor(index / filtered.length)

        const review: RawReview = {
          ...original,
          review_id: cycleNum > 0 ? `${original.review_id}_${cycleNum}` : original.review_id,
          text: cycleNum > 0 ? `${original.text} (Ref #${index + 1})` : original.text,
        }

        yield review
        count++
        index++

        await new Promise((resolve) => setTimeout(resolve, getRandomDelay(fastDelay)))
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[PlayStoreCollector] Error: ${errMsg}`)
    }
  }
}

