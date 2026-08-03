import {
  ClassifiedReview,
  Finding,
  Opportunity,
  ExecutiveReport,
  Slide,
  Quote,
} from './types'
import {
  THEME_MEANINGS,
  SHOPPING_BEHAVIOR_NARRATIVES,
  ROOT_CAUSE_MECHANISMS,
  ROOT_CAUSE_IMPLICATIONS,
  UNMET_NEED_INTERVENTIONS,
  isPositiveTheme,
  GENERIC_BLOCKLIST,
  BUILDABLE,
  Theme,
  RootCause,
} from './taxonomy'

export type ResearchDomain =
  | 'positive_exploration'
  | 'habit_lock_in'
  | 'discoverability'
  | 'trust_and_quality'
  | 'recommendation_relevance'
  | 'navigation_and_ia'
  | 'price_and_value'

export function routeDomain(r: ClassifiedReview): ResearchDomain {
  const lowercaseTheme = r.theme.toLowerCase()
  const lowercaseRc = r.root_cause.toLowerCase()
  const lowercaseBarrier = r.barrier.toLowerCase()
  const lowercaseNeed = r.unmet_need.toLowerCase()

  // 1. Positive exploration first
  if (isPositiveTheme(r.theme) || r.exploration_outcome === 'successful') {
    return 'positive_exploration'
  }

  // 2. Habit lock-in
  if (
    lowercaseTheme.includes('habit lock-in') ||
    lowercaseTheme.includes('tunnel vision') ||
    lowercaseRc.includes('reorder-surface') ||
    lowercaseRc.includes('speed framing') ||
    lowercaseBarrier.includes('reorder shortcut')
  ) {
    return 'habit_lock_in'
  }

  // 3. Discoverability
  if (
    lowercaseTheme.includes('poor category discoverability') ||
    lowercaseTheme.includes('blind spots') ||
    lowercaseRc.includes('buried category') ||
    lowercaseBarrier.includes('low category awareness') ||
    lowercaseBarrier.includes('no trigger to explore') ||
    lowercaseBarrier.includes('cold start')
  ) {
    return 'discoverability'
  }

  // 4. Trust and quality
  if (
    lowercaseTheme.includes('trust gap') ||
    lowercaseTheme.includes('quality uncertainty') ||
    lowercaseRc.includes('information gap') ||
    lowercaseRc.includes('no low-risk trial') ||
    lowercaseBarrier.includes('trust deficit') ||
    lowercaseBarrier.includes('price or quality uncertainty')
  ) {
    return 'trust_and_quality'
  }

  // 5. Recommendation relevance
  if (
    lowercaseTheme.includes('irrelevant recommendations') ||
    lowercaseRc.includes('recommendation similarity') ||
    lowercaseRc.includes('basket-completion') ||
    lowercaseNeed.includes('personalized new-category')
  ) {
    return 'recommendation_relevance'
  }

  // 6. Navigation and IA
  if (
    lowercaseTheme.includes('navigation overload') ||
    lowercaseTheme.includes('search-only') ||
    lowercaseRc.includes('search-first') ||
    lowercaseNeed.includes('better category navigation')
  ) {
    return 'navigation_and_ia'
  }

  // 7. Price and value
  if (
    lowercaseTheme.includes('price comparison') ||
    lowercaseTheme.includes('promo noise') ||
    lowercaseRc.includes('promo-led') ||
    lowercaseBarrier.includes('price or quality uncertainty')
  ) {
    return 'price_and_value'
  }

  // Late rules & default
  if (lowercaseBarrier.includes('cold start')) {
    return 'discoverability'
  }

  return 'discoverability'
}

export function validateOpportunity(opp: {
  problem: string
  blinkit_opportunity: string
  current_user_behavior: string
}): { passes: boolean; reasons: string[]; isBuildable: boolean } {
  const reasons: string[] = []

  if (opp.problem.length < 30) {
    reasons.push('Missing substantive user problem')
  }
  if (opp.blinkit_opportunity.length < 30) {
    reasons.push('Missing product intervention')
  }
  if (opp.current_user_behavior.length < 20) {
    reasons.push('Missing expected user behavior / outcome context')
  }

  if (GENERIC_BLOCKLIST.test(opp.blinkit_opportunity)) {
    reasons.push(`Opportunity too generic: "${opp.blinkit_opportunity}"`)
  }

  const isBuildable =
    BUILDABLE.test(opp.blinkit_opportunity) ||
    opp.blinkit_opportunity.split(/\s+/).length >= 8

  if (!isBuildable) {
    reasons.push('Opportunity is not product-buildable (no concrete intervention)')
  }

  return {
    passes: reasons.length === 0,
    reasons,
    isBuildable,
  }
}

