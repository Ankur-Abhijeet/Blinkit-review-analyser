import { describe, it, expect, beforeEach } from 'vitest'
import { computeContentHash, setCache, getCache, clearCache, getCacheBatch, writeThroughCache, getTaxonomyHash } from '../db/cache'
import { ClassifiedReview } from '../types'

describe('Phase 6 - Classification Cache Unit Tests', () => {
  beforeEach(async () => {
    await clearCache()
  })

  it('computes deterministic sha256 content-hash key (ADR-009)', () => {
    const hash1 = computeContentHash('Great delivery on Blinkit!', 'playstore')
    const hash2 = computeContentHash('great delivery on blinkit', 'PLAYSTORE')
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // sha256 hex length
  })

  it('stores and retrieves cached classification (write-through)', async () => {
    const sampleReview: ClassifiedReview = {
      review_id: 'rev_123',
      source: 'playstore',
      text: 'Milk was delivered fresh.',
      exploration_relevant: true,
      research_relevant: true,
      research_questions: ['why_exploration_fails', 'shopping_behaviors'],
      evidence: 'Observation quote',
      exploration_outcome: 'successful',
      theme: 'Assortment Delight',
      barrier: 'Low Category Awareness',
      behavior: 'Reorder Previous Basket',
      emotion: 'Neutral',
      segment: 'Habitual Replenisher',
      root_cause: 'Reorder-Surface Dominance',
      unmet_need: 'Trial-Sized First Purchase',
      mentioned_categories: ['dairy'],
      confidence: 0.95,
      classification_reasons: ['Reason 1'],
    }

    const hash = computeContentHash(sampleReview.text, sampleReview.source)
    setCache(hash, sampleReview)

    const cached = getCache(hash)
    expect(cached).not.toBeNull()
    expect(cached?.review_id).toBe('rev_123')
    expect(cached?.theme).toBe('Assortment Delight')
  })

  it('handles batch cache lookup returning hits and misses', async () => {
    const review: ClassifiedReview = {
      review_id: 'rev_999',
      source: 'reddit',
      text: 'Search is the only way.',
      exploration_relevant: true,
      research_relevant: true,
      research_questions: [],
      evidence: '',
      exploration_outcome: 'failed',
      theme: 'Search-Only Shopping',
      barrier: 'Low Category Awareness',
      behavior: 'Browse Category Aisles',
      emotion: 'Frustration',
      segment: 'Impulse & Emergency Shopper',
      root_cause: 'Buried Category Entry Points',
      unmet_need: 'Better Category Navigation',
      mentioned_categories: [],
      confidence: 0.8,
      classification_reasons: [],
    }

    const hitHash = computeContentHash(review.text, review.source)
    const missHash = 'non_existent_hash_123456789'

    await writeThroughCache({ [hitHash]: review })

    const { hits, misses } = await getCacheBatch([hitHash, missHash])
    expect(Object.keys(hits)).toHaveLength(1)
    expect(hits[hitHash].review_id).toBe('rev_999')
    expect(misses).toContain(missHash)
  })

  it('computes a valid taxonomy hash string', () => {
    const taxHash = getTaxonomyHash()
    expect(typeof taxHash).toBe('string')
    expect(taxHash.length).toBeGreaterThan(0)
  })
})
