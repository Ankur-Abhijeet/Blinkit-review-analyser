import type { Express, Request, Response } from 'express'

import { fetchFromAllSources, COLLECTOR_REGISTRY } from '../lib/collectors'
import { SOURCE_DEFAULTS } from '../lib/collectors/types'
import { computeCleanTextHash } from '../lib/collectors/dedupe'
import { curateReviewsLlm } from '../lib/curate'
import { classifyBatchWithRetries } from '../lib/llm/classify'
import { mockClassifyReview } from '../lib/llm/mock'
import { calculateBatchSize } from '../lib/llm/limits'
import { generateChatResponse } from '../lib/llm/client'
import { getCacheBatch, computeContentHash, writeThroughCache, getTaxonomyHash, setCache } from '../lib/db/cache'
import { saveRun, listRuns, loadRun, deleteRun, getDailyUsage } from '../lib/db/runs'
import { query, runMigrations } from '../lib/db/client'
import { CuratedReview, ClassifiedReview, Run } from '../lib/types'

/** Wraps an async handler so a rejected promise becomes a 500 instead of an unhandled rejection. */
function route(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[${req.method} ${req.path}] Unhandled error:`, err)
      if (!res.headersSent) res.status(500).json({ error: message })
    })
  }
}

/** Express query values may be arrays or nested objects; collapse to a single string. */
function queryParam(req: Request, name: string): string | undefined {
  const value = req.query[name]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

function llmConfig(defaultMaxOutputTokens: number) {
  return {
    provider: (process.env.LLM_PROVIDER || 'groq') as 'groq' | 'cerebras',
    model: process.env.LLM_MODEL || undefined,
    apiKey: process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '',
    maxOutputTokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS) || defaultMaxOutputTokens,
  }
}

export function registerRoutes(app: Express) {
  // ── Collectors ──────────────────────────────────────────────────────────

  app.get(
    '/api/source-config',
    route(async (_req, res) => {
      res.json(SOURCE_DEFAULTS)
    })
  )

  app.post(
    '/api/fetch-reviews',
    route(async (req, res) => {
      const { sources, amount, region, sort, minRating } = req.body

      if (!sources || !Array.isArray(sources) || sources.length === 0) {
        return res.status(400).json({ error: 'At least one source must be selected' })
      }

      if (sources.length > 7) {
        return res.status(400).json({ error: 'Maximum of 7 sources can be selected' })
      }

      const invalidSource = sources.find((s: string) => !COLLECTOR_REGISTRY[s])
      if (invalidSource) {
        return res.status(400).json({ error: `Invalid collector source: ${invalidSource}` })
      }

      const amt = Number(amount)
      if (isNaN(amt) || amt < 1 || amt > 50000) {
        return res.status(400).json({ error: 'Fetch amount must be between 1 and 50000 reviews' })
      }

      const result = await fetchFromAllSources(sources, {
        amount: amt,
        region: region || 'All India',
        sort: sort || 'newest',
        minRating: minRating !== undefined ? Number(minRating) : undefined,
      })

      // Stably shuffle so no single source dominates the head of the array.
      const shuffled = [...result.reviews]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }

      res.json({ reviews: shuffled, stats: result.stats })
    })
  )

  // ── Curation & classification ───────────────────────────────────────────

  app.post(
    '/api/curate-reviews',
    route(async (req, res) => {
      const { reviews, batchSize } = req.body

      if (!reviews || !Array.isArray(reviews)) {
        return res.status(400).json({ error: 'Missing reviews array in request body' })
      }

      const config = llmConfig(1024)
      if (!config.apiKey) {
        return res.status(400).json({
          error: 'Groq API Key (LLM_API_KEY / GROQ_API_KEY) is not configured in the environment.',
        })
      }

      const effectiveBatchSize = Number(batchSize) || 5
      console.log(
        `[API CURATE] Live mode (${config.provider}). Curating ${reviews.length} reviews in batches of ${effectiveBatchSize}.`
      )
      const result = await curateReviewsLlm(reviews, config, effectiveBatchSize)
      res.json(result)
    })
  )

  app.post(
    '/api/classify',
    route(async (req, res) => {
      const reviews = req.body.reviews as CuratedReview[]

      if (!reviews || !Array.isArray(reviews)) {
        return res.status(400).json({ error: 'Missing reviews array in request body' })
      }

      const config = llmConfig(16384)
      if (!config.apiKey) {
        return res.status(400).json({
          error: 'Groq API Key (LLM_API_KEY / GROQ_API_KEY) is not configured in the environment.',
        })
      }

      let classified: ClassifiedReview[]
      try {
        console.log(`[API CLASSIFY] Live mode (${config.provider}). Classifying ${reviews.length} reviews.`)
        classified = await classifyBatchWithRetries(reviews, config)
      } catch (liveErr: unknown) {
        console.warn('[API CLASSIFY] Live LLM provider error. Falling back to heuristic classifier:', liveErr)
        classified = reviews.map((r) => mockClassifyReview(r))
      }

      classified.forEach((item) => setCache(computeCleanTextHash(item.text), item))

      res.json({ classified })
    })
  )

  app.post(
    '/api/classify/cache',
    route(async (req, res) => {
      const { hashes, reviews, writeItems } = req.body

      if (writeItems && typeof writeItems === 'object') {
        await writeThroughCache(writeItems as Record<string, ClassifiedReview>)
        return res.json({ success: true, count: Object.keys(writeItems).length })
      }

      let targetHashes: string[] = []
      if (Array.isArray(hashes) && hashes.length > 0) {
        targetHashes = hashes.map(String)
      } else if (Array.isArray(reviews) && reviews.length > 0) {
        targetHashes = (reviews as CuratedReview[]).map((r) => computeContentHash(r.text, r.source))
      } else {
        return res.status(400).json({ error: 'Either hashes or reviews array is required' })
      }

      const { hits, misses } = await getCacheBatch(targetHashes)

      res.json({
        hits,
        misses,
        hitCount: Object.keys(hits).length,
        missCount: misses.length,
        taxonomyHash: getTaxonomyHash(),
      })
    })
  )

  app.get(
    '/api/classify/config',
    route(async (_req, res) => {
      const provider = (process.env.LLM_PROVIDER || 'groq') as 'groq' | 'cerebras'
      const maxOutputTokens = Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 16384
      const batchSizeOverride = process.env.LLM_CLASSIFY_BATCH_SIZE
        ? Number(process.env.LLM_CLASSIFY_BATCH_SIZE)
        : undefined

      const { tpdConsumed, rpdConsumed } = await getDailyUsage()

      res.json({
        isMock: false,
        provider,
        model: process.env.LLM_MODEL || '',
        batchSize: calculateBatchSize(provider, maxOutputTokens, batchSizeOverride),
        maxOutputTokens,
        tpdConsumed,
        rpdConsumed,
        // Groq free-tier defaults.
        tpdLimit: 100000,
        rpdLimit: 14400,
      })
    })
  )

  // ── Runs ────────────────────────────────────────────────────────────────

  app.get(
    '/api/runs',
    route(async (_req, res) => {
      res.json({ runs: await listRuns() })
    })
  )

  app.post(
    '/api/runs',
    route(async (req, res) => {
      const { run, reviews } = req.body as { run: Run; reviews: ClassifiedReview[] }

      if (!run || !reviews) {
        return res.status(400).json({ error: 'Missing run or reviews in request body' })
      }

      await saveRun(run, reviews)
      res.json({ success: true, id: run.id })
    })
  )

  app.post(
    '/api/runs/compare',
    route(async (req, res) => {
      const { baseRunId, targetRunId } = req.body

      if (!baseRunId || !targetRunId) {
        return res.status(400).json({ error: 'Both baseRunId and targetRunId are required' })
      }

      const baseData = await loadRun(baseRunId)
      const targetData = await loadRun(targetRunId)

      if (!baseData) return res.status(404).json({ error: `Base run "${baseRunId}" not found` })
      if (!targetData) return res.status(404).json({ error: `Target run "${targetRunId}" not found` })

      const baseRun = baseData.run
      const targetRun = targetData.run

      // Comparing runs across taxonomy updates silently corrupts trend analysis.
      if (baseRun.taxonomy_version !== targetRun.taxonomy_version) {
        return res.status(400).json({
          error:
            `Taxonomy version mismatch guard rejected comparison. Base run uses version ` +
            `"${baseRun.taxonomy_version}" while Target run uses version "${targetRun.taxonomy_version}". ` +
            `Comparing runs across taxonomy updates silently corrupts trend analysis.`,
          mismatch: true,
          baseTaxonomyVersion: baseRun.taxonomy_version,
          targetTaxonomyVersion: targetRun.taxonomy_version,
        })
      }

      res.json({
        success: true,
        comparison: {
          baseRun,
          targetRun,
          deltas: {
            readinessDelta: targetRun.readiness_score - baseRun.readiness_score,
            reviewsDelta: targetRun.total_reviews - baseRun.total_reviews,
            relevantDelta: targetRun.exploration_relevant_count - baseRun.exploration_relevant_count,
          },
        },
      })
    })
  )

  app.post(
    '/api/runs/queue',
    route(async (req, res) => {
      const { datasetName, reviews, fetchParams, partIndex, totalParts } = req.body

      if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
        return res.status(400).json({ error: 'No reviews provided to queue' })
      }

      await runMigrations()

      const queueId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const now = new Date().toISOString()
      const name = datasetName || `Queued Corpus ${partIndex ? `(Part ${partIndex}/${totalParts})` : ''}`

      await query(
        `INSERT INTO runs (
          id, seq, dataset_name, status, created_at, total_reviews,
          exploration_relevant_count, excluded_count, source_mix, fetch_params,
          curation_stats, aggregation, findings, executive_report,
          readiness_score, readiness_gaps, taxonomy_version, model, provider, mock, environment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          queueId,
          Date.now(),
          name,
          'queued',
          now,
          reviews.length,
          reviews.filter((r: CuratedReview) => r.exploration_relevant).length,
          reviews.filter((r: CuratedReview) => !r.exploration_relevant).length,
          JSON.stringify({}),
          JSON.stringify(fetchParams || {}),
          JSON.stringify({
            totalInput: reviews.length,
            uniqueRecords: reviews.length,
            explorationRelevant: reviews.length,
            noiseBreakdown: {},
            outcomeBreakdown: {},
          }),
          JSON.stringify({}),
          JSON.stringify([]),
          JSON.stringify({}),
          0,
          JSON.stringify([]),
          '1.0.0',
          process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
          process.env.LLM_PROVIDER || 'groq',
          0,
          process.env.NODE_ENV === 'production' ? 'prod' : 'local',
        ],
      )

      res.json({
        success: true,
        queueId,
        datasetName: name,
        reviewCount: reviews.length,
        createdAt: now,
      })
    })
  )

  app.get(
    '/api/runs/:id',
    route(async (req, res) => {
      const id = String(req.params.id)
      const result = await loadRun(id)
      if (!result) return res.status(404).json({ error: `Run with ID ${id} not found` })
      res.json(result)
    })
  )

  app.delete(
    '/api/runs/:id',
    route(async (req, res) => {
      await deleteRun(String(req.params.id))
      res.json({ success: true })
    })
  )

  // ── Evidence & assistant ────────────────────────────────────────────────

  app.get(
    '/api/quotes',
    route(async (req, res) => {
      const runId = queryParam(req, 'runId')
      const query = queryParam(req, 'query') || ''
      const sourceFilter = queryParam(req, 'source')
      const themeFilter = queryParam(req, 'theme')
      const barrierFilter = queryParam(req, 'barrier')
      const segmentFilter = queryParam(req, 'segment')

      if (!runId) {
        return res.status(400).json({ error: 'runId query parameter is required' })
      }

      const data = await loadRun(runId)
      if (!data) return res.status(404).json({ error: `Run with ID "${runId}" not found` })

      let reviews = data.reviews

      if (query.trim()) {
        const qLower = query.toLowerCase().trim()
        reviews = reviews.filter((r) => r.text.toLowerCase().includes(qLower))
      }
      if (sourceFilter && sourceFilter !== 'all') {
        reviews = reviews.filter((r) => r.source === sourceFilter)
      }
      if (themeFilter && themeFilter !== 'all') {
        reviews = reviews.filter((r) => r.theme === themeFilter)
      }
      if (barrierFilter && barrierFilter !== 'all') {
        reviews = reviews.filter((r) => r.barrier === barrierFilter)
      }
      if (segmentFilter && segmentFilter !== 'all') {
        reviews = reviews.filter((r) => r.segment === segmentFilter)
      }

      const distinct = (values: string[]) => Array.from(new Set(values)).filter(Boolean)

      res.json({
        runId,
        totalCount: reviews.length,
        reviews,
        options: {
          sources: distinct(data.reviews.map((r) => r.source)),
          themes: distinct(data.reviews.map((r) => r.theme)),
          barriers: distinct(data.reviews.map((r) => r.barrier)),
          segments: distinct(data.reviews.map((r) => r.segment)),
        },
      })
    })
  )

  app.post(
    '/api/chat',
    route(async (req, res) => {
      const { runId, message } = req.body

      if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' })
      if (!runId) return res.status(400).json({ error: 'runId is required' })

      const runData = await loadRun(runId)
      if (!runData) return res.status(404).json({ error: `Run "${runId}" not found` })

      const { run, reviews } = runData

      // Top 30 classified reviews, to fit the token budget.
      const contextSummary = reviews
        .slice(0, 30)
        .map(
          (r) =>
            `[Review ID: ${r.review_id} | Source: ${r.source} | Theme: ${r.theme} | Barrier: ${r.barrier} | Segment: ${r.segment}]\nText: "${r.text}"`
        )
        .join('\n\n')

      const prompt = `You are the ReviewLens PM Assistant. You MUST answer the user's question grounded strictly in the provided review evidence below. Always cite exact [Review ID: ...] citations whenever referencing a finding or verbatim quote.

GROUNDED REVIEW EVIDENCE (Run Dataset: "${run.dataset_name}", ID: ${run.id}):
${contextSummary}

USER QUESTION:
"${message}"

INSTRUCTIONS:
1. Provide a direct, PM-level analytical answer.
2. Include exact [Review ID: ...] citations for every claim.
3. If the evidence does not contain information to answer the question, state that clearly.`

      const reply = await generateChatResponse(prompt)
      const citations = Array.from(new Set(reply.match(/Review ID: [a-zA-Z0-9_-]+/g) || []))

      res.json({
        reply,
        reviewsInContext: reviews.length,
        citations,
        datasetName: run.dataset_name,
      })
    })
  )
}
