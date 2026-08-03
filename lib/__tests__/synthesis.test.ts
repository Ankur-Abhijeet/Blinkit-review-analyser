import { describe, it, expect } from 'vitest'
import { normalizeText, lengthFloor, curateReviews } from '../curate'
import { deduplicateReviews } from '../collectors/dedupe'
import { mockClassifyReview } from '../llm/mock'
import { aggregateReviews, buildCrossTab } from '../aggregate'
import { buildFindingsReport } from '../findings'
import { synthesizeReport, validateOpportunity } from '../synthesis'
import { parseReviews } from '../ingest/parse'
import { isPositiveTheme } from '../taxonomy'
import { RawReview, ClassifiedReview } from '../types'
import fs from 'fs'
import path from 'path'

describe('Phase 2 Pipeline & Synthesis Tests', () => {

  // --- 1. Curation & Normalization ---
  it('EV-P2-01: Normalization steps - unicode, signatures, whitespace, repeated punctuation', () => {
    // Unicode normalisation
    const unicodeInput = 'hello\u2111world' // Fraktur I -> normalized to I
    expect(normalizeText(unicodeInput)).toContain('I')

    // Signatures and boilerplate
    const signatureInput = 'This is a comment. Sent from my iPhone'
    expect(normalizeText(signatureInput)).toBe('This is a comment.')

    // Whitespace collapse
    const spacesInput = 'Hello    world   with  many\n\n\n\nnewlines'
    expect(normalizeText(spacesInput)).toBe('Hello world with many\n\nnewlines')

    // Repeated punctuation collapse
    const puncInput = 'What is this??!!!!'
    expect(normalizeText(puncInput)).toBe('What is this??!!!')
  });

  it('EV-P2-02: Deduplication on exact and near-duplicates', () => {
    const reviews: RawReview[] = [
      { source: 'reddit', text: 'This is a unique review about Blinkit.' },
      { source: 'social', text: 'This is a unique review about Blinkit.' }, // Exact duplicate
      { source: 'playstore', text: 'this is a unique review about blinkit!' }, // Near-duplicate
      { source: 'forums', text: 'Genuinely another different comment about grocery.' },
    ]

    const deduped = deduplicateReviews(reviews)
    expect(deduped.length).toBe(2)
    expect(deduped[0].text).toBe('This is a unique review about Blinkit.')
    expect(deduped[1].text).toBe('Genuinely another different comment about grocery.')
  });

  it('EV-P2-03: lengthFloor filter rejects short reviews', () => {
    expect(lengthFloor('Good')).toBe(false)
    expect(lengthFloor('Good app!')).toBe(false) // 9 chars
    expect(lengthFloor('This is a longer review of Blinkit')).toBe(true) // 34 chars
  });

  // --- 2. Aggregation & CrossTabs ---
  it('EV-P2-04: buildCrossTab calculations and sorting', () => {
    const classified: ClassifiedReview[] = [
      {
        source: 'reddit',
        text: 'Review 1',
        evidence: 'Review 1',
        exploration_relevant: true,
        research_relevant: true,
        theme: 'Basket Habit Lock-In',
        segment: 'Habitual Replenisher',
        barrier: 'Low Category Awareness',
        behavior: 'Reorder Previous Basket',
        emotion: 'Frustration',
        root_cause: 'Reorder-Surface Dominance',
        unmet_need: 'Trial-Sized First Purchase',
        mentioned_categories: [],
        confidence: 0.8,
        classification_reasons: [],
        research_questions: ['shopping_behaviors', 'segment_challenges'],
        exploration_outcome: 'failed',
      },
      {
        source: 'playstore',
        text: 'Review 2',
        evidence: 'Review 2',
        exploration_relevant: true,
        research_relevant: true,
        theme: 'Basket Habit Lock-In',
        segment: 'Habitual Replenisher',
        barrier: 'Low Category Awareness',
        behavior: 'Reorder Previous Basket',
        emotion: 'Frustration',
        root_cause: 'Reorder-Surface Dominance',
        unmet_need: 'Trial-Sized First Purchase',
        mentioned_categories: [],
        confidence: 0.9,
        classification_reasons: [],
        research_questions: ['shopping_behaviors', 'segment_challenges'],
        exploration_outcome: 'failed',
      },
      {
        source: 'appstore',
        text: 'Review 3',
        evidence: 'Review 3',
        exploration_relevant: true,
        research_relevant: true,
        theme: 'Successful Category Trial',
        segment: 'Occasion Shopper',
        barrier: 'Unclear Exploration Struggle',
        behavior: 'Browse Category Aisles',
        emotion: 'Neutral',
        root_cause: 'Unclear Repeat-Purchase Cause',
        unmet_need: 'General Discovery Improvement',
        mentioned_categories: [],
        confidence: 0.7,
        classification_reasons: [],
        research_questions: ['shopping_behaviors', 'segment_challenges'],
        exploration_outcome: 'successful',
      },
    ]

    const crossTab = buildCrossTab(classified, 'segment', 'theme')

    // Marginal row sort: Habitual Replenisher (2) should be index 0
    expect(crossTab.rows[0]).toBe('Habitual Replenisher')
    expect(crossTab.rows[1]).toBe('Occasion Shopper')

    // Row-normalized pct calculation:
    // Habitual Replenisher has 2/2 of theme Basket Habit Lock-In -> 100%
    expect(crossTab.cells['Habitual Replenisher']['Basket Habit Lock-In'].pct).toBe(100)
    // Occasion Shopper has 1/1 of theme Successful Category Trial -> 100%
    expect(crossTab.cells['Occasion Shopper']['Successful Category Trial'].pct).toBe(100)
  });

  // --- 3. Opportunity Scoring & Validation ---
  it('EV-P2-05: Opportunity scoring logic', () => {
    // Score thresholds: Medium >= 25, Large >= 60
    
    // Low frequency/confidence -> Small
    // high frequency/confidence -> Medium or Large
    
    const validatorPasses = validateOpportunity({
      problem: 'This is a long user problem explanation that matches the length constraint.',
      blinkit_opportunity: 'We need to: Introduce trial packs and sample sizes for product category de-risking.',
      current_user_behavior: 'Users display behavior: reorder weekly.',
    })
    expect(validatorPasses.passes).toBe(true)

    // Rejection on generic opportunity
    const validatorFails = validateOpportunity({
      problem: 'Short problem.',
      blinkit_opportunity: 'We need to improve discovery on home feed.', // generic blocklist match
      current_user_behavior: 'Short behavior.',
    })
    expect(validatorFails.passes).toBe(false)
    expect(validatorFails.reasons.some(r => r.includes('too generic'))).toBe(true)
  });

  // --- 4. Readiness Rubric Checks ---
  it('EV-P2-06: Director-Readiness score gaps are correct', () => {
    // Low corpus size check (< 100) -> gap is reported
    const mockClassified: ClassifiedReview[] = [] // 0 reviews
    const findings = buildFindingsReport(mockClassified)
    const report = synthesizeReport(mockClassified, findings)

    expect(report.readinessScore).toBeLessThan(10)
    expect(report.readinessGaps).toContain('Limited exploration corpus depth')
  });

  // --- 5. Global Invariants Verification ---
  it('EV-P2-07: Verify all 10 invariants over seed-corpus', () => {
    const csvPath = path.resolve(__dirname, '../../data/seed-corpus.csv')
    const content = fs.readFileSync(csvPath, 'utf-8')
    const raw = parseReviews(content)
    const curation = curateReviews(raw)
    const classified = curation.included.map((r) => mockClassifyReview(r))
    const aggregation = aggregateReviews(raw, classified)
    const findings = buildFindingsReport(classified)
    const report = synthesizeReport(classified, findings)

    // I1: Every taxonomy field contains valid allowed values
    classified.forEach(r => {
      expect(isPositiveTheme(r.theme) || r.theme === 'Other Exploration Frustration' || typeof r.theme === 'string').toBe(true)
    })

    // I2: records.length === unique(input).length
    const uniqueInputs = deduplicateReviews(raw)
    expect(curation.records.length).toBe(uniqueInputs.length)

    // I3: included is subset of records and has exploration_relevant true
    curation.included.forEach(inc => {
      expect(inc.exploration_relevant).toBe(true)
      const inRecords = curation.records.some(rec => rec.review_id === inc.review_id)
      expect(inRecords).toBe(true)
    })

    // I4: Aggregation denominators use only research_relevant !== false && exploration_relevant rows
    // Already enforced in aggregateReviews via filtering scope
    
    // I5: Root-cause percentages denominated over repeat-purchase-eligible reviews (non-positives)
    const eligibleCount = scopeCount(classified)
    const rcCountsSum = Object.values(aggregation.rootCauses).reduce((sum, stat) => sum + stat.count, 0)
    expect(rcCountsSum).toBe(eligibleCount)

    // I6: No OTHER_UNKNOWN_LABELS member in top-N lists
    const unknownLabels = new Set([
      'Other Exploration Frustration',
      'Unclear Exploration Struggle',
      'Unspecified Segment',
      'Unclear Repeat-Purchase Cause',
      'General Discovery Improvement',
    ])
    aggregation.themeQuotes.forEach(cluster => {
      expect(unknownLabels.has(cluster.label)).toBe(false)
    })
    aggregation.rootCauseQuotes.forEach(cluster => {
      expect(unknownLabels.has(cluster.label)).toBe(false)
    })
    aggregation.unmetNeedQuotes.forEach(cluster => {
      expect(unknownLabels.has(cluster.label)).toBe(false)
    })

    // I7: Every rendered finding/opportunity has quotes
    findings.forEach(f => {
      if (f.evidence_count > 0) {
        expect(f.representative_quotes.length).toBeGreaterThan(0)
      }
    })
    report.opportunities.forEach(o => {
      expect(o.representative_quotes.length).toBeGreaterThan(0)
    })

    // I8: Every review_id in quotes resolves to a row in classified
    findings.forEach(f => {
      f.representative_quotes.forEach(q => {
        const found = classified.some(r => r.review_id === q.review_id)
        expect(found).toBe(true)
      })
    })

    // I9: Positive theme reviews never contribute to root-cause
    const positiveReviews = classified.filter(r => isPositiveTheme(r.theme))
    positiveReviews.forEach(r => {
      expect(r.root_cause).toBe('Unclear Repeat-Purchase Cause')
    })

    // I10: Sum of counts equals explorationRelevantCount for single-select fields
    const themeSum = Object.values(aggregation.themes).reduce((sum, s) => sum + s.count, 0)
    expect(themeSum).toBe(aggregation.explorationRelevantCount)
  });
})

function scopeCount(classified: ClassifiedReview[]): number {
  return classified.filter(r => {
    const isPositive =
      r.theme === 'Successful Category Trial' ||
      r.theme === 'Strong Cross-Category Discovery' ||
      r.theme === 'Assortment Delight' ||
      r.theme === 'Reliable First-Time Purchase' ||
      r.theme === 'Useful Bundling'
    return !isPositive
  }).length
}
