import {
  RawReview,
  ClassifiedReview,
  Aggregation,
  LabelStat,
  CrossTab,
  Quote,
  QuoteCluster,
  SourceId,
} from './types'
import {
  THEMES,
  BARRIERS,
  SHOPPING_BEHAVIORS,
  EMOTIONS,
  SEGMENTS,
  ROOT_CAUSES,
  UNMET_NEEDS,
  OTHER_UNKNOWN_LABELS,
  isRootCauseEligibleReview,
} from './taxonomy'

function buildDistribution<T extends string>(
  rows: ClassifiedReview[],
  field: keyof ClassifiedReview,
  allowedValues: readonly T[],
  denominator: number,
): Record<T, LabelStat> {
  const counts = {} as Record<T, number>
  allowedValues.forEach((val) => {
    counts[val] = 0
  })

  rows.forEach((r) => {
    const val = r[field] as T
    if (counts[val] !== undefined) {
      counts[val]++
    }
  })

  const dist = {} as Record<T, LabelStat>
  allowedValues.forEach((val) => {
    const count = counts[val]
    const pct = denominator > 0 ? Math.round((count / denominator) * 100 * 10) / 10 : 0
    dist[val] = { count, pct }
  })

  return dist
}

export function buildCrossTab(
  rows: ClassifiedReview[],
  rowField: keyof ClassifiedReview,
  colField: keyof ClassifiedReview,
): CrossTab {
  const rowCounts: Record<string, number> = {}
  const colCounts: Record<string, number> = {}
  const cellCounts: Record<string, Record<string, number>> = {}

  // Pass 1: Accumulate counts
  rows.forEach((r) => {
    const rowVal = String(r[rowField] || '_')
    const colVal = String(r[colField] || '_')

    rowCounts[rowVal] = (rowCounts[rowVal] || 0) + 1
    colCounts[colVal] = (colCounts[colVal] || 0) + 1

    if (!cellCounts[rowVal]) {
      cellCounts[rowVal] = {}
    }
    cellCounts[rowVal][colVal] = (cellCounts[rowVal][colVal] || 0) + 1
  })

  // Sort rows and columns by marginal frequency descending
  const sortedRows = Object.keys(rowCounts).sort((a, b) => rowCounts[b] - rowCounts[a])
  const sortedCols = Object.keys(colCounts).sort((a, b) => colCounts[b] - colCounts[a])

  // Pass 2: Row-normalize
  const cells: Record<string, Record<string, LabelStat>> = {}
  sortedRows.forEach((rVal) => {
    cells[rVal] = {}
    const rowTotal = rowCounts[rVal]
    sortedCols.forEach((cVal) => {
      const count = cellCounts[rVal]?.[cVal] || 0
      const pct = rowTotal > 0 ? Math.round((count / rowTotal) * 100 * 10) / 10 : 0
      cells[rVal][cVal] = { count, pct }
    })
  })

  return {
    rows: sortedRows,
    cols: sortedCols,
    cells,
  }
}

export function buildQuoteClusters(
  rows: ClassifiedReview[],
  field: keyof ClassifiedReview,
  allowedValues: readonly string[],
  topN = 5,
): QuoteCluster[] {
  // Compute frequency of each label (excluding OTHER_UNKNOWN_LABELS for top-N ranking)
  const labelCounts: Record<string, number> = {}
  allowedValues.forEach((val) => {
    if (!OTHER_UNKNOWN_LABELS.has(val)) {
      labelCounts[val] = 0
    }
  })

  rows.forEach((r) => {
    const val = String(r[field])
    if (labelCounts[val] !== undefined) {
      labelCounts[val]++
    }
  })

  // Get top N active labels
  const sortedLabels = Object.keys(labelCounts)
    .filter((l) => labelCounts[l] > 0)
    .sort((a, b) => labelCounts[b] - labelCounts[a])
    .slice(0, topN)

  const totalDenominator = rows.length

  return sortedLabels.map((label) => {
    // Filter rows with this label
    const matchingRows = rows.filter((r) => String(r[field]) === label)

    // Sort by confidence descending
    const sortedRows = [...matchingRows].sort((a, b) => b.confidence - a.confidence)

    // Take top 5 quotes
    const quotes: Quote[] = sortedRows.slice(0, 5).map((r, idx) => ({
      review_id: r.review_id || `q_${label.replace(/\s+/g, '_')}_${idx}`,
      source: r.source,
      text: r.text,
      segment: r.segment,
      theme: r.theme,
      confidence: r.confidence,
      barrier: r.barrier,
      root_cause: r.root_cause,
      unmet_need: r.unmet_need,
    }))

    const count = labelCounts[label]
    const pct = totalDenominator > 0 ? Math.round((count / totalDenominator) * 100 * 10) / 10 : 0

    return {
      label,
      count,
      pct,
      quotes,
    }
  })
}

