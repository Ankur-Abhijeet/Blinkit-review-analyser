import { describe, it, expect } from 'vitest'
import { calculateEvidenceStrength, calculateReadinessScore, evaluateDriftAlarms } from '../observability'

describe('Phase 8 - Observability & Readiness Rubric Unit Tests', () => {
  it('evaluates evidence-strength grading correctly', () => {
    expect(calculateEvidenceStrength(25, 4)).toBe('strong')
    expect(calculateEvidenceStrength(15, 2)).toBe('medium')
    expect(calculateEvidenceStrength(5, 1)).toBe('weak')
    expect(calculateEvidenceStrength(25, 1)).toBe('weak') // requires >= 3 sources for strong
  })

  it('calculates readiness score and identifies specific gap text', () => {
    const weakRunResult = calculateReadinessScore(20, 5, 1, [])
    expect(weakRunResult.score).toBeLessThan(60)
    expect(weakRunResult.grade).toBe('Insufficient Evidence')
    expect(weakRunResult.gaps.length).toBeGreaterThanOrEqual(3)
    expect(weakRunResult.gaps[0]).toContain('Low sample size')
    expect(weakRunResult.gaps[1]).toContain('Insufficient research evidence')
    expect(weakRunResult.gaps[2]).toContain('Single/dual-source dominance')
  })

  it('triggers drift alarms when curation keep-rate or confidence drops below baseline', () => {
    const alarms = evaluateDriftAlarms(0.02, 0.65, 0.12, 0.85)
    expect(alarms).toHaveLength(2)
    expect(alarms[0].metric).toBe('Curation Keep-Rate Drop')
    expect(alarms[0].severity).toBe('critical')
    expect(alarms[1].metric).toBe('Mean Confidence Shift')
    expect(alarms[1].severity).toBe('warning')
  })

  it('returns no alarms for healthy baseline performance', () => {
    const alarms = evaluateDriftAlarms(0.15, 0.88, 0.12, 0.85)
    expect(alarms).toHaveLength(0)
  })
})
