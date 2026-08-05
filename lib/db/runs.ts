import { query, transaction, runMigrations, type Row } from './client'
import { Run, ClassifiedReview, Finding, ExecutiveReport, CurationStats, Aggregation, CuratedReview } from '../types'

export const TAXONOMY_VERSION = '1.0.0'

const RUN_COLUMNS = [
  'id',
  'seq',
  'dataset_name',
  'status',
  'created_at',
  'total_reviews',
  'exploration_relevant_count',
  'excluded_count',
  'source_mix',
  'fetch_params',
  'curation_stats',
  'aggregation',
  'findings',
  'executive_report',
  'readiness_score',
  'readiness_gaps',
  'taxonomy_version',
  'model',
  'provider',
  'mock',
  'environment',
]

const REVIEW_COLUMNS = [
  'id',
  'run_id',
  'review_id',
  'source',
  'text',
  'rating',
  'date',
  'city',
  'url',
  'exploration_relevant',
  'noise_category',
  'outcome',
  'user_goal',
  'research_relevant',
  'research_questions',
  'evidence',
  'exploration_outcome',
  'theme',
  'barrier',
  'behavior',
  'emotion',
  'segment',
  'root_cause',
  'unmet_need',
  'mentioned_categories',
  'confidence',
  'classification_reasons',
]

/** Builds `$1, $2, …` for a column list. */
function placeholders(count: number): string {
  return Array.from({ length: count }, (_, i) => `$${i + 1}`).join(', ')
}

/**
 * Rows per multi-row INSERT. Postgres caps a statement at 65535 parameters;
 * at 27 columns that is ~2400 rows, so 500 leaves generous headroom while
 * turning a 1200-review save into three round trips instead of 1200.
 */
const INSERT_CHUNK_ROWS = 500

/** Builds `($1, …, $27), ($28, …, $54), …` for a multi-row INSERT. */
function multiRowPlaceholders(rowCount: number, columnCount: number): string {
  return Array.from({ length: rowCount }, (_, row) => {
    const offset = row * columnCount
    const cells = Array.from({ length: columnCount }, (_, col) => `$${offset + col + 1}`)
    return `(${cells.join(', ')})`
  }).join(', ')
}

/** Builds the `SET col = EXCLUDED.col` clause of an upsert, skipping the key. */
function upsertAssignments(columns: string[], key: string): string {
  return columns
    .filter((c) => c !== key)
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ')
}

function rowToRun(row: Row): Run {
  return {
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
    mock: Boolean(Number(row.mock)),
    environment: row.environment as Run['environment'],
  }
}

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
  const stampedRun = { ...run, taxonomy_version: TAXONOMY_VERSION }

  // The run row and its reviews go in together — a partially written run would
  // render as a report with missing evidence.
  await transaction(async (q) => {
    await q(
      `INSERT INTO runs (${RUN_COLUMNS.join(', ')})
       VALUES (${placeholders(RUN_COLUMNS.length)})
       ON CONFLICT (id) DO UPDATE SET ${upsertAssignments(RUN_COLUMNS, 'id')}`,
      [
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
    )

    // Collapse by composite id first. Two reviews sharing a review_id would
    // otherwise appear twice in one multi-row upsert, which Postgres rejects
    // with "ON CONFLICT DO UPDATE command cannot affect row a second time".
    const rowsById = new Map<string, unknown[]>()
    for (const r of reviews) {
      const compositeId = `${stampedRun.id}::${r.review_id}`
      rowsById.set(compositeId, [
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
      ])
    }

    const rows = [...rowsById.values()]
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_ROWS) {
      const chunk = rows.slice(i, i + INSERT_CHUNK_ROWS)
      await q(
        `INSERT INTO run_reviews (${REVIEW_COLUMNS.join(', ')})
         VALUES ${multiRowPlaceholders(chunk.length, REVIEW_COLUMNS.length)}
         ON CONFLICT (id) DO UPDATE SET ${upsertAssignments(REVIEW_COLUMNS, 'id')}`,
        chunk.flat(),
      )
    }
  })
}