export function aggregateReviews(
  allReviews: RawReview[],
  classified: ClassifiedReview[],
): Aggregation {
  // Filter for scope (I4: research_relevant !== false && exploration_relevant)
  const scope = classified.filter(
    (r) => r.research_relevant !== false && r.exploration_relevant,
  )

  const totalReviews = allReviews.length
  const explorationRelevantCount = scope.length
  const excludedCount = totalReviews - explorationRelevantCount

  // Regular distributions (denominated over explorationRelevantCount)
  const themes = buildDistribution(scope, 'theme', THEMES, explorationRelevantCount)
  const barriers = buildDistribution(scope, 'barrier', BARRIERS, explorationRelevantCount)
  const behaviors = buildDistribution(
    scope,
    'behavior',
    SHOPPING_BEHAVIORS,
    explorationRelevantCount,
  )
  const emotions = buildDistribution(scope, 'emotion', EMOTIONS, explorationRelevantCount)
  const segments = buildDistribution(scope, 'segment', SEGMENTS, explorationRelevantCount)
  const unmetNeeds = buildDistribution(scope, 'unmet_need', UNMET_NEEDS, explorationRelevantCount)

  // Root cause distribution (denominated over repeat-purchase-eligible reviews)
  const repeatPurchaseScope = scope.filter((r) => isRootCauseEligibleReview(r.theme))
  const rootCauses = buildDistribution(
    repeatPurchaseScope,
    'root_cause',
    ROOT_CAUSES,
    repeatPurchaseScope.length,
  )

  // Category mentions
  const catCounts: Record<string, number> = {}
  scope.forEach((r) => {
    if (r.mentioned_categories) {
      r.mentioned_categories.forEach((cat) => {
        catCounts[cat] = (catCounts[cat] || 0) + 1
      })
    }
  })
  const categoryMentions: Record<string, LabelStat> = {}
  Object.entries(catCounts).forEach(([cat, count]) => {
    categoryMentions[cat] = {
      count,
      pct:
        explorationRelevantCount > 0
          ? Math.round((count / explorationRelevantCount) * 100 * 10) / 10
          : 0,
    }
  })

  // Cross tab segment by theme
  const segmentByTheme = buildCrossTab(scope, 'segment', 'theme')

  // Quote clusters
  const themeQuotes = buildQuoteClusters(scope, 'theme', THEMES)
  const rootCauseQuotes = buildQuoteClusters(scope, 'root_cause', ROOT_CAUSES)
  const unmetNeedQuotes = buildQuoteClusters(scope, 'unmet_need', UNMET_NEEDS)

  // Source distribution
  const sourceDistribution: Record<SourceId, number> = {}
  scope.forEach((r) => {
    sourceDistribution[r.source] = (sourceDistribution[r.source] || 0) + 1
  })

  return {
    totalReviews,
    explorationRelevantCount,
    excludedCount,
    themes,
    barriers,
    behaviors,
    emotions,
    segments,
    rootCauses,
    unmetNeeds,
    categoryMentions,
    segmentByTheme,
    themeQuotes,
    rootCauseQuotes,
    unmetNeedQuotes,
    sourceDistribution,
  }
}
