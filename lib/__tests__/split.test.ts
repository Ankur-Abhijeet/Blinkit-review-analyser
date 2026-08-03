import { describe, it, expect } from 'vitest'
import { planCorpusSplit } from '../split'
import { CuratedReview } from '../types'

describe('Phase 6 - Split Planner Unit Tests', () => {
  const createMockCurated = (count: number): CuratedReview[] => {
    return Array.from({ length: count }, (_, i) => ({
      source: 'playstore',
      text: `Review text number ${i}`,
      review_id: `rev_${i}`,
      exploration_relevant: true,
    }))
  }

  it('returns single part when total is within max batch budget', () => {
    const reviews = createMockCurated(50)
    const plan = planCorpusSplit(reviews, 100)

    expect(plan.totalCount).toBe(50)
    expect(plan.partsCount).toBe(1)
    expect(plan.parts).toHaveLength(1)
    expect(plan.parts[0].reviews).toHaveLength(50)
  })

  it('splits corpus into 2-5 balanced parts when exceeding max batch budget', () => {
    const reviews = createMockCurated(250)
    const plan = planCorpusSplit(reviews, 100)

    expect(plan.totalCount).toBe(250)
    expect(plan.partsCount).toBeGreaterThanOrEqual(2)
    expect(plan.partsCount).toBeLessThanOrEqual(5)

    const totalDistributed = plan.parts.reduce((sum, p) => sum + p.count, 0)
    expect(totalDistributed).toBe(250)
  })

  it('clamps max parts to 5 even for very large corpora', () => {
    const reviews = createMockCurated(1000)
    const plan = planCorpusSplit(reviews, 100)

    expect(plan.partsCount).toBe(5)
    expect(plan.parts).toHaveLength(5)
  })
})
