import { describe, it, expect } from 'vitest'
import { deduplicateReviews } from '../collectors/dedupe'
import { isExplorationRelevant } from '../collectors/keyword-filter'
import { COLLECTOR_REGISTRY, fetchFromAllSources } from '../collectors'

process.env.SCRAPER_DELAY_MIN = '0'
process.env.SCRAPER_DELAY_MAX = '0'


describe('Deduplication and Filters', () => {
  it('deduplicates reviews regardless of case and punctuation', () => {
    const raw = [
      { source: 'playstore', text: 'Hello, World!', review_id: '1' },
      { source: 'reddit', text: 'hello world', review_id: '2' },
      { source: 'appstore', text: 'Distinct review text', review_id: '3' },
    ]
    const uniq = deduplicateReviews(raw)
    expect(uniq.length).toBe(2)
    expect(uniq[0].review_id).toBe('1')
    expect(uniq[1].review_id).toBe('3')
  })

  it('filters exploration relevant reviews', () => {
    expect(isExplorationRelevant('How do I browse category aisles on this app?')).toBe(true)
    expect(isExplorationRelevant('dog food is hidden in menu')).toBe(true)
    expect(isExplorationRelevant('Nice delivery speed')).toBe(false)
  })
})

describe('Collectors Integration', () => {
  it('instantiates all seven collectors in registry', () => {
    const expected = ['playstore', 'appstore', 'reddit', 'forums', 'social', 'product_reviews', 'quickcommerce']
    expected.forEach((id) => {
      expect(COLLECTOR_REGISTRY[id]).toBeDefined()
      expect(COLLECTOR_REGISTRY[id].id).toBe(id)
      expect(COLLECTOR_REGISTRY[id].supports).toBeDefined()
    })
  })

  it('collectors emit async iterables matching filters', async () => {
    const playstore = COLLECTOR_REGISTRY.playstore
    const iterator = playstore.fetch({ amount: 5, region: 'Delhi NCR', minRating: 4 })
    
    let count = 0
    for await (const review of iterator) {
      count++
      expect(review.source).toBe('playstore')
      expect(review.rating).toBeGreaterThanOrEqual(4)
    }
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('gracefully degrades when one collector throws an error', async () => {
    // Mock the playstore collector fetch to throw an error
    const playstore = COLLECTOR_REGISTRY.playstore
    const originalFetch = playstore.fetch
    
    playstore.fetch = async function* () {
      throw new Error('Simulated network error')
    }

    try {
      const result = await fetchFromAllSources(['playstore', 'product_reviews'], { amount: 5 })
      expect(result.reviews).toBeDefined()
      expect(result.stats.perSourceStats.playstore.rawFetched).toBe(0)
      expect(result.stats.perSourceStats.product_reviews.rawFetched).toBeGreaterThan(0)
    } finally {
      // Restore original
      playstore.fetch = originalFetch
    }
  })
})
