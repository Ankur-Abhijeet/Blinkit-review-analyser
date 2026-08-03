import { db, runMigrations } from './client'
import { Run, ClassifiedReview, Finding, ExecutiveReport, CurationStats, Aggregation, CuratedReview } from '../types'

export const TAXONOMY_VERSION = '1.0.0'

export async function saveRun(run: Run, reviews: ClassifiedReview[]): Promise<void> {
  await runMigrations()

  // 1. Enforce Invariant I8: Write-time check that every quote review_id resolves
  const reviewIds = new Set(reviews.map((r) => r.review_id).filter(Boolean))

  run.findings.forEach((finding) => {
    finding.representative_quotes.forEach((q) => {
      if (!reviewIds.has(q.review_id)) {
        throw new Error(
          `Invariant I8 violated: Quote review_id "${q.review_id}" in finding "${finding.id}" does not exist in classified reviews`,
        )
      }
    })
  })

  run.executive_report.opportunities.forEach((opp) => {
    opp.representative_quotes.forEach((q) => {
      if (!reviewIds.has(q.review_id)) {
        throw new Error(
          `Invariant I8 violated: Quote review_id "${q.review_id}" in opportunity "${opp.id}" does not exist in classified reviews`,
        )
      }
    })
  })

  // Stamp the taxonomy version
  const stampedRun = {
    ...run,
    taxonomy_version: TAXONOMY_VERSION,
  }

  // 2. Insert run metadata
  await db.execute({
    sql: `INSERT OR REPLACE INTO runs (
      id, seq, dataset_name, status, created_at, total_reviews,
      exploration_relevant_count, excluded_count, source_mix, fetch_params,
      curation_stats, aggregation, findings, executive_report,
      readiness_score, readiness_gaps, taxonomy_version, model, provider, mock, environment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      stampedRun.id,
      stampedRun.seq,
      stampedRun.dataset_name,
      stampedRun.status,
      stampedRun.created_at,
      stampedRun.total_reviews,
      stampedRun.exploration_relevant_count,
      stampedRun.excluded_count,
      JSON.stringify(stampedRun.source_mix),
      JSON.stringify(stampedRun.fetch_params),
      JSON.stringify(stampedRun.curation_stats),
      JSON.stringify(stampedRun.aggregation),
      JSON.stringify(stampedRun.findings),
      JSON.stringify(stampedRun.executive_report),
      stampedRun.readiness_score,
      JSON.stringify(stampedRun.readiness_gaps),
      stampedRun.taxonomy_version,
      stampedRun.model,
      stampedRun.provider,
      stampedRun.mock ? 1 : 0,
      stampedRun.environment,
    ],
  })

  // 3. Insert run reviews using batch execution
  // Prepare transaction statements
  const statements = reviews.map((r) => {
    const compositeId = `${stampedRun.id}::${r.review_id}`
    return {
      sql: `INSERT OR REPLACE INTO run_reviews (
        id, run_id, review_id, source, text, rating, date, city, url,
        exploration_relevant, noise_category, outcome, user_goal,
        research_relevant, research_questions, evidence, exploration_outcome,
        theme, barrier, behavior, emotion, segment, root_cause, unmet_need,
        mentioned_categories, confidence, classification_reasons
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: (() => {
        const list = [
          compositeId,
          stampedRun.id,
          r.review_id || 'unknown_id',
          r.source,
          r.text,
          r.rating !== undefined ? r.rating : null,
          r.date || null,
          r.city || null,
          r.url || null,
          r.exploration_relevant ? 1 : 0,
          r.noise_category || null,
          r.outcome || null,
          r.user_goal || null,
          r.research_relevant ? 1 : 0,
          r.research_questions ? JSON.stringify(r.research_questions) : null,
          r.evidence || null,
          r.exploration_outcome || null,
          r.theme || null,
          r.barrier || null,
          r.behavior || null,
          r.emotion || null,
          r.segment || null,
          r.root_cause || null,
          r.unmet_need || null,
          r.mentioned_categories ? JSON.stringify(r.mentioned_categories) : null,
          r.confidence !== undefined ? r.confidence : null,
          r.classification_reasons ? JSON.stringify(r.classification_reasons) : null,
        ]
        list.forEach((val, idx) => {
          if (val === undefined) {
            console.error(`[DB] Param index ${idx} is undefined for review_id: ${r.review_id}`)
          }
        })
        return list
      })(),
    }
  })

  if (statements.length > 0) {
    await db.batch(statements)
  }
}

