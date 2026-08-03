import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { fetchFromAllSources } from '../lib/collectors'
import { curateReviews } from '../lib/curate'
import { classifyBatchWithRetries } from '../lib/llm/classify'
import { buildFindingsReport } from '../lib/findings'
import { synthesizeReport } from '../lib/synthesis'
import { aggregateReviews } from '../lib/aggregate'
import { calculateReadinessScore, evaluateDriftAlarms } from '../lib/observability'
import { saveRun } from '../lib/db/runs'
import { estimateTokens } from '../lib/llm/limits'
import { ClassifiedReview, Run } from '../lib/types'

async function runProductionPipeline() {
  console.log('🚀 Starting ReviewLens First Production Pipeline Run (Phase 9)...\n')

  // 1. Environment Verification
  const apiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY || ''
  const provider = 'groq'
  const model = 'llama-3.3-70b-versatile'

  if (!apiKey) {
    console.error('❌ Error: GROQ_API_KEY / LLM_API_KEY is not configured in the environment. Exiting.')
    process.exit(1)
  }

  console.log(`📌 Execution Mode: ⚡ Live Provider API (Groq Llama)`)
  console.log(`📌 Model: ${provider} / ${model}\n`)

  // 2. Fetch from all 7 sources
  console.log('🌐 Phase 1: Ingesting reviews across 7 sources (weighted toward Reddit & forums)...')
  const fetchResult = await fetchFromAllSources(
    ['playstore', 'appstore', 'reddit', 'forums', 'social', 'product_reviews', 'quickcommerce'],
    { amount: 50, region: 'All India' }, // Use 50 reviews to be robust under token limits
  )

  const rawReviews = fetchResult.reviews
  console.log(`✅ Ingested ${rawReviews.length} total raw reviews across sources.\n`)

  // 3. Preprocess & Curate
  console.log('🧹 Phase 2: Running exploration relevance curation...')
  const curationResult = curateReviews(rawReviews)
  const curatedReviews = curationResult.included
  console.log(`✅ Curation complete: ${curatedReviews.length} exploration-relevant reviews survived out of ${rawReviews.length}.\n`)

  if (curatedReviews.length === 0) {
    console.error('❌ Curation empty: 0 reviews survived domain filter. Adjust fetch parameters.')
    process.exit(1)
  }

  // Pre-flight cost estimation
  let totalChars = 0
  curatedReviews.forEach((r) => {
    totalChars += r.text.length
  })
  const estimatedTokens = estimateTokens('a'.repeat(totalChars))
  const estimatedCost = (estimatedTokens / 1000000) * 0.20
  console.log(`📊 Pre-Flight Estimator: ~${estimatedTokens} tokens, Estimated Cost: $${estimatedCost.toFixed(4)} USD`)

  // 4. Classification
  console.log('🏷️ Phase 3: Classifying curated reviews into taxonomy space...')
  const startTime = Date.now()
  let classifiedReviews: ClassifiedReview[] = []

  try {
    classifiedReviews = await classifyBatchWithRetries(curatedReviews, {
      provider,
      apiKey,
      model,
    })
  } catch (err: unknown) {
    console.error('❌ LLM Classification failed. Stopping process.', err)
    process.exit(1)
  }

  const elapsedMs = Date.now() - startTime
  console.log(`✅ Classification complete: ${classifiedReviews.length} reviews classified in ${(elapsedMs / 1000).toFixed(1)}s.\n`)

  // 5. Aggregation & Synthesis
  console.log('📈 Phase 4-6: Aggregating statistics & synthesizing executive insights...')
  const findings = buildFindingsReport(classifiedReviews)
  const executiveReport = synthesizeReport(classifiedReviews, findings)
  const aggregation = aggregateReviews(rawReviews, classifiedReviews)

  // 6. Quality & Readiness Assessment
  const sourceMix: Record<string, number> = {}
  classifiedReviews.forEach((r) => {
    sourceMix[r.source] = (sourceMix[r.source] || 0) + 1
  })
  const sourcesCount = Object.keys(sourceMix).length

  const readiness = calculateReadinessScore(
    rawReviews.length,
    classifiedReviews.length,
    sourcesCount,
    classifiedReviews,
  )

  console.log(`\n🎯 Director-Readiness Score: ${readiness.score}/100 (${readiness.grade})`)
  if (readiness.gaps.length > 0) {
    console.log('⚠️ Readiness Quality Gaps:')
    readiness.gaps.forEach((g) => console.log(`   - ${g}`))
  }

  // Evaluate drift alarms
  const keepRate = rawReviews.length > 0 ? classifiedReviews.length / rawReviews.length : 0
  const meanConf = classifiedReviews.reduce((a, b) => a + (b.confidence || 0.85), 0) / (classifiedReviews.length || 1)
  const alarms = evaluateDriftAlarms(keepRate, meanConf)

  if (alarms.length > 0) {
    console.log('\n🚨 Drift Alarms Triggered:')
    alarms.forEach((a) => console.log(`   [${a.severity.toUpperCase()}] ${a.metric}: ${a.details}`))
  }

  // 7. Persist Run to Database
  console.log('\n💾 Phase 7: Persisting production run to Turso/libSQL database...')
  const runId = `prod_run_${Date.now()}`
  const productionRun: Run = {
    id: runId,
    seq: Date.now() % 10000,
    dataset_name: 'Blinkit Category Discovery Production Run Q3',
    status: 'completed',
    created_at: new Date().toISOString(),
    total_reviews: rawReviews.length,
    exploration_relevant_count: classifiedReviews.length,
    excluded_count: rawReviews.length - classifiedReviews.length,
    source_mix: sourceMix,
    fetch_params: { provider, model, sources: Object.keys(sourceMix) },
    curation_stats: curationResult.stats,
    aggregation,
    findings,
    executive_report: executiveReport,
    readiness_score: readiness.score,
    readiness_gaps: readiness.gaps,
    taxonomy_version: '1.0.0',
    model,
    provider,
    mock: false,
    environment: 'prod',
  }

  await saveRun(productionRun, classifiedReviews)
  console.log(`✅ Production run persisted successfully! Run ID: ${runId}`)
  console.log(`🎉 ReviewLens Production Pipeline completed successfully.`)
}

runProductionPipeline().catch((err) => {
  console.error('❌ Production pipeline failed:', err)
  process.exit(1)
})
