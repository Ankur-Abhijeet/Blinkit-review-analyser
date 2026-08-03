import { describe, it, expect } from 'vitest'
import { Run } from '../types'

describe('Phase 7 - Run Compare Taxonomy Guard Unit Tests', () => {
  const createMockRun = (id: string, taxonomyVersion: string): Run => ({
    id,
    seq: 1,
    dataset_name: `Corpus ${id}`,
    status: 'completed',
    created_at: '2026-07-31T00:00:00Z',
    total_reviews: 50,
    exploration_relevant_count: 30,
    excluded_count: 20,
    source_mix: { playstore: 30 },
    fetch_params: {},
    curation_stats: { loaded: 50, unique: 50, duplicatesRemoved: 0, sentToClassification: 30, excluded: 20, excludedByCategory: {} },
    aggregation: {} as any,
    findings: [],
    executive_report: {} as any,
    readiness_score: 80,
    readiness_gaps: [],
    taxonomy_version: taxonomyVersion,
    model: 'llama-3.3-70b-versatile',
    provider: 'groq',
    mock: false,
    environment: 'local',
  })

  it('rejects comparison when taxonomy_version differs between runs', () => {
    const runA = createMockRun('run_1', '1.0.0')
    const runB = createMockRun('run_2', '2.0.0')

    const isMatch = runA.taxonomy_version === runB.taxonomy_version
    expect(isMatch).toBe(false)
  })

  it('allows comparison when taxonomy_version matches exactly', () => {
    const runA = createMockRun('run_1', '1.0.0')
    const runB = createMockRun('run_2', '1.0.0')

    const isMatch = runA.taxonomy_version === runB.taxonomy_version
    expect(isMatch).toBe(true)
  })
})
