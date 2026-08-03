import { RawReview } from '../types'

export interface FetchOptions {
  amount: number
  region?: string
  sort?: string
  minRating?: number
}

export interface Collector {
  id: string
  label: string
  supports: { region: boolean; sort: boolean; minRating: boolean }
  fetch(opts: FetchOptions, signal?: AbortSignal): AsyncIterable<RawReview>
}

/**
 * Per-source configuration metadata.
 * Controls default fetch limits and provides context for token estimation.
 */
export interface SourceConfig {
  /** Max reviews this source should fetch per run (UI default) */
  defaultLimit: number
  /** Hard ceiling for the UI slider */
  maxLimit: number
  /** Avg chars per review — used for token estimation */
  avgReviewLength: number
  /** Whether this source supports numeric ratings natively */
  hasNativeRating: boolean
  /** Short description shown in UI */
  description: string
}

export const SOURCE_DEFAULTS: Record<string, SourceConfig> = {
  playstore: {
    defaultLimit: 500,
    maxLimit: 5000,
    avgReviewLength: 120,
    hasNativeRating: true,
    description: 'Structured Play Store reviews (short, rated, up to 5000)',
  },
  appstore: {
    defaultLimit: 100,
    maxLimit: 500,
    avgReviewLength: 150,
    hasNativeRating: true,
    description: 'iTunes RSS feed reviews (up to 500 max feed capacity)',
  },
  reddit: {
    defaultLimit: 100,
    maxLimit: 2000,
    avgReviewLength: 400,
    hasNativeRating: false,
    description: 'Long-form posts & comments (unstructured, unrated)',
  },
  forums: {
    defaultLimit: 100,
    maxLimit: 2000,
    avgReviewLength: 200,
    hasNativeRating: true,
    description: 'Consumer complaint posts (medium, semi-structured)',
  },
  social: {
    defaultLimit: 100,
    maxLimit: 2000,
    avgReviewLength: 180,
    hasNativeRating: true,
    description: 'Twitter/X posts (short, informal)',
  },
  product_reviews: {
    defaultLimit: 100,
    maxLimit: 2000,
    avgReviewLength: 160,
    hasNativeRating: true,
    description: 'Product page reviews (structured, product-focused)',
  },
  quickcommerce: {
    defaultLimit: 100,
    maxLimit: 2000,
    avgReviewLength: 170,
    hasNativeRating: true,
    description: 'Competitor comparison discussions (medium, opinionated)',
  },
}

/**
 * Returns a random delay in milliseconds based on the web scraping politeness consensus.
 * Standard delay: 1000ms - 3000ms.
 * Fast delay (for large batches >100): 2ms - 7ms to prevent HTTP request timeouts.
 */
export function getRandomDelay(fast?: boolean): number {
  if (fast) return Math.floor(Math.random() * 5) + 2
  const minStr = process.env.SCRAPER_DELAY_MIN
  const maxStr = process.env.SCRAPER_DELAY_MAX
  const min = minStr !== undefined && minStr !== '' ? Number(minStr) : 1000
  const max = maxStr !== undefined && maxStr !== '' ? Number(maxStr) : 3000
  return Math.floor(Math.random() * (max - min + 1)) + min
}

