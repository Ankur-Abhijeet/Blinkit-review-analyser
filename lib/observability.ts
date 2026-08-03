import { ClassifiedReview } from './types'

export type EvidenceStrength = 'strong' | 'medium' | 'weak'

/**
 * Calculates evidence strength grading per finding based on count and source diversity (P8-T01).
 * Rubric:
 * - strong: count >= 20 and sources >= 3
 * - medium: count >= 10 and sources >= 2
 * - weak: otherwise
 */
export function calculateEvidenceStrength(count: number, sourcesCount: number): EvidenceStrength {
  if (count >= 20 && sourcesCount >= 3) {
    return 'strong'
  }
  if (count >= 10 && sourcesCount >= 2) {
    return 'medium'
  }
  return 'weak'
}

export interface ReadinessResult {
  score: number
  gaps: string[]
  grade: 'Director-Ready' | 'Needs Hardening' | 'Insufficient Evidence'
}

/**
 * Calculates Director-Readiness score (0-100) and gap text based on corpus size, diversity, and confidence (P8-T02).
 */
export function calculateReadinessScore(
  totalReviews: number,
  explorationRelevantCount: number,
  sourcesCount: number,
  classifiedReviews: ClassifiedReview[],
): ReadinessResult {
  const gaps: string[] = []
  let score = 100

  // 1. Corpus size check
  if (totalReviews < 50) {
    score -= 25
    gaps.push(`Low sample size: Total ingested reviews (${totalReviews}) is below recommended threshold of 50.`)
  }

  // 2. Exploration relevant count check
  if (explorationRelevantCount < 15) {
    score -= 30
    gaps.push(`Insufficient research evidence: Only ${explorationRelevantCount} reviews survived domain curation.`)
  }

  // 3. Source diversity check
  if (sourcesCount < 3) {
    score -= 20
    gaps.push(`Single/dual-source dominance: Evidence collected from only ${sourcesCount} source(s). Minimum 3 sources recommended.`)
  }

  // 4. Mean confidence check
  const confidences = classifiedReviews.map((r) => r.confidence).filter((c): c is number => c !== undefined && !isNaN(c))
  const meanConf = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0

  if (meanConf < 0.75) {
    score -= 15
    gaps.push(`Low classification confidence: Mean confidence score is ${(meanConf * 100).toFixed(1)}% (below 75% target).`)
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)))
  let grade: ReadinessResult['grade'] = 'Director-Ready'

  if (finalScore < 60) {
    grade = 'Insufficient Evidence'
  } else if (finalScore < 80) {
    grade = 'Needs Hardening'
  }

  return {
    score: finalScore,
    gaps,
    grade,
  }
}

export interface DriftAlarm {
  metric: string
  severity: 'warning' | 'critical'
  details: string
}

/**
 * Evaluates drift alarms by comparing current curation keep-rate and mean confidence against baseline (P8-T09).
 */
export function evaluateDriftAlarms(
  currentKeepRate: number,
  currentMeanConfidence: number,
  baselineKeepRate = 0.12,
  baselineConfidence = 0.85,
): DriftAlarm[] {
  const alarms: DriftAlarm[] = []

  if (currentKeepRate < baselineKeepRate * 0.5) {
    alarms.push({
      metric: 'Curation Keep-Rate Drop',
      severity: 'critical',
      details: `Curation keep-rate fell to ${(currentKeepRate * 100).toFixed(1)}% (baseline: ${(baselineKeepRate * 100).toFixed(1)}%). Possible collector markup drift or noise surge.`,
    })
  }

  if (currentMeanConfidence < baselineConfidence - 0.15) {
    alarms.push({
      metric: 'Mean Confidence Shift',
      severity: 'warning',
      details: `Mean classification confidence dropped to ${(currentMeanConfidence * 100).toFixed(1)}% (baseline: ${(baselineConfidence * 100).toFixed(1)}%). Prompt or model output drift detected.`,
    })
  }

  return alarms
}

/**
 * Structured logger for batch metrics and cache performance (P8-T05).
 */
export function logBatchMetrics(event: {
  batchSize: number
  latencyMs: number
  tokensIn: number
  tokensOut: number
  retries: number
  cacheHitRatio: number
}): void {
  console.log('[OBSERVABILITY]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  }))
}
