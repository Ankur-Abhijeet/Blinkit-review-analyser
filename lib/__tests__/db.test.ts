import { describe, it, expect, beforeAll } from 'vitest'
import { saveRun, loadRun, listRuns, deleteRun, TAXONOMY_VERSION } from '../db/runs'
import { Run, ClassifiedReview, Aggregation, CurationStats } from '../types'
import { runMigrations } from '../db/client'

describe('Database Persistence & Invariant Tests', () => {
  beforeAll(async () => {
    // Run migrations before tests start
    await runMigrations()
  })

  it('EV-P4-01: Run round-trip: persist -> load -> deep-equal', async () => {
    const runId = `test_run_${Date.now()}`
    
    const mockReview: ClassifiedReview = {
      review_id: 'rev_1',
      source: 'reddit',
      text: 'Blinkit select category is confusing.',
      evidence: 'Blinkit select category',
      exploration_relevant: true,
      research_relevant: true,
      theme: 'Basket Habit Lock-In',
      barrier: 'Low Category Awareness',
      behavior: 'Reorder Previous Basket',
      emotion: 'Frustration',
      root_cause: 'Reorder-Surface Dominance',
      unmet_need: 'Trial-Sized First Purchase',
      mentioned_categories: ['grocery'],
      confidence: 0.9,
      classification_reasons: ['Reason text'],
      research_questions: ['shopping_behaviors', 'segment_challenges'],
      exploration_outcome: 'failed',
      segment: 'Habitual Replenisher',
    }

    const mockRun: Run = {
      id: runId,
      seq: 999,
      dataset_name: 'Seed Test Dataset',
      status: 'completed',
      created_at: new Date().toISOString(),
      total_reviews: 1,
      exploration_relevant_count: 1,
      excluded_count: 0,
      source_mix: { reddit: 1 },
      fetch_params: {},
      curation_stats: {
        loaded: 1,
        unique: 1,
        duplicatesRemoved: 0,
        sentToClassification: 1,
        excluded: 0,
        excludedByCategory: {},
      },
      aggregation: {
        totalReviews: 1,
        explorationRelevantCount: 1,
        excludedCount: 0,
        themes: {},
        barriers: {},
        behaviors: {},
        emotions: {},
        segments: {},
        rootCauses: {},
        unmetNeeds: {},
        categoryMentions: {},
        segmentByTheme: { rows: [], cols: [], cells: {} },
        themeQuotes: [],
        rootCauseQuotes: [],
        unmetNeedQuotes: [],
        sourceDistribution: { reddit: 1 },
      } as unknown as Aggregation,
      findings: [
        {
          id: 'why_exploration_fails',
          title: 'Top barrier',
          description: 'Desc',
          evidence_count: 1,
          affected_segments: ['Habitual Replenisher'],
          representative_quotes: [
            {
              review_id: 'rev_1',
              source: 'reddit',
              text: 'Blinkit select category is confusing.',
              segment: 'Habitual Replenisher',
              theme: 'Basket Habit Lock-In',
              confidence: 0.9,
              barrier: 'Low Category Awareness',
              root_cause: 'Reorder-Surface Dominance',
              unmet_need: 'Trial-Sized First Purchase',
            },
          ],
          confidence: 'High',
          confidence_score: 0.9,
          evidence_strength: 'Weak',
          source_count: 1,
          business_impact: [],
        },
      ],
      executive_report: {
        summary: 'Summary text',
        behaviors: 'Behaviors',
        segmentDifferences: 'Segments',
        unmetNeeds: 'Needs',
        opportunities: [
          {
            id: 'opp_1',
            problem: 'Problem description text that is long enough.',
            current_user_behavior: 'Behavior text.',
            root_cause: 'Mechanism description.',
            blinkit_opportunity: 'Intervention text.',
            size: 'Medium',
            opportunity_score: 55,
            impact_score: 4,
            frequency_score: 3,
            confidence_score: 4,
            supporting_reviews: 1,
            affected_segments: [],
            representative_quotes: [
              {
                review_id: 'rev_1',
                source: 'reddit',
                text: 'Blinkit select category is confusing.',
                segment: 'Habitual Replenisher',
                theme: 'Basket Habit Lock-In',
                confidence: 0.9,
                barrier: 'Low Category Awareness',
                root_cause: 'Reorder-Surface Dominance',
                unmet_need: 'Trial-Sized First Purchase',
              },
            ],
            related_finding_id: 'unmet_needs',
          },
        ],
        rejectedOpportunities: [],
        slides: [],
        readinessScore: 8,
        readinessGaps: [],
      },
      readiness_score: 8,
      readiness_gaps: [],
      taxonomy_version: TAXONOMY_VERSION,
      model: 'mock-model',
      provider: 'mock-provider',
      mock: true,
      environment: 'local',
    }

    // Persist
    await saveRun(mockRun, [mockReview])

    // Load
    const loaded = await loadRun(runId)
    expect(loaded).not.toBeNull()
    if (loaded) {
      expect(loaded.run.id).toBe(mockRun.id)
      expect(loaded.run.dataset_name).toBe(mockRun.dataset_name)
      expect(loaded.run.taxonomy_version).toBe(TAXONOMY_VERSION)
      expect(loaded.reviews.length).toBe(1)
      expect(loaded.reviews[0].review_id).toBe('rev_1')
      expect(loaded.reviews[0].text).toBe(mockReview.text)
    }

    // List
    const runs = await listRuns()
    expect(runs.some((r) => r.id === runId)).toBe(true)

    // Delete
    await deleteRun(runId)
    const afterDelete = await loadRun(runId)
    expect(afterDelete).toBeNull()
  })

  it('EV-P4-02: saveRun fails if quote review_id does not resolve (Invariant I8)', async () => {
    const runId = `test_run_fail_${Date.now()}`

    const mockReview: ClassifiedReview = {
      review_id: 'rev_1',
      source: 'reddit',
      text: 'Text',
      evidence: 'Text',
      exploration_relevant: true,
      research_relevant: true,
      theme: 'Basket Habit Lock-In',
      barrier: 'Low Category Awareness',
      behavior: 'Reorder Previous Basket',
      emotion: 'Frustration',
      root_cause: 'Reorder-Surface Dominance',
      unmet_need: 'Trial-Sized First Purchase',
      mentioned_categories: [],
      confidence: 0.9,
      classification_reasons: [],
      research_questions: ['shopping_behaviors'],
      exploration_outcome: 'failed',
      segment: 'Habitual Replenisher',
    }

    const mockRun: Run = {
      id: runId,
      seq: 1000,
      dataset_name: 'Fail Run',
      status: 'completed',
      created_at: new Date().toISOString(),
      total_reviews: 1,
      exploration_relevant_count: 1,
      excluded_count: 0,
      source_mix: {},
      fetch_params: {},
      curation_stats: {} as unknown as CurationStats,
      aggregation: {} as unknown as Aggregation,
      findings: [
        {
          id: 'why_exploration_fails',
          title: 'Top barrier',
          description: 'Desc',
          evidence_count: 1,
          affected_segments: [],
          representative_quotes: [
            {
              review_id: 'non_existent_rev', // Mismatch to trigger I8 violation!
              source: 'reddit',
              text: 'Text',
              segment: 'Habitual Replenisher',
              theme: 'Basket Habit Lock-In',
              confidence: 0.9,
              barrier: 'Low Category Awareness',
              root_cause: 'Reorder-Surface Dominance',
              unmet_need: 'Trial-Sized First Purchase',
            },
          ],
          confidence: 'High',
          confidence_score: 0.9,
          evidence_strength: 'Weak',
          source_count: 1,
          business_impact: [],
        },
      ],
      executive_report: {
        summary: '',
        behaviors: '',
        segmentDifferences: '',
        unmetNeeds: '',
        opportunities: [],
        rejectedOpportunities: [],
        slides: [],
        readinessScore: 5,
        readinessGaps: [],
      },
      readiness_score: 5,
      readiness_gaps: [],
      taxonomy_version: TAXONOMY_VERSION,
      model: 'mock',
      provider: 'mock',
      mock: true,
      environment: 'local',
    }

    // Save should throw error because non_existent_rev is not in the reviews
    await expect(saveRun(mockRun, [mockReview])).rejects.toThrow(/Invariant I8/i)
  })
})