export async function loadRun(
  id: string,
): Promise<{ run: Run; reviews: ClassifiedReview[] } | null> {
  await runMigrations()

  // 1. Fetch run metadata
  const runRes = await db.execute({
    sql: `SELECT * FROM runs WHERE id = ?`,
    args: [id],
  })

  if (runRes.rows.length === 0) {
    return null
  }

  const row = runRes.rows[0]

  const run: Run = {
    id: String(row.id),
    seq: Number(row.seq),
    dataset_name: String(row.dataset_name),
    status: row.status as Run['status'],
    created_at: String(row.created_at),
    total_reviews: Number(row.total_reviews),
    exploration_relevant_count: Number(row.exploration_relevant_count),
    excluded_count: Number(row.excluded_count),
    source_mix: JSON.parse(String(row.source_mix)),
    fetch_params: JSON.parse(String(row.fetch_params)),
    curation_stats: JSON.parse(String(row.curation_stats)) as CurationStats,
    aggregation: JSON.parse(String(row.aggregation)) as Aggregation,
    findings: JSON.parse(String(row.findings)) as Finding[],
    executive_report: JSON.parse(String(row.executive_report)) as ExecutiveReport,
    readiness_score: Number(row.readiness_score),
    readiness_gaps: JSON.parse(String(row.readiness_gaps)),
    taxonomy_version: String(row.taxonomy_version),
    model: String(row.model),
    provider: String(row.provider),
    mock: Boolean(row.mock),
    environment: row.environment as Run['environment'],
  }

  // 2. Fetch reviews
  const reviewRes = await db.execute({
    sql: `SELECT * FROM run_reviews WHERE run_id = ?`,
    args: [id],
  })

  const reviews: ClassifiedReview[] = reviewRes.rows.map((r) => ({
    review_id: String(r.review_id),
    source: String(r.source),
    text: String(r.text),
    rating: r.rating !== null ? Number(r.rating) : undefined,
    date: r.date !== null ? String(r.date) : undefined,
    city: r.city !== null ? String(r.city) : undefined,
    url: r.url !== null ? String(r.url) : undefined,
    exploration_relevant: Boolean(r.exploration_relevant),
    noise_category: r.noise_category !== null ? (String(r.noise_category) as CuratedReview['noise_category']) : undefined,
    outcome: r.outcome !== null ? (String(r.outcome) as CuratedReview['outcome']) : undefined,
    user_goal: r.user_goal !== null ? String(r.user_goal) : undefined,
    research_relevant: Boolean(r.research_relevant),
    research_questions: JSON.parse(String(r.research_questions)),
    evidence: String(r.evidence),
    exploration_outcome: String(r.exploration_outcome) as ClassifiedReview['exploration_outcome'],
    theme: String(r.theme) as ClassifiedReview['theme'],
    barrier: String(r.barrier) as ClassifiedReview['barrier'],
    behavior: String(r.behavior) as ClassifiedReview['behavior'],
    emotion: String(r.emotion) as ClassifiedReview['emotion'],
    segment: String(r.segment) as ClassifiedReview['segment'],
    root_cause: String(r.root_cause) as ClassifiedReview['root_cause'],
    unmet_need: String(r.unmet_need) as ClassifiedReview['unmet_need'],
    mentioned_categories: JSON.parse(String(r.mentioned_categories)),
    confidence: Number(r.confidence),
    classification_reasons: JSON.parse(String(r.classification_reasons)),
  }))

  return { run, reviews }
}

export async function listRuns(): Promise<Run[]> {
  await runMigrations()

  const runRes = await db.execute({
    sql: `SELECT * FROM runs ORDER BY seq DESC`,
    args: [],
  })

  return runRes.rows.map((row) => ({
    id: String(row.id),
    seq: Number(row.seq),
    dataset_name: String(row.dataset_name),
    status: row.status as Run['status'],
    created_at: String(row.created_at),
    total_reviews: Number(row.total_reviews),
    exploration_relevant_count: Number(row.exploration_relevant_count),
    excluded_count: Number(row.excluded_count),
    source_mix: JSON.parse(String(row.source_mix)),
    fetch_params: JSON.parse(String(row.fetch_params)),
    curation_stats: JSON.parse(String(row.curation_stats)) as CurationStats,
    aggregation: JSON.parse(String(row.aggregation)) as Aggregation,
    findings: JSON.parse(String(row.findings)) as Finding[],
    executive_report: JSON.parse(String(row.executive_report)) as ExecutiveReport,
    readiness_score: Number(row.readiness_score),
    readiness_gaps: JSON.parse(String(row.readiness_gaps)),
    taxonomy_version: String(row.taxonomy_version),
    model: String(row.model),
    provider: String(row.provider),
    mock: Boolean(row.mock),
    environment: row.environment as Run['environment'],
  }))
}

export async function deleteRun(id: string): Promise<void> {
  await runMigrations()
  
  await db.execute({
    sql: `DELETE FROM runs WHERE id = ?`,
    args: [id],
  })
}

export async function getDailyUsage(): Promise<{ tpdConsumed: number; rpdConsumed: number }> {
  await runMigrations()
  const todayPrefix = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'
  const runRes = await db.execute({
    sql: `SELECT * FROM runs WHERE created_at LIKE ?`,
    args: [`${todayPrefix}%`],
  })

  let tpdConsumed = 0
  let rpdConsumed = 0

  for (const row of runRes.rows) {
    const isMock = Boolean(row.mock)
    if (isMock) continue // Skip mock runs as they do not consume real API limits

    const relevantCount = Number(row.exploration_relevant_count)

    // Load reviews to compute estimated tokens
    const reviewsRes = await db.execute({
      sql: `SELECT text FROM run_reviews WHERE run_id = ?`,
      args: [String(row.id)],
    })

    let runTokens = 0
    for (const rRow of reviewsRes.rows) {
      runTokens += Math.ceil(String(rRow.text).length / 4.1)
    }

    // Default batch size is 3 (P9-T02 / LLM_CLASSIFY_BATCH_SIZE)
    const batchSize = 3
    const batchRequests = Math.ceil(relevantCount / batchSize)

    tpdConsumed += runTokens
    rpdConsumed += batchRequests
  }

  return { tpdConsumed, rpdConsumed }
}

