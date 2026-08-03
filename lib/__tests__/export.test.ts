import { describe, it, expect } from 'vitest'
import { escapeCsvCell, buildProvenanceHeader, exportToCsv, exportToFullMarkdown } from '../export'
import { formatExecutiveReportMarkdown } from '../export-pm'
import { Run, ClassifiedReview } from '../types'

describe('Phase 7 - Export Serializers & CSV Security Unit Tests', () => {
  it('escapes dangerous CSV formula injection characters (=, +, -, @)', () => {
    expect(escapeCsvCell('=1+2')).toBe("'=1+2")
    expect(escapeCsvCell('+SUM(A1:A10)')).toBe("'+SUM(A1:A10)")
    expect(escapeCsvCell('-100')).toBe("'-100")
    expect(escapeCsvCell('@admin')).toBe("'@admin")
    expect(escapeCsvCell('Normal text')).toBe('Normal text')
  })

  it('generates standardized provenance header with synthetic badge if mock', () => {
    const mockRun: Run = {
      id: 'run_mock_123',
      seq: 1,
      dataset_name: 'Test Dataset',
      status: 'completed',
      created_at: '2026-07-31T00:00:00Z',
      total_reviews: 10,
      exploration_relevant_count: 5,
      excluded_count: 5,
      source_mix: { playstore: 5 },
      fetch_params: {},
      curation_stats: { loaded: 10, unique: 10, duplicatesRemoved: 0, sentToClassification: 5, excluded: 5, excludedByCategory: {} },
      aggregation: {} as any,
      findings: [],
      executive_report: {} as any,
      readiness_score: 85,
      readiness_gaps: [],
      taxonomy_version: '1.0.0',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      mock: true,
      environment: 'local',
    }

    const header = buildProvenanceHeader(mockRun)
    expect(header).toContain('SYNTHETIC DATA')
    expect(header).toContain('Test Dataset')
    expect(header).toContain('run_mock_123')
    expect(header).toContain('1.0.0')
    expect(header).toContain('85/100')
  })

  it('serializes classified reviews into a formula-injection safe CSV', () => {
    const sampleReviews: ClassifiedReview[] = [
      {
        review_id: 'rev_1',
        source: 'playstore',
        text: '=DANGEROUS_FORMULA()',
        rating: 3,
        exploration_relevant: true,
        research_relevant: true,
        research_questions: ['why_exploration_fails'],
        evidence: 'Sample evidence',
        exploration_outcome: 'failed',
        theme: 'Poor Category Discoverability',
        barrier: 'Low Category Awareness',
        behavior: 'Browse Category Aisles',
        emotion: 'Frustration',
        segment: 'New or Low-Tenure User',
        root_cause: 'Buried Category Entry Points',
        unmet_need: 'Better Category Navigation',
        mentioned_categories: ['dairy'],
        confidence: 0.9,
        classification_reasons: [],
      },
    ]

    const csv = exportToCsv(sampleReviews)
    expect(csv).toContain("'=DANGEROUS_FORMULA()")
    expect(csv).toContain('rev_1')
    expect(csv).toContain('playstore')
  })

  it('produces distinct PM research report vs Full Markdown report', () => {
    const mockRun: Run = {
      id: 'run_test_777',
      seq: 7,
      dataset_name: 'PM Test Corpus',
      status: 'completed',
      created_at: '2026-07-31T00:00:00Z',
      total_reviews: 20,
      exploration_relevant_count: 15,
      excluded_count: 5,
      source_mix: { playstore: 15 },
      fetch_params: {},
      curation_stats: { loaded: 20, unique: 20, duplicatesRemoved: 0, sentToClassification: 15, excluded: 5, excludedByCategory: {} },
      aggregation: {} as any,
      findings: [
        {
          id: '1',
          title: 'What are the barriers?',
          description: 'Basket habit lock-in.',
          evidence_strength: 'Strong',
          representative_quotes: [{ text: 'Sample quote', source: 'reddit', review_id: 'rev_1' } as any],
          evidence_count: 5,
          affected_segments: [],
          confidence: 'High',
          confidence_score: 0.9,
          source_count: 1,
          business_impact: [],
        },
      ],
      executive_report: {
        summary: 'PM Strategic Executive Summary',
        behaviors: 'Takeaway 1',
        segmentDifferences: 'Takeaway 2',
        unmetNeeds: 'Takeaway 3',
        opportunities: [],
        rejectedOpportunities: [],
        slides: [],
        readinessScore: 90,
        readinessGaps: [],
      },
      readiness_score: 90,
      readiness_gaps: [],
      taxonomy_version: '1.0.0',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      mock: false,
      environment: 'local',
    }

    const fullMd = exportToFullMarkdown(mockRun, [])
    const pmMd = formatExecutiveReportMarkdown(mockRun)

    expect(fullMd).toContain('ReviewLens Full Analysis Report')
    expect(pmMd).toContain('ReviewLens — Executive PM Research Synthesis')
    expect(pmMd).toContain('PM Strategic Executive Summary')
    expect(fullMd).not.toEqual(pmMd)
  })
})