export async function loadRun(
  id: string,
): Promise<{ run: Run; reviews: ClassifiedReview[] } | null> {
  await runMigrations()

  const runRes = await query(`SELECT * FROM runs WHERE id = $1`, [id])
  if (runRes.rows.length === 0) return null

  const run = rowToRun(runRes.rows[0])

  const reviewRes = await query(`SELECT * FROM run_reviews WHERE run_id = $1`, [id])

  const parseJson = <T>(value: unknown, fallback: T): T =>
    value === null || value === undefined ? fallback : (JSON.parse(String(value)) as T)

  const reviews: ClassifiedReview[] = reviewRes.rows.map((r) => ({
    review_id: String(r.review_id),
    source: String(r.source),
    text: String(r.text),
    rating: r.rating !== null ? Number(r.rating) : undefined,
    date: r.date !== null ? String(r.date) : undefined,
    city: r.city !== null ? String(r.city) : undefined,
    url: r.url !== null ? String(r.url) : undefined,
    exploration_relevant: Boolean(Number(r.exploration_relevant)),
    noise_category: r.noise_category !== null ? (String(r.noise_category) as CuratedReview['noise_category']) : undefined,
    outcome: r.outcome !== null ? (String(r.outcome) as CuratedReview['outcome']) : undefined,
    user_goal: r.user_goal !== null ? String(r.user_goal) : undefined,
    research_relevant: Boolean(Number(r.research_relevant)),
    research_questions: parseJson(r.research_questions, []),
    evidence: String(r.evidence),
    exploration_outcome: String(r.exploration_outcome) as ClassifiedReview['exploration_outcome'],
    theme: String(r.theme) as ClassifiedReview['theme'],
    barrier: String(r.barrier) as ClassifiedReview['barrier'],
    behavior: String(r.behavior) as ClassifiedReview['behavior'],
    emotion: String(r.emotion) as ClassifiedReview['emotion'],
    segment: String(r.segment) as ClassifiedReview['segment'],
    root_cause: String(r.root_cause) as ClassifiedReview['root_cause'],
    unmet_need: String(r.unmet_need) as ClassifiedReview['unmet_need'],
    mentioned_categories: parseJson(r.mentioned_categories, []),
    confidence: Number(r.confidence),
    classification_reasons: parseJson(r.classification_reasons, []),
  }))

  return { run, reviews }
}

export async function listRuns(): Promise<Run[]> {
  await runMigrations()
  const runRes = await query(`SELECT * FROM runs ORDER BY seq DESC`)
  return runRes.rows.map(rowToRun)
}

export async function deleteRun(id: string): Promise<void> {
  await runMigrations()
  await query(`DELETE FROM runs WHERE id = $1`, [id])
}

export async function getDailyUsage(): Promise<{ tpdConsumed: number; rpdConsumed: number }> {
  await runMigrations()
  const todayPrefix = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'

  // Estimated tokens per run, summed in SQL rather than by loading every review
  // into memory: 4.1 characters per token, matching lib/llm/limits.
  const res = await query(
    `SELECT r.exploration_relevant_count AS relevant_count,
            COALESCE(SUM(CEIL(LENGTH(rr.text) / 4.1)), 0) AS run_tokens
       FROM runs r
       LEFT JOIN run_reviews rr ON rr.run_id = r.id
      WHERE r.created_at LIKE $1
        AND r.mock = 0
      GROUP BY r.id, r.exploration_relevant_count`,
    [`${todayPrefix}%`],
  )

  let tpdConsumed = 0
  let rpdConsumed = 0

  // Default batch size is 3 (P9-T02 / LLM_CLASSIFY_BATCH_SIZE)
  const batchSize = 3

  for (const row of res.rows) {
    tpdConsumed += Number(row.run_tokens)
    rpdConsumed += Math.ceil(Number(row.relevant_count) / batchSize)
  }

  return { tpdConsumed, rpdConsumed }
}
