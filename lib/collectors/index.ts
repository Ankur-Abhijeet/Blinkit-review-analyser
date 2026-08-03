import { RawReview } from '../types'
import { Collector, FetchOptions } from './types'
import { PlayStoreCollector } from './playstore'
import { AppStoreCollector } from './appstore'
import { RedditCollector } from './reddit'
import { ForumsCollector } from './forums'
import { SocialCollector } from './social'
import { ProductReviewsCollector } from './product-reviews'
import { QuickCommerceCollector } from './quickcommerce'
import { isExplorationRelevant } from './keyword-filter'
import { deduplicateReviews } from './dedupe'
import { normalizeReviews } from './normalizer'

// Re-export source config for frontend consumption
export { SOURCE_DEFAULTS } from './types'
export type { SourceConfig } from './types'

export const COLLECTOR_REGISTRY: Record<string, Collector> = {
  playstore: new PlayStoreCollector(),
  appstore: new AppStoreCollector(),
  reddit: new RedditCollector(),
  forums: new ForumsCollector(),
  social: new SocialCollector(),
  product_reviews: new ProductReviewsCollector(),
  quickcommerce: new QuickCommerceCollector(),
}

export interface FetchResult {
  reviews: RawReview[]
  stats: {
    totalRawFetched: number
    totalYieldKept: number
    perSourceStats: Record<
      string,
      {
        rawFetched: number
        yieldKept: number
      }
    >
  }
}

export async function fetchFromAllSources(
  sources: string[],
  opts: FetchOptions,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const activeCollectors = sources
    .map((id) => COLLECTOR_REGISTRY[id])
    .filter(Boolean)

  if (activeCollectors.length === 0) {
    return {
      reviews: [],
      stats: { totalRawFetched: 0, totalYieldKept: 0, perSourceStats: {} },
    }
  }

  const perSourceStats: Record<string, { rawFetched: number; yieldKept: number }> = {}
  sources.forEach((s) => {
    perSourceStats[s] = { rawFetched: 0, yieldKept: 0 }
  })

  // We fetch from each source concurrently
  const promises = activeCollectors.map(async (collector) => {
    const rawList: RawReview[] = []
    const sourceId = collector.id

    try {
      const iterator = collector.fetch(opts, signal)
      for await (const review of iterator) {
        if (signal?.aborted) break
        rawList.push(review)
      }
    } catch (err) {
      console.error(`[fetchFromAllSources] Error in collector "${sourceId}":`, err)
      // Degrade run: do not fail entirely
    }

    return { sourceId, rawList }
  })

  const results = await Promise.all(promises)

  // Pipeline: Normalize → Dedupe → Keyword Filter → Tally stats
  const allFilteredReviews: RawReview[] = []
  
  results.forEach(({ sourceId, rawList }) => {
    perSourceStats[sourceId].rawFetched = rawList.length

    // Step 1: Normalize source-specific format issues (HTML entities, markdown, etc.)
    const normalized = normalizeReviews(rawList)

    // Step 2: Deduplicate within-source before pre-filtering to prevent duplication bias (EC-P5-03)
    const withinSourceDeduplicated = deduplicateReviews(normalized)

    // Step 3: Keyword pre-filter on normalized text
    const onTopic = withinSourceDeduplicated.filter((r) => {
      return isExplorationRelevant(r.text)
    })

    perSourceStats[sourceId].yieldKept = onTopic.length
    allFilteredReviews.push(...onTopic)
  })

  // Cross-source deduplication (e.g. cross-posted between Reddit and forums)
  const finalUniqueReviews = deduplicateReviews(allFilteredReviews)

  // Tally totals
  const totalRawFetched = Object.values(perSourceStats).reduce((acc, curr) => acc + curr.rawFetched, 0)
  const totalYieldKept = finalUniqueReviews.length

  // Cap at requested opts.amount
  const cappedReviews = finalUniqueReviews.slice(0, opts.amount)

  return {
    reviews: cappedReviews,
    stats: {
      totalRawFetched,
      totalYieldKept,
      perSourceStats,
    },
  }
}
