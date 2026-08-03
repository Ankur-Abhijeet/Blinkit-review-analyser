import { ClassifiedReview, Finding, Quote } from './types'
import { RESEARCH_QUESTION_IDS } from './research-questions'
import { OTHER_UNKNOWN_LABELS } from './taxonomy'

function getTopLabel(
  counts: Record<string, number>,
  excludeList: Set<string>,
): { label: string; count: number } {
  let topLabel = 'Unclear'
  let maxCount = -1

  for (const [label, count] of Object.entries(counts)) {
    if (!excludeList.has(label) && count > maxCount) {
      maxCount = count
      topLabel = label
    }
  }

  return { label: topLabel, count: Math.max(0, maxCount) }
}

export function buildFindingsReport(
  classified: ClassifiedReview[],
): Finding[] {
  const scope = classified.filter(
    (r) => r.research_relevant !== false && r.exploration_relevant,
  )

  const totalScopeCount = scope.length

  // Build count mappings for each field
  const barrierCounts: Record<string, number> = {}
  const themeCounts: Record<string, number> = {}
  const behaviorCounts: Record<string, number> = {}
  const rootCauseCounts: Record<string, number> = {}
  const segmentCounts: Record<string, number> = {}
  const unmetNeedCounts: Record<string, number> = {}

  scope.forEach((r) => {
    barrierCounts[r.barrier] = (barrierCounts[r.barrier] || 0) + 1
    themeCounts[r.theme] = (themeCounts[r.theme] || 0) + 1
    behaviorCounts[r.behavior] = (behaviorCounts[r.behavior] || 0) + 1
    segmentCounts[r.segment] = (segmentCounts[r.segment] || 0) + 1
    unmetNeedCounts[r.unmet_need] = (unmetNeedCounts[r.unmet_need] || 0) + 1

    // Root cause is scoped to non-positive themes
    if (!scope.filter((sr) => sr.theme === r.theme).some(() => false)) {
      // isRootCauseEligibleReview helper logic inline
      const isPositive =
        r.theme === 'Successful Category Trial' ||
        r.theme === 'Strong Cross-Category Discovery' ||
        r.theme === 'Assortment Delight' ||
        r.theme === 'Reliable First-Time Purchase' ||
        r.theme === 'Useful Bundling'

      if (!isPositive) {
        rootCauseCounts[r.root_cause] = (rootCauseCounts[r.root_cause] || 0) + 1
      }
    }
  })

  return RESEARCH_QUESTION_IDS.map((qid) => {
    let title = ''
    let description = ''
    let supportingReviews: ClassifiedReview[] = []
    let businessImpact: string[] = []

    if (qid === 'why_exploration_fails') {
      const top = getTopLabel(barrierCounts, OTHER_UNKNOWN_LABELS)
      const pct = totalScopeCount > 0 ? Math.round((top.count / totalScopeCount) * 100) : 0
      title = `Top barrier: ${top.label}`
      description = `Category exploration is primarily blocked by "${top.label}" which affects ${pct}% of exploratory users.`
      supportingReviews = scope.filter((r) => r.barrier === top.label)
      businessImpact = [
        `Reduce friction points associated with: ${top.label}`,
        `Address the exploration barrier affecting ${top.count} users`,
      ]
    } else if (qid === 'top_frustrations') {
      const top = getTopLabel(themeCounts, OTHER_UNKNOWN_LABELS)
      const pct = totalScopeCount > 0 ? Math.round((top.count / totalScopeCount) * 100) : 0
      title = `Primary friction theme: ${top.label}`
      description = `User frustration is dominated by the theme "${top.label}" representing ${pct}% of explore-friction reviews.`
      supportingReviews = scope.filter((r) => r.theme === top.label)
      businessImpact = [
        `Introduce guardrails to mitigate frustration around "${top.label}"`,
        `Improve product feedback loop for the core friction themes`,
      ]
    } else if (qid === 'shopping_behaviors') {
      const top = getTopLabel(behaviorCounts, OTHER_UNKNOWN_LABELS)
      const pct = totalScopeCount > 0 ? Math.round((top.count / totalScopeCount) * 100) : 0
      title = `Dominant shopping pattern: ${top.label}`
      description = `Category discovery is mediated by the "${top.label}" shopping behavior (${pct}% of explore cohort).`
      supportingReviews = scope.filter((r) => r.behavior === top.label)
      businessImpact = [
        `Optimize the path of discovery within the "${top.label}" loop`,
        `Leverage existing behavior to cross-sell adjacent categories`,
      ]
    } else if (qid === 'repeat_purchase_causes') {
      const repeatPurchaseScope = scope.filter((r) => {
        const isPositive =
          r.theme === 'Successful Category Trial' ||
          r.theme === 'Strong Cross-Category Discovery' ||
          r.theme === 'Assortment Delight' ||
          r.theme === 'Reliable First-Time Purchase' ||
          r.theme === 'Useful Bundling'
        return !isPositive
      })
      const top = getTopLabel(rootCauseCounts, OTHER_UNKNOWN_LABELS)
      const pct = repeatPurchaseScope.length > 0 ? Math.round((top.count / repeatPurchaseScope.length) * 100) : 0
      title = `Staples lock-in cause: ${top.label}`
      description = `Repeat purchase cycles are reinforced by "${top.label}" affecting ${pct}% of repeat-buying users.`
      supportingReviews = repeatPurchaseScope.filter((r) => r.root_cause === top.label)
      businessImpact = [
        `Introduce intervention targeting the repeat-purchase cause: ${top.label}`,
        `Break user tunnel-vision routines on checkout rails`,
      ]
    } else if (qid === 'segment_challenges') {
      const top = getTopLabel(segmentCounts, OTHER_UNKNOWN_LABELS)
      const pct = totalScopeCount > 0 ? Math.round((top.count / totalScopeCount) * 100) : 0
      title = `Most affected segment: ${top.label}`
      description = `The cohort expressing the highest discovery friction is the "${top.label}" segment (${pct}% of research pool).`
      supportingReviews = scope.filter((r) => r.segment === top.label)
      businessImpact = [
        `Deliver targeted assortment campaigns for the "${top.label}" segment`,
        `Test segment-specific landing banners and trial incentives`,
      ]
    } else if (qid === 'unmet_needs') {
      const top = getTopLabel(unmetNeedCounts, OTHER_UNKNOWN_LABELS)
      const pct = totalScopeCount > 0 ? Math.round((top.count / totalScopeCount) * 100) : 0
      title = `Primary unmet need: ${top.label}`
      description = `Users express a strong demand for "${top.label}" as the key trust bridge to trying new categories (${pct}% of needs).`
      supportingReviews = scope.filter((r) => r.unmet_need === top.label)
      businessImpact = [
        `Implement trust signal interventions matching the unmet need: ${top.label}`,
        `De-risk first trials using returning guarantees and transparent details`,
      ]
    }

    // Sort supporting reviews by confidence descending for quote selection
    const sortedReviews = [...supportingReviews].sort((a, b) => b.confidence - a.confidence)

    // Select top 3-5 quotes
    const representative_quotes: Quote[] = sortedReviews.slice(0, 5).map((r, idx) => ({
      review_id: r.review_id || `${qid}_q_${idx}`,
      source: r.source,
      text: r.text,
      segment: r.segment,
      theme: r.theme,
      confidence: r.confidence,
      barrier: r.barrier,
      root_cause: r.root_cause,
      unmet_need: r.unmet_need,
    }))

    // Calculate source distribution for supporting reviews
    const uniqueSources = new Set(supportingReviews.map((r) => r.source))
    const source_count = uniqueSources.size

    // Calculate average confidence score
    const totalConfidence = supportingReviews.reduce((sum, r) => sum + r.confidence, 0)
    const confidence_score =
      supportingReviews.length > 0 ? totalConfidence / supportingReviews.length : 0

    // Grade confidence
    const confidence: Finding['confidence'] =
      confidence_score >= 0.75 ? 'High' : confidence_score >= 0.6 ? 'Medium' : 'Low'

    // Grade evidence strength (16.4 formula)
    const evidence_strength: Finding['evidence_strength'] =
      supportingReviews.length >= 20 && source_count >= 3
        ? 'Strong'
        : supportingReviews.length >= 10 && source_count >= 2
          ? 'Medium'
          : 'Weak'

    // Collect affected segments
    const uniqueSegments = Array.from(new Set(supportingReviews.map((r) => r.segment)))

    return {
      id: qid,
      title,
      description,
      evidence_count: supportingReviews.length,
      affected_segments: uniqueSegments,
      representative_quotes,
      confidence,
      confidence_score: Math.round(confidence_score * 100) / 100,
      evidence_strength,
      source_count,
      business_impact: businessImpact,
    }
  })
}