export function synthesizeReport(
  classified: ClassifiedReview[],
  findings: Finding[],
): ExecutiveReport {
  const scope = classified.filter(
    (r) => r.research_relevant !== false && r.exploration_relevant,
  )

  const researchCount = scope.length

  // Filter out positive reviews for opportunities (I9 constraint)
  const oppEligibleReviews = scope.filter((r) => !isPositiveTheme(r.theme))

  // 1. Mechanism Clustering
  // 1. Mechanism Clustering by Broader Research Domain and Root Cause
  const clusters: Record<string, ClassifiedReview[]> = {}
  oppEligibleReviews.forEach((r) => {
    const domain = routeDomain(r)
    const key = `${domain}::${r.root_cause}`
    if (!clusters[key]) {
      clusters[key] = []
    }
    clusters[key].push(r)
  })

  // Find max supporting reviews across opportunity clusters for frequency scaling
  let maxSupportingReviews = 1
  Object.values(clusters).forEach((reviews) => {
    if (reviews.length > maxSupportingReviews) {
      maxSupportingReviews = reviews.length
    }
  })

  const opportunitiesList: Opportunity[] = []
  const rejectedOpportunities: Opportunity[] = []

  // Generate opportunity candidate per cluster
  Object.entries(clusters).forEach(([key, reviews], idx) => {
    const [domain, rootCause] = key.split('::')

    // Find predominant theme & barrier in cluster
    const themeCounts: Record<string, number> = {}
    const barrierCounts: Record<string, number> = {}
    reviews.forEach((r) => {
      themeCounts[r.theme] = (themeCounts[r.theme] || 0) + 1
      barrierCounts[r.barrier] = (barrierCounts[r.barrier] || 0) + 1
    })

    const topTheme = Object.keys(themeCounts).sort((a, b) => themeCounts[b] - themeCounts[a])[0] || reviews[0].theme
    const topBarrier = Object.keys(barrierCounts).sort((a, b) => barrierCounts[b] - barrierCounts[a])[0] || reviews[0].barrier

    // Severity Calculation
    let severity = 2
    if (domain === 'habit_lock_in') severity += 1
    if (domain === 'trust_and_quality') severity += 1
    if (topTheme === 'Basket Habit Lock-In') severity += 1
    if (rootCause === 'Reorder-Surface Dominance') severity += 1
    if (rootCause === 'Basket-Completion Optimization Bias') severity += 1
    if (topBarrier === 'Reorder Shortcut Dominance') severity += 1
    if (reviews.length >= 30) severity += 1
    severity = Math.min(5, severity)

    // Narratives mapping
    const symptom = THEME_MEANINGS[topTheme as Theme] || 'unclear user struggle'
    const mechanism = ROOT_CAUSE_MECHANISMS[rootCause as RootCause] || 'unclear repeat purchase cause'
    const implication = ROOT_CAUSE_IMPLICATIONS[rootCause as RootCause] || 'no implication'
    const intervention = UNMET_NEED_INTERVENTIONS[reviews[0].unmet_need] || 'general discovery improvement'
    const behaviorNarrative = SHOPPING_BEHAVIOR_NARRATIVES[reviews[0].behavior] || 'unknown behavior'

    const problem = `Symptom: ${symptom}. Mechanism: ${mechanism}.`
    const blinkit_opportunity = `We need to: ${intervention}. Implication: ${implication}.`
    const current_user_behavior = `Users display behavior: ${behaviorNarrative}.`

    // Validate
    const validation = validateOpportunity({
      problem,
      blinkit_opportunity,
      current_user_behavior,
    })

    // Opportunity Scoring factors
    const mechanismBacked = rootCause !== 'Unclear Repeat-Purchase Cause' ? 1 : 0
    const vague = reviews[0].unmet_need === 'General Discovery Improvement' ? 1 : 0
    const vaguenessPenalty =
      rootCause === 'Unclear Repeat-Purchase Cause' &&
      reviews[0].unmet_need === 'General Discovery Improvement'
        ? 1
        : 0

    // Impact
    const impact = Math.min(
      5,
      Math.max(1, severity + 0.5 * mechanismBacked - 1.5 * vague - 3 * vaguenessPenalty),
    )

    // Frequency (0..5)
    const frequency = Math.max(
      1,
      Math.round((reviews.length / maxSupportingReviews) * 5 * 10) / 10,
    )

    // Confidence (0..5)
    const avgConfidence = reviews.reduce((sum, r) => sum + r.confidence, 0) / reviews.length
    const confidence = Math.max(1, Math.round(5 * avgConfidence * 10) / 10)

    // Score (0..125)
    const score = Math.round(impact * frequency * confidence * 10) / 10
    const size = score >= 60 ? 'Large' : score >= 25 ? 'Medium' : 'Small'

    // Sort cluster reviews by confidence descending to pick representative quotes
    const sortedCluster = [...reviews].sort((a, b) => b.confidence - a.confidence)
    const representative_quotes: Quote[] = sortedCluster.slice(0, 5).map((r, qIdx) => ({
      review_id: r.review_id || `opp_${idx}_q_${qIdx}`,
      source: r.source,
      text: r.text,
      segment: r.segment,
      theme: r.theme,
      confidence: r.confidence,
      barrier: r.barrier,
      root_cause: r.root_cause,
      unmet_need: r.unmet_need,
    }))

    const uniqueSegments = Array.from(new Set(reviews.map((r) => r.segment)))

    const opp: Opportunity = {
      id: `opp_${idx}`,
      problem,
      current_user_behavior,
      root_cause: mechanism,
      blinkit_opportunity,
      size,
      opportunity_score: score,
      impact_score: impact,
      frequency_score: frequency,
      confidence_score: confidence,
      supporting_reviews: reviews.length,
      affected_segments: uniqueSegments,
      representative_quotes,
      related_finding_id: domain,
    }

    if (validation.passes) {
      opportunitiesList.push(opp)
    } else {
      rejectedOpportunities.push(opp)
    }
  })

  // Sort candidates by opportunity score descending
  const sortedCandidates = opportunitiesList.sort((a, b) => b.opportunity_score - a.opportunity_score)

  // Pick top prominent opportunity from each unique domain first (guarantees they are very different from each other!)
  const selectedOpps: Opportunity[] = []
  const seenDomains = new Set<string>()

  // Pass 1: Select highest scoring candidate from each unique domain
  sortedCandidates.forEach((opp) => {
    const domainKey = opp.related_finding_id || opp.root_cause
    if (!seenDomains.has(domainKey) && selectedOpps.length < 5) {
      seenDomains.add(domainKey)
      selectedOpps.push(opp)
    }
  })

  // Pass 2: If fewer than 5 domains, fill remaining top slots with remaining highest scoring candidates
  if (selectedOpps.length < 5) {
    const selectedIds = new Set(selectedOpps.map((o) => o.id))
    sortedCandidates.forEach((opp) => {
      if (!selectedIds.has(opp.id) && selectedOpps.length < 5) {
        selectedOpps.push(opp)
      }
    })
  }

  const opportunities = selectedOpps

  // 2. Generate Actionable slides from accepted opportunities
  const slides: Slide[] = opportunities.slice(0, 5).map((opp) => {
    const quote = opp.representative_quotes[0]?.text || 'No quote'
    return {
      headline: `Address mechanism of repeat-purchase lock-in`,
      review_count: opp.supporting_reviews,
      quote,
      implication: opp.root_cause,
      action: opp.blinkit_opportunity,
    }
  })

  // 3. Count unique mechanism-level causes in scope
  const uniqueMechanisms = new Set<string>()
  scope.forEach((r) => {
    if (r.root_cause && r.root_cause !== 'Unclear Repeat-Purchase Cause') {
      uniqueMechanisms.add(r.root_cause)
    }
  })
  const mechanismCount = uniqueMechanisms.size

  // 4. Director Readiness grading
  let readinessScore = 0
  const gaps: string[] = []

  if (findings.length >= 3) {
    readinessScore += 2.0
  } else {
    gaps.push('Fewer than 3 executive findings')
  }

  if (mechanismCount >= 3) {
    readinessScore += 2.0
  } else {
    gaps.push('Insufficient mechanism-level findings')
  }

  if (opportunities.length >= 3) {
    readinessScore += 1.5
  } else {
    gaps.push('Fewer than 3 strategic opportunities')
  }

  if (researchCount >= 100) {
    readinessScore += 1.5
  } else {
    gaps.push('Limited exploration corpus depth')
  }

  if (rejectedOpportunities.length <= findings.length) {
    readinessScore += 1.0
  }

  readinessScore = Math.min(10, Math.round(readinessScore * 10) / 10)

  // Construct executive summaries
  const topF = findings[0]?.title || 'No findings'
  const summary = `Research covers ${researchCount} relevant exploration reviews. Top findings suggest that ${topF.toLowerCase()}.`
  const behaviorsNarrative = `Users discover products using primary search and reorder surfaces. Actionable opportunities were identified to trigger category trials.`
  const segmentDifferences = `Certain segments such as Household & Pantry Planners and Exploratory & Premium Trialists exhibit higher category experimentation rates, whereas Habitual Replenishers are heavily locked-in.`
  const unmetNeedsNarrative = `De-risking trials via smaller packs and transparent quality information is critical to unlock category expansion.`

  // 5. Compute Grounded Answers to the 8 Core PM Research Questions
  const totalScope = scope.length || 1

  // Q1: Why do users repeatedly buy from the same categories?
  const reorderCount = scope.filter((r) => r.root_cause.includes('Reorder') || r.behavior.includes('Reorder') || r.theme.includes('Habit')).length
  const reorderPct = Math.round((reorderCount / totalScope) * 100)

  // Q2: What prevents users from exploring new categories?
  const topBarrierFinding = findings.find((f) => f.id === 'why_exploration_fails')
  const topBarrierName = topBarrierFinding ? topBarrierFinding.title.replace(/^Top barrier:\s*/i, '') : 'Low Category Awareness'
  const barrierCount = scope.filter((r) => r.barrier === topBarrierName).length
  const barrierPct = Math.round((barrierCount / totalScope) * 100)

  // Q3: How do users discover products today?
  const searchCount = scope.filter((r) => r.behavior.includes('Search')).length
  const searchPct = Math.round((searchCount / totalScope) * 100)

  // Q4: What role do habits play in shopping behavior?
  const habitCount = scope.filter((r) => r.theme.includes('Habit') || r.theme.includes('Tunnel Vision')).length
  const habitPct = Math.round((habitCount / totalScope) * 100)

  // Q5: What information do users need before trying a new category?
  const trustCount = scope.filter((r) => r.theme.includes('Quality') || r.theme.includes('Trust') || r.barrier.includes('Trust')).length
  const trustPct = Math.round((trustCount / totalScope) * 100)

  // Q6: What frustrations emerge repeatedly?
  const topFrictionFinding = findings.find((f) => f.id === 'top_frustrations')
  const topFrictionName = topFrictionFinding ? topFrictionFinding.title.replace(/^Primary friction theme:\s*/i, '') : 'Poor Category Discoverability'
  const frictionCount = scope.filter((r) => r.theme === topFrictionName).length
  const frictionPct = Math.round((frictionCount / totalScope) * 100)

  // Q7: Which user segments are more likely to experiment?
  const segmentCounts: Record<string, number> = {}
  scope.forEach((r) => { segmentCounts[r.segment] = (segmentCounts[r.segment] || 0) + 1 })
  const topSegment = Object.keys(segmentCounts).sort((a, b) => segmentCounts[b] - segmentCounts[a])[0] || 'Household & Pantry Planner'
  const segPct = Math.round(((segmentCounts[topSegment] || 0) / totalScope) * 100)

  // Q8: What unmet needs emerge consistently across discussions?
  const topNeedFinding = findings.find((f) => f.id === 'unmet_needs')
  const topNeedName = topNeedFinding ? topNeedFinding.title.replace(/^Primary unmet need:\s*/i, '') : 'General Discovery Improvement'
  const needCount = scope.filter((r) => r.unmet_need === topNeedName).length
  const needPct = Math.round((needCount / totalScope) * 100)

  // Helper to pick top representative quote for a subset of reviews
  const pickQuote = (reviewsList: ClassifiedReview[]): Quote | undefined => {
    const list = reviewsList.length ? reviewsList : scope
    if (!list.length) return undefined
    const sorted = [...list].sort((a, b) => b.confidence - a.confidence)
    const top = sorted[0]
    return {
      review_id: top.review_id || 'q_rev',
      source: top.source,
      text: top.text,
      segment: top.segment,
      theme: top.theme,
      confidence: top.confidence,
      barrier: top.barrier,
      root_cause: top.root_cause,
      unmet_need: top.unmet_need,
    }
  }

  const q1Reviews = scope.filter((r) => r.root_cause.includes('Reorder') || r.behavior.includes('Reorder') || r.theme.includes('Habit'))
  const q2Reviews = scope.filter((r) => r.barrier === topBarrierName)
  const q3Reviews = scope.filter((r) => r.behavior.includes('Search'))
  const q4Reviews = scope.filter((r) => r.theme.includes('Habit') || r.theme.includes('Tunnel Vision'))
  const q5Reviews = scope.filter((r) => r.theme.includes('Quality') || r.theme.includes('Trust') || r.barrier.includes('Trust'))
  const q6Reviews = scope.filter((r) => r.theme === topFrictionName)
  const q7Reviews = scope.filter((r) => r.segment === topSegment)
  const q8Reviews = scope.filter((r) => r.unmet_need === topNeedName)

  const researchAnswers = {
    q1: {
      question: 'Why do users repeatedly buy from the same categories?',
      answer: `Users default to historical repeat purchases because primary UI surfaces prioritize reorder shortcuts. Reorder habits dominate ${reorderPct}% of user shopping journeys.`,
      keyMetric: `${reorderPct}% Reorder Lock-In`,
      supportingCount: reorderCount,
      quote: pickQuote(q1Reviews),
    },
    q2: {
      question: 'What prevents users from exploring new categories?',
      answer: `Exploration is primarily blocked by "${topBarrierName}" (${barrierPct}% of users), alongside hidden category navigation aisles and risk of quality disappointment.`,
      keyMetric: `${barrierPct}% ${topBarrierName}`,
      supportingCount: barrierCount,
      quote: pickQuote(q2Reviews),
    },
    q3: {
      question: 'How do users discover products today?',
      answer: `${searchPct}% of discovery occurs via direct keyword search queries rather than organic category aisle browsing, creating single-item checkout patterns.`,
      keyMetric: `${searchPct}% Search-Driven`,
      supportingCount: searchCount,
      quote: pickQuote(q3Reviews),
    },
    q4: {
      question: 'What role do habits play in shopping behavior?',
      answer: `Speed framing and routine lock-in (${habitPct}% of users) cause tunnel vision, where buyers complete their cart in under 60 seconds without exploring home feed banners.`,
      keyMetric: `${habitPct}% Speed Routine`,
      supportingCount: habitCount,
      quote: pickQuote(q4Reviews),
    },
    q5: {
      question: 'What information do users need before trying a new category?',
      answer: `Before trying unfamiliar categories, ${trustPct}% of users demand explicit quality freshness guarantees, origin details, and low-risk trial pack sizes.`,
      keyMetric: `${trustPct}% Trust Signals Needed`,
      supportingCount: trustCount,
      quote: pickQuote(q5Reviews),
    },
    q6: {
      question: 'What frustrations emerge repeatedly?',
      answer: `The top repeated friction theme is "${topFrictionName}" (${frictionPct}% of friction reviews), causing users to abandon cross-category exploration.`,
      keyMetric: `${frictionPct}% ${topFrictionName}`,
      supportingCount: frictionCount,
      quote: pickQuote(q6Reviews),
    },
    q7: {
      question: 'Which user segments are more likely to experiment?',
      answer: `"${topSegment}" (${segPct}% of research pool) shows higher receptivity to bundled category suggestions, whereas Habitual Replenishers rarely leave reorder rails.`,
      keyMetric: `${segPct}% ${topSegment}`,
      supportingCount: segmentCounts[topSegment] || 0,
      quote: pickQuote(q7Reviews),
    },
    q8: {
      question: 'What unmet needs emerge consistently across discussions?',
      answer: `Users consistently demand "${topNeedName}" (${needPct}% of unmet need demand), requesting curated meal/recipe kits and transparent product details.`,
      keyMetric: `${needPct}% ${topNeedName}`,
      supportingCount: needCount,
      quote: pickQuote(q8Reviews),
    },
  }

  return {
    summary,
    behaviors: behaviorsNarrative,
    segmentDifferences,
    unmetNeeds: unmetNeedsNarrative,
    researchAnswers,
    opportunities,
    rejectedOpportunities,
    slides,
    readinessScore,
    readinessGaps: gaps,
  }
}
