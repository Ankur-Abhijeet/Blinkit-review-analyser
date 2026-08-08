'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RawReview, ClassifiedReview, CurationStats } from '../lib/types'
import { parseReviews } from '../lib/ingest/parse'
import { estimateTokens } from '../lib/llm/limits'
import { CurationEmpty } from '../components/CurationEmpty'
import { ScrapedDataViewer } from '../components/ScrapedDataViewer'
import { CleaningChunkingMonitor } from '../components/CleaningChunkingMonitor'
import { planCorpusSplit } from '../lib/split'
import { buildFindingsReport } from '../lib/findings'
import { synthesizeReport } from '../lib/synthesis'
import { aggregateReviews } from '../lib/aggregate'
import { apiFetch } from '../lib/api'

interface FetchStats {
  totalRawFetched: number
  totalYieldKept: number
  perSourceStats: Record<string, { rawFetched: number; yieldKept: number }>
}

export default function Home() {
  const router = useRouter()
  
  // Stepper state & 9-state Pipeline Machine
  const [step, setStep] = useState(1) // 1: Input, 2: Pre-flight, 3: Processing, 4: Curation Empty
  const [pipelineState, setPipelineState] = useState<'idle' | 'fetching' | 'curating' | 'curation_empty' | 'classifying' | 'aggregating' | 'findings' | 'persisting' | 'complete' | 'error'>('idle')
  
  // Dataset configuration
  const [datasetName, setDatasetName] = useState('Blinkit Fresh Produce Launch Corpus')
  const [source, setSource] = useState('playstore')
  const [rawText, setRawText] = useState('')
  const [reviews, setReviews] = useState<RawReview[]>([])
  
  // Live scraper configurations
  const [activeTab, setActiveTab] = useState<'fetch' | 'upload'>('fetch')
  const [selectedSources, setSelectedSources] = useState<string[]>(['playstore', 'reddit'])
  const [sourceLimits, setSourceLimits] = useState<Record<string, number>>({})
  const [sourceConfigs, setSourceConfigs] = useState<Record<string, { defaultLimit: number; maxLimit: number; avgReviewLength: number; hasNativeRating: boolean; description: string }>>({})
  const [fetchRegion, setFetchRegion] = useState('All India')
  const [fetchSort, setFetchSort] = useState('newest')
  const [fetchMinRating, setFetchMinRating] = useState<number | undefined>(undefined)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchStats, setFetchStats] = useState<FetchStats | null>(null)

  // Curation Stats & Partial Data
  const [curationStats, setCurationStats] = useState<CurationStats | undefined>(undefined)

  // LLM Config
  const [provider, setProvider] = useState('groq')
  const [model, setModel] = useState('llama-3.3-70b-versatile')
  const [isMock, setIsMock] = useState(false)

  // Pre-flight limits and daily usage tracking
  const [tpdConsumed, setTpdConsumed] = useState(0)
  const [rpdConsumed, setRpdConsumed] = useState(0)
  const [tpdLimit, setTpdLimit] = useState(100000)
  const [rpdLimit, setRpdLimit] = useState(14400)
  const [batchSize, setBatchSize] = useState(3)

  // Pipeline Chunking & Monitoring State
  const [showChunkingMonitor, setShowChunkingMonitor] = useState<boolean>(false)
  const [pipelineBatchSize, setPipelineBatchSize] = useState<number>(10)
  const [pipelineBatchDelayMs, setPipelineBatchDelayMs] = useState<number>(300)
  const [bypassCurationFilter, setBypassCurationFilter] = useState<boolean>(false)
  const [chunkProgress, setChunkProgress] = useState<{ currentChunk: number; totalChunks: number; processedCount: number; relevantCount: number }>({
    currentChunk: 0,
    totalChunks: 0,
    processedCount: 0,
    relevantCount: 0,
  })

  // Pre-flight estimation stats
  const [estTokens, setEstTokens] = useState(0)
  const [estCost, setEstCost] = useState(0.0)

  // Ingestion status tracker
  const [statusText, setStatusText] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [cacheHitCount, setCacheHitCount] = useState(0)
  const [error, setError] = useState('')
  // Set when the API had to classify with keyword heuristics instead of the LLM.
  // The run still completes, so this warns rather than halting.
  const [degradedWarning, setDegradedWarning] = useState('')

  // Load source configs and LLM config on mount
  useEffect(() => {
    setIsMock(false)
    apiFetch('/api/classify/config')
      .then((res) => res.json())
      .then((data) => {
        setTpdConsumed(data.tpdConsumed || 0)
        setRpdConsumed(data.rpdConsumed || 0)
        setTpdLimit(data.tpdLimit || 100000)
        setRpdLimit(data.rpdLimit || 14400)
        setBatchSize(data.batchSize || 3)
      })
      .catch(() => {})

    apiFetch('/api/source-config')
      .then((res) => res.json())
      .then((configs: Record<string, { defaultLimit: number; maxLimit: number; avgReviewLength: number; hasNativeRating: boolean; description: string }>) => {
        setSourceConfigs(configs)
        // Initialize sourceLimits from defaults for currently selected sources
        const limits: Record<string, number> = {}
        for (const id of Object.keys(configs)) {
          limits[id] = configs[id].defaultLimit
        }
        setSourceLimits(limits)
      })
      .catch(() => {})
  }, [])

  // Derived: total reviews across all selected source limits
  const totalAmount = selectedSources.reduce((sum, src) => sum + (sourceLimits[src] || 0), 0)

  // Auto-fill mock reviews helper for quick testing
  const handleLoadSample = () => {
    const sampleReviews = [
      { id: '1', source: 'reddit', text: 'I am so disappointed with Blinkit. I wanted to order fresh avocados but I could not find the category anywhere. The app just shows reorder your previous bread and milk basket.', rating: 2, date: '2026-07-28', city: 'Gurgaon' },
      { id: '2', source: 'appstore', text: 'Love the delivery speed but the category navigation is awful. Under fruits and vegetables, it just lists random products instead of clean sections. Very frustrating.', rating: 3, date: '2026-07-29', city: 'Delhi' },
      { id: '3', source: 'playstore', text: 'Blinkit is great for milk but I never explore other categories because I do not trust the quality of fresh items online. The description is so sparse.', rating: 3, date: '2026-07-29', city: 'Mumbai' },
      { id: '4', source: 'reddit', text: 'Why is there no trial pack for the expensive gourmet cheese on Blinkit? I do not want to buy 500g and find out it is bad. A 50g trial pack would make me try it.', rating: 2, date: '2026-07-30', city: 'Bangalore' },
      { id: '5', source: 'reddit', text: 'The search is the only way to find gourmet ingredients. The main page just pushes deals and promos. I am a search-only shopper here.', rating: 4, date: '2026-07-30', city: 'Delhi' }
    ]
    setRawText(JSON.stringify(sampleReviews, null, 2))
  }

  // Live scrapers fetching action
  const handleStartFetch = async () => {
    if (selectedSources.length === 0) {
      setError('Please select at least one review source.')
      return
    }
    setError('')
    setIsFetching(true)
    setPipelineState('fetching')
    setFetchStats(null)
    setProgressPct(0)

    try {
      let allReviews: RawReview[] = []
      const perSourceStats: Record<string, { rawFetched: number; yieldKept: number }> = {}

      for (let i = 0; i < selectedSources.length; i++) {
        const src = selectedSources[i]
        const pct = Math.round((i / selectedSources.length) * 100)
        setProgressPct(pct)
        setStatusText(`Scraping reviews from ${src.toUpperCase()}...`)

        const res = await apiFetch('/api/fetch-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources: [src],
            // Use per-source limit
            amount: sourceLimits[src] || 50,
            region: fetchRegion,
            sort: fetchSort,
            minRating: fetchMinRating,
          }),
        })

        if (!res.ok) {
          const errBody = await res.json()
          throw new Error(errBody.error || `Failed to fetch reviews from ${src}`)
        }

        const { reviews: fetchedReviews, stats } = await res.json()
        allReviews = [...allReviews, ...fetchedReviews]
        if (stats && stats.perSourceStats && stats.perSourceStats[src]) {
          perSourceStats[src] = stats.perSourceStats[src]
        } else {
          perSourceStats[src] = { rawFetched: fetchedReviews.length, yieldKept: fetchedReviews.length }
        }
      }

      setProgressPct(100)
      setStatusText('Scraping complete! Deduplicating data...')

      // Cross-source deduplication (exactly like the backend)
      const seen = new Set<string>()
      const finalUniqueReviews = allReviews.filter((r) => {
        const hash = r.text.trim().toLowerCase()
        if (seen.has(hash)) return false
        seen.add(hash)
        return true
      })

      // Cap at total across all selected source limits
      const cappedReviews = finalUniqueReviews.slice(0, totalAmount)

      setReviews(cappedReviews)
      
      // Calculate final combined stats
      const totalRawFetched = Object.values(perSourceStats).reduce((acc, curr) => acc + curr.rawFetched, 0)
      const totalYieldKept = cappedReviews.length

      setFetchStats({
        totalRawFetched,
        totalYieldKept,
        perSourceStats,
      })

      // Populate text field as fallback representation
      setRawText(JSON.stringify(cappedReviews, null, 2))

      // Estimate tokens for the fetched reviews
      let totalChars = 0
      cappedReviews.forEach((r: RawReview) => {
        totalChars += r.text.length
      })
      const tokens = estimateTokens('a'.repeat(totalChars))
      setEstTokens(tokens)
      
      const cost = (tokens / 1000000) * 0.20
      setEstCost(Math.max(0.0001, Math.round(cost * 10000) / 10000))
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError(errMsg)
      setPipelineState('error')
    } finally {
      setIsFetching(false)
      if (pipelineState !== 'error') setPipelineState('idle')
    }
  }

  // Pre-flight calculation
  const handleProceedToPreflight = () => {
    setError('')

    apiFetch('/api/classify/config')
      .then((res) => res.json())
      .then((data) => {
        setTpdConsumed(data.tpdConsumed || 0)
        setRpdConsumed(data.rpdConsumed || 0)
        setTpdLimit(data.tpdLimit || 100000)
        setRpdLimit(data.rpdLimit || 14400)
        setBatchSize(data.batchSize || 3)
      })
      .catch(() => {})

    if (activeTab === 'upload') {
      if (!rawText.trim()) {
        setError('Please paste or upload some reviews to analyze.')
        return
      }
      try {
        const trimmed = rawText.trim()
        const parsed = parseReviews(trimmed)

        if (parsed.length === 0) {
          throw new Error('No valid reviews parsed. Check format.')
        }

        const processed = parsed.map((r) => ({
          ...r,
          source: r.source || source,
        }))

        setReviews(processed)

        // Estimate tokens
        let totalChars = 0
        processed.forEach((r) => {
          totalChars += r.text.length
        })
        const tokens = estimateTokens('a'.repeat(totalChars))
        setEstTokens(tokens)

        const cost = (tokens / 1000000) * 0.20
        setEstCost(Math.max(0.0001, Math.round(cost * 10000) / 10000))

        setStep(2)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invalid JSON or CSV structure.')
      }
    } else {
      // Fetch mode
      if (reviews.length === 0) {
        setError('Please fetch reviews from live sources first.')
        return
      }
      setStep(2)
    }
  }

  // Save curated corpus for later execution
  const handleSaveForLater = async () => {
    try {
      setStatusText('Persisting curated corpus as a queued run...')
      const res = await apiFetch('/api/runs/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName,
          reviews,
          fetchParams: { selectedSources, sourceLimits, totalAmount, fetchRegion, fetchMinRating },
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save run for later.')
      }

      alert('Curated corpus saved successfully to research repository as queued run.')
      router.push('/history')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save for later.')
    }
  }

  const handleStartAnalysis = async (launchOpts?: { batchSize?: number; batchDelayMs?: number; bypassCuration?: boolean }) => {
    const selectedBatchSize = launchOpts?.batchSize || pipelineBatchSize
    const selectedDelay = launchOpts?.batchDelayMs !== undefined ? launchOpts.batchDelayMs : pipelineBatchDelayMs
    const shouldBypass = launchOpts?.bypassCuration ?? bypassCurationFilter

    setShowChunkingMonitor(false)
    setStep(3)
    setError('')
    setProgressPct(5)
    setPipelineState('curating')
    setStatusText('Filtering duplicate reviews & normalizing inputs...')

    try {
      let curatedList: RawReview[] = reviews

      if (shouldBypass) {
        setStatusText('⚡ Curation filter bypassed by user configuration. Including 100% of cleaned reviews...')
        setCurationStats({
          loaded: reviews.length,
          unique: reviews.length,
          duplicatesRemoved: 0,
          sentToClassification: reviews.length,
          excluded: 0,
          excludedByCategory: {},
        })
      } else {
        // Curation in real-time micro-batches
        setProgressPct(15)
        setStatusText('Running exploration relevance curation (Phase 2)...')
        
        const totalReviews = reviews.length
        const curationBatchSize = 50
        const totalCurationChunks = Math.ceil(totalReviews / curationBatchSize)
        
        let allCuratedIncluded: RawReview[] = []
        let accumulatedStats = {
          loaded: totalReviews,
          unique: totalReviews,
          duplicatesRemoved: 0,
          sentToClassification: 0,
          excluded: 0,
          excludedByCategory: {} as Record<string, number>,
        }

        setChunkProgress({
          currentChunk: 0,
          totalChunks: totalCurationChunks,
          processedCount: 0,
          relevantCount: totalReviews,
        })

        for (let i = 0; i < totalReviews; i += curationBatchSize) {
          const chunkBatch = reviews.slice(i, i + curationBatchSize)
          const currentChunkNum = Math.floor(i / curationBatchSize) + 1

          const currentPct = 15 + Math.round((currentChunkNum / totalCurationChunks) * 20) // 15% -> 35%
          setProgressPct(currentPct)
          setStatusText(`Curating Chunk #${currentChunkNum} of ${totalCurationChunks} (${chunkBatch.length} items)...`)

          setChunkProgress({
            currentChunk: currentChunkNum,
            totalChunks: totalCurationChunks,
            processedCount: Math.min(i + curationBatchSize, totalReviews),
            relevantCount: totalReviews,
          })

          const curateRes = await apiFetch('/api/curate-reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviews: chunkBatch, batchSize: selectedBatchSize }),
          })

          if (!curateRes.ok) {
            const errBody = await curateRes.json()
            throw new Error(errBody.error || `Curation chunk #${currentChunkNum} failed`)
          }

          const { included: chunkIncluded, stats: curStats } = await curateRes.json()
          allCuratedIncluded = [...allCuratedIncluded, ...(chunkIncluded || [])]

          if (curStats) {
            accumulatedStats.sentToClassification = allCuratedIncluded.length
            accumulatedStats.excluded += (curStats.excluded || 0)
          }

          if (i + curationBatchSize < totalReviews) {
            await new Promise((r) => setTimeout(r, 100))
          }
        }

        curatedList = allCuratedIncluded
        setCurationStats(accumulatedStats)

        if (!curatedList || curatedList.length === 0) {
          setPipelineState('curation_empty')
          setStep(4) // Curation empty step
          return
        }
      }

      // Classification in micro-batches with real-time UI updates
      setPipelineState('classifying')
      setProgressPct(35)
      setStatusText(`Checking cache for ${curatedList.length} curated reviews...`)

      // Cache check
      let classifiedList: ClassifiedReview[] = []
      let missesToClassify = curatedList

      try {
        const cacheRes = await apiFetch('/api/classify/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviews: curatedList }),
        })

        if (cacheRes.ok) {
          const { hits } = await cacheRes.json()
          const hitCount = Object.keys(hits || {}).length
          setCacheHitCount(hitCount)

          if (hitCount > 0) {
            classifiedList = Object.values(hits)
            missesToClassify = curatedList.filter((r: any) => !hits[r.hash])
            setStatusText(`⚡ Found ${hitCount} cached items (0 token spend). Classifying ${missesToClassify.length} remaining items...`)
          }
        }
      } catch (cacheErr) {
        console.warn('[CACHE] Cache check failed, proceeding:', cacheErr)
      }

      // Classify missing items in chunk-by-chunk requests for real-time progress!
      if (missesToClassify.length > 0) {
        const totalMissing = missesToClassify.length
        const totalChunks = Math.ceil(totalMissing / selectedBatchSize)
        
        setChunkProgress({
          currentChunk: 0,
          totalChunks,
          processedCount: classifiedList.length,
          relevantCount: curatedList.length,
        })

        for (let i = 0; i < totalMissing; i += selectedBatchSize) {
          const chunkBatch = missesToClassify.slice(i, i + selectedBatchSize)
          const currentChunkNum = Math.floor(i / selectedBatchSize) + 1

          const currentPct = 35 + Math.round((currentChunkNum / totalChunks) * 45) // 35% -> 80%
          setProgressPct(currentPct)
          setStatusText(`Classifying Chunk #${currentChunkNum} of ${totalChunks} (${chunkBatch.length} items)...`)

          setChunkProgress({
            currentChunk: currentChunkNum,
            totalChunks,
            processedCount: classifiedList.length + chunkBatch.length,
            relevantCount: curatedList.length,
          })

          const classifyRes = await apiFetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviews: chunkBatch }),
          })

          if (!classifyRes.ok) {
            const errBody = await classifyRes.json()
            throw new Error(errBody.error || `Classification chunk #${currentChunkNum} failed`)
          }

          const { classified: chunkClassified, degraded, degradedReason } = await classifyRes.json()
          classifiedList = [...classifiedList, ...chunkClassified]

          if (degraded) {
            setDegradedWarning(
              `The AI classifier is unavailable, so reviews are being labelled by keyword rules instead. ` +
                `Results will be less accurate. Reason: ${degradedReason || 'unknown'}`,
            )
          }

          if (i + selectedBatchSize < totalMissing) {
            await new Promise((r) => setTimeout(r, selectedDelay))
          }
        }
      } else {
        setStatusText('⚡ 100% cache hit! Skipped LLM API classification.')
      }

      // 4. Synthesis & Analysis Reports
      setPipelineState('aggregating')
      setProgressPct(80)
      setStatusText('Synthesizing research questions & opportunity scores (Phases 5-6)...')

      const findings = buildFindingsReport(classifiedList)
      const executiveReport = synthesizeReport(classifiedList, findings)
      const aggregation = aggregateReviews(reviews, classifiedList)

      // 5. Persistence to DB
      setPipelineState('persisting')
      setProgressPct(90)
      setStatusText('Persisting run and reviews to Turso/libSQL database...')

      const runId = `run_${Date.now()}`
      
      const sourceMix: Record<string, number> = {}
      classifiedList.forEach((c: ClassifiedReview) => {
        sourceMix[c.source] = (sourceMix[c.source] || 0) + 1
      })

      const finalRun = {
        id: runId,
        seq: Date.now() % 10000,
        dataset_name: datasetName,
        status: 'completed',
        created_at: new Date().toISOString(),
        total_reviews: reviews.length,
        exploration_relevant_count: classifiedList.length,
        excluded_count: reviews.length - classifiedList.length,
        source_mix: sourceMix,
        fetch_params: { provider, model },
        curation_stats: curationStats || {
          loaded: reviews.length,
          unique: reviews.length,
          duplicatesRemoved: 0,
          sentToClassification: classifiedList.length,
          excluded: reviews.length - classifiedList.length,
          excludedByCategory: {},
        },
        aggregation,
        findings,
        executive_report: executiveReport,
        readiness_score: executiveReport.readinessScore,
        readiness_gaps: executiveReport.readinessGaps,
        taxonomy_version: '1.0.0',
        model,
        provider,
        mock: isMock,
        environment: 'local',
      }

      const saveRes = await apiFetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: finalRun, reviews: classifiedList }),
      })

      if (!saveRes.ok) {
        // Surface what the API actually said. A bare "failed to persist" hides the
        // cause (invariant violation, DB unreachable, timeout) and makes the
        // failure undiagnosable from the UI.
        const detail = await saveRes
          .json()
          .then((body) => body?.error)
          .catch(() => null)
        throw new Error(
          detail
            ? `Failed to persist run to database: ${detail}`
            : `Failed to persist run to database (HTTP ${saveRes.status} ${saveRes.statusText})`,
        )
      }

      setProgressPct(100)
      setStatusText('Analysis completed! Redirecting to dashboard...')

      // Redirect to runs dashboard page
      setTimeout(() => {
        router.push(`/runs/${runId}`)
      }, 500)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setStep(2) // Fallback back to preflight step to see error
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
      {/* Header Banner */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
          🔍 ReviewLens Exploratory Analysis
        </h1>
        <p className="text-sm text-zinc-500 mt-1 font-medium">
          Extract, classify, and size friction opportunities from customer feedback databases.
        </p>
      </div>

      {/* Stepper progress indicator */}
      <div className="flex items-center justify-between max-w-md mx-auto py-2">
        <div className={`text-xs font-bold px-3 py-1.5 rounded-full ${step >= 1 ? 'bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f]' : 'bg-zinc-200 text-zinc-500'}`}>
          1. Import
        </div>
        <div className="flex-1 h-0.5 bg-zinc-200 dark:bg-zinc-800 mx-2" />
        <div className={`text-xs font-bold px-3 py-1.5 rounded-full ${step >= 2 ? 'bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f]' : 'bg-zinc-200 text-zinc-500'}`}>
          2. Pre-flight
        </div>
        <div className="flex-1 h-0.5 bg-zinc-200 dark:bg-zinc-800 mx-2" />
        <div className={`text-xs font-bold px-3 py-1.5 rounded-full ${step >= 3 ? 'bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f]' : 'bg-zinc-200 text-zinc-500'}`}>
          3. Process
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm">
          ⚠️ {error}
        </div>
      )}

      {degradedWarning && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          ⚠️ {degradedWarning}
        </div>
      )}

      {/* STEP 1: IMPORT STAGE */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Tab Switcher */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab('fetch')}
              className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wider text-center border-b-2 transition-all ${
                activeTab === 'fetch'
                  ? 'border-[#006b5c] text-[#006b5c] dark:border-[#55dbc4] dark:text-[#55dbc4]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              🌐 Live Scrape Feed
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wider text-center border-b-2 transition-all ${
                activeTab === 'upload'
                  ? 'border-[#006b5c] text-[#006b5c] dark:border-[#55dbc4] dark:text-[#55dbc4]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              📥 Upload Data File
            </button>
          </div>

          {activeTab === 'fetch' ? (
            <div className="glass-card p-6 rounded-2xl space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
                  🌐 Configure Scraper Sources
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase text-zinc-400">Dataset Name</label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="w-full p-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase text-zinc-400">Select Sources & Set Individual Limits</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: 'playstore', label: 'Google Play Store', supports: 'Region, Rating' },
                      { id: 'appstore', label: 'Apple App Store', supports: 'Real Feed' },
                      { id: 'reddit', label: 'Reddit Discussions', supports: 'Real Feed' },
                      { id: 'forums', label: 'Consumer Forums', supports: 'Region, Rating' },
                      { id: 'social', label: 'Social Media (X/Twitter)', supports: 'Region, Rating' },
                      { id: 'product_reviews', label: 'PDP Product Reviews', supports: 'Region, Rating' },
                      { id: 'quickcommerce', label: 'Quick Commerce Feed', supports: 'Region, Rating' },
                    ].map((s) => {
                      const isChecked = selectedSources.includes(s.id)
                      const cfg = sourceConfigs[s.id]
                      const limit = sourceLimits[s.id] || (cfg?.defaultLimit ?? 50)
                      const maxLimit = cfg?.maxLimit ?? 200
                      return (
                        <div
                          key={s.id}
                          className={`rounded-xl border text-left transition-all ${
                            isChecked
                              ? 'border-[#006b5c] bg-[#006b5c]/5 dark:border-[#55dbc4] dark:bg-[#55dbc4]/5'
                              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100'
                          }`}
                        >
                          <label className="flex items-start gap-3 p-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedSources((prev) =>
                                  prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                                )
                              }}
                              className="mt-0.5 rounded text-[#006b5c] dark:text-[#55dbc4] focus:ring-[#006b5c]"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">{s.label}</span>
                              <span className="block text-[10px] text-zinc-400 font-semibold uppercase">{s.supports}</span>
                              {cfg && (
                                <span className="block text-[9px] text-zinc-400 mt-0.5 truncate" title={cfg.description}>{cfg.description}</span>
                              )}
                            </div>
                          </label>
                          {isChecked && (
                            <div className="px-3 pb-3 pt-0">
                              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                                <span>Fetch Limit</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    max={maxLimit}
                                    value={limit}
                                    onChange={(e) => {
                                      const val = Math.min(maxLimit, Math.max(1, Number(e.target.value) || 1))
                                      setSourceLimits((prev) => ({ ...prev, [s.id]: val }))
                                    }}
                                    className="w-16 px-1.5 py-0.5 text-right font-bold text-xs text-[#006b5c] dark:text-[#55dbc4] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded focus:outline-none focus:border-[#006b5c]"
                                  />
                                  <span className="text-[10px] text-zinc-400">max {maxLimit}</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={maxLimit}
                                step={maxLimit > 1000 ? 50 : 5}
                                value={limit}
                                onChange={(e) => {
                                  const val = Number(e.target.value)
                                  setSourceLimits((prev) => ({ ...prev, [s.id]: val }))
                                }}
                                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#006b5c] dark:accent-[#55dbc4]"
                              />
                              <div className="flex justify-between text-[9px] text-zinc-400 mt-0.5">
                                <span>10</span>
                                <span>{maxLimit}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {selectedSources.length > 0 && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#006b5c]/10 dark:bg-[#55dbc4]/10 border border-[#006b5c]/20 dark:border-[#55dbc4]/20">
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Total reviews across {selectedSources.length} source{selectedSources.length > 1 ? 's' : ''}</span>
                      <span className="text-sm font-bold text-[#006b5c] dark:text-[#55dbc4]">{totalAmount}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold uppercase text-zinc-400">Target Region</label>
                    <select
                      value={fetchRegion}
                      onChange={(e) => setFetchRegion(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
                    >
                      <option value="All India">All India</option>
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Bengaluru">Bengaluru</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Pune">Pune</option>
                      <option value="Kolkata">Kolkata</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold uppercase text-zinc-400">Sorting</label>
                    <select
                      value={fetchSort}
                      onChange={(e) => setFetchSort(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
                    >
                      <option value="newest">Newest First</option>
                      <option value="helpful">Helpful Reviews</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold uppercase text-zinc-400">Min Rating</label>
                    <select
                      value={fetchMinRating === undefined ? '' : String(fetchMinRating)}
                      onChange={(e) => setFetchMinRating(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full p-2.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
                    >
                      <option value="">All Ratings</option>
                      <option value="1">1 Star +</option>
                      <option value="2">2 Stars +</option>
                      <option value="3">3 Stars +</option>
                      <option value="4">4 Stars +</option>
                      <option value="5">5 Stars only</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold uppercase text-zinc-400 flex justify-between">
                      <span>Total (per-source limits)</span>
                      <span className="text-[#006b5c] dark:text-[#55dbc4] font-bold">{totalAmount} reviews</span>
                    </label>
                    <p className="text-[10px] text-zinc-400">Individual limits set above per source. Adjust each source card to change.</p>
                  </div>
                </div>

                <div className="flex justify-start pt-2">
                  <button
                    type="button"
                    onClick={handleStartFetch}
                    disabled={isFetching}
                    className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-[#006b5c] hover:bg-[#005045] dark:bg-[#55dbc4] dark:text-[#00372f] dark:hover:bg-[#76f8e0] text-white disabled:opacity-50 flex items-center gap-2"
                  >
                    {isFetching ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white dark:border-[#00372f] border-t-transparent rounded-full animate-spin" />
                        Fetching Live Feeds...
                      </>
                    ) : (
                      'Scrape Live Reviews ⚡'
                    )}
                  </button>
                </div>

                {isFetching && (
                  <div className="mt-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-[#006b5c] dark:text-[#55dbc4] animate-pulse">
                        🔄 {statusText || 'Scraping reviews...'}
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-[#006b5c] transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Yield Decay / Fetch Stats Panel */}
              {fetchStats && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold uppercase text-zinc-400">Yield summary</span>
                    <span className="text-xs font-bold text-[#006b5c] dark:text-[#55dbc4]">
                      {Math.round((fetchStats.totalYieldKept / (fetchStats.totalRawFetched || 1)) * 100)}% Keep Rate
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border">
                      <span className="block text-[10px] text-zinc-400 uppercase font-bold">Raw reviews fetched</span>
                      <span className="text-lg font-extrabold">{fetchStats.totalRawFetched}</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border">
                      <span className="block text-[10px] text-zinc-400 uppercase font-bold">Curation yield (On-Topic)</span>
                      <span className="text-lg font-extrabold text-[#006b5c] dark:text-[#55dbc4]">{fetchStats.totalYieldKept}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="block text-[10px] text-zinc-400 uppercase font-bold mb-2">Source Breakdown</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(fetchStats.perSourceStats).map(([src, sStat]) => (
                        <div key={src} className="p-2 bg-white dark:bg-zinc-900 rounded-lg border text-center">
                          <span className="block text-[9px] uppercase font-bold text-zinc-400">{src}</span>
                          <span className="text-xs font-bold">{sStat.yieldKept} / {sStat.rawFetched}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Scraped and Cleaned Data Section */}
              {reviews.length > 0 && (
                <div className="pt-2">
                  <ScrapedDataViewer reviews={reviews} />
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
                📥 Load raw files
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase text-zinc-400">Dataset Name</label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="w-full p-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase text-zinc-400">Default Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full p-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
                  >
                    <option value="playstore">Play Store</option>
                    <option value="appstore">App Store</option>
                    <option value="reddit">Reddit Discussions</option>
                    <option value="forums">Forums</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-extrabold uppercase text-zinc-400">Raw Reviews (JSON array or CSV rows)</label>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="text-xs font-semibold text-[#006b5c] dark:text-[#55dbc4] underline hover:no-underline"
                  >
                    Auto-fill demo reviews
                  </button>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder='[{"id":"1","text":"Review text..."},{"id":"2","text":"Other review..."}]'
                  rows={10}
                  className="w-full p-3 font-mono text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleProceedToPreflight}
              className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-[#006b5c] text-white hover:bg-[#005045] dark:bg-[#55dbc4] dark:text-[#00372f] dark:hover:bg-[#76f8e0] transition-colors"
            >
              Next: Pre-flight check ➔
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PRE-FLIGHT ESTIMATE */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl space-y-6">
            <h3 className="text-sm font-extrabold text-[#446279] dark:text-[#accae5] uppercase tracking-wider">
              🚦 Pre-flight cost & load estimation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150">
                <span className="block text-[10px] uppercase text-zinc-400 font-bold">Corpus Size</span>
                <span className="text-xl font-extrabold text-zinc-900 dark:text-white">{reviews.length} reviews</span>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150">
                <span className="block text-[10px] uppercase text-zinc-400 font-bold">Estimated Tokens</span>
                <span className="text-xl font-extrabold text-zinc-900 dark:text-white">{estTokens.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150">
                <span className="block text-[10px] uppercase text-zinc-400 font-bold">Estimated LLM Cost</span>
                <span className="text-xl font-extrabold text-[#006b5c] dark:text-[#55dbc4]">${estCost}</span>
              </div>
            </div>

            {/* Daily TPD and RPD quotas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="space-y-2 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-500">DAILY TOKENS (TPD)</span>
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {tpdConsumed.toLocaleString()} / {tpdLimit.toLocaleString()} consumed
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400"
                    style={{ width: `${Math.min(((tpdConsumed + estTokens) / tpdLimit) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                  <span>This run adds +{estTokens.toLocaleString()} tokens</span>
                  <span>Remaining: {Math.max(0, tpdLimit - tpdConsumed - estTokens).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-500">DAILY REQUESTS (RPD)</span>
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {rpdConsumed.toLocaleString()} / {rpdLimit.toLocaleString()} consumed
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400"
                    style={{ width: `${Math.min(((rpdConsumed + Math.ceil(reviews.length / batchSize)) / rpdLimit) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                  <span>This run adds +{Math.ceil(reviews.length / batchSize)} requests</span>
                  <span>Remaining: {Math.max(0, rpdLimit - rpdConsumed - Math.ceil(reviews.length / batchSize)).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* TPM / RPM Model Rate Limits Info */}
            <div className="p-3.5 bg-teal-50 dark:bg-teal-950/20 border border-teal-500/20 rounded-xl text-[11px] text-teal-700 dark:text-teal-400 flex items-center gap-2">
              <span>⚡</span>
              <span><strong>Rate Limit Pacing Active:</strong> The classification pipeline automatically limits requests to max 30 RPM (Requests Per Minute) and 30,000 TPM (Tokens Per Minute) to ensure zero 429 quota exhaustion errors. Mock mode is fully disabled.</span>
            </div>
          </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                « Back
              </button>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowChunkingMonitor(true)}
                  className="px-4 py-2.5 text-xs font-bold rounded-lg border border-[#006b5c]/30 text-[#006b5c] dark:border-[#55dbc4]/30 dark:text-[#55dbc4] bg-[#006b5c]/5 hover:bg-[#006b5c]/10 transition-colors"
                >
                  ⚙️ Chunking & Monitor Config
                </button>
                <button
                  onClick={handleSaveForLater}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
                >
                  📁 Save Corpus
                </button>
                <button
                  onClick={() => handleStartAnalysis()}
                  className="px-6 py-2.5 text-xs font-bold rounded-lg bg-[#006b5c] text-white hover:bg-[#005045] dark:bg-[#55dbc4] dark:text-[#00372f] dark:hover:bg-[#76f8e0] transition-colors shadow-md"
                >
                  Start Analysis Pipeline 🚀
                </button>
              </div>
            </div>
          </div>
        )}

      {/* STEP 2.5: CLEANING & CHUNKING MONITOR MODAL/SCREEN */}
      {step === 2 && showChunkingMonitor && (
        <CleaningChunkingMonitor
          reviews={reviews}
          onLaunch={(opts) => handleStartAnalysis(opts)}
          onBack={() => setShowChunkingMonitor(false)}
        />
      )}

      {/* STEP 3: ADVANCED LIVE PIPELINE PROGRESS MONITOR */}
      {step === 3 && (
        <div className="space-y-6 max-w-xl mx-auto py-12">
          <div className="glass-card p-8 rounded-3xl space-y-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            {/* Top Spinner & Active Stage Title */}
            <div className="flex items-center gap-4 pb-4 border-b border-zinc-150 dark:border-zinc-800">
              <div className="relative w-12 h-12 flex-shrink-0">
                <div className="absolute inset-0 border-4 border-zinc-200 dark:border-zinc-800 border-t-[#006b5c] dark:border-t-[#55dbc4] rounded-full animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>ReviewLens AI Engine</span>
                  <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold bg-[#006b5c]/10 text-[#006b5c] dark:bg-[#55dbc4]/10 dark:text-[#55dbc4] rounded-full">
                    {pipelineState}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  {statusText}
                </p>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Pipeline Overall Progress</span>
                <span className="text-[#006b5c] dark:text-[#55dbc4] font-extrabold">{progressPct}%</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden p-0.5 border border-zinc-200 dark:border-zinc-700">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 via-[#006b5c] to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Live Micro-Batch Chunk Progress Tracker */}
            {chunkProgress.totalChunks > 0 && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-3 text-center">
                <div>
                  <span className="block text-[10px] text-zinc-400 uppercase font-extrabold">Active Chunk</span>
                  <span className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4]">
                    #{chunkProgress.currentChunk} of {chunkProgress.totalChunks}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400 uppercase font-extrabold">Items Processed</span>
                  <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">
                    {chunkProgress.processedCount} / {chunkProgress.relevantCount}
                  </span>
                </div>
              </div>
            )}

            {/* Phase Checklist Monitor */}
            <div className="space-y-2.5 pt-2">
              <span className="block text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">Pipeline Execution Checklist</span>
              
              <div className="space-y-2 text-xs">
                {/* Phase 1 */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Phase 1: Scraping & Source Normalization</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">✓ Done ({reviews.length})</span>
                </div>

                {/* Phase 2 */}
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  pipelineState === 'curating'
                    ? 'border-[#006b5c]/40 bg-[#006b5c]/5 dark:border-[#55dbc4]/40 dark:bg-[#55dbc4]/5'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
                }`}>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Phase 2: Exploration Relevance Curation</span>
                  <span className="font-extrabold">
                    {pipelineState === 'curating' ? (
                      <span className="text-[#006b5c] dark:text-[#55dbc4] animate-pulse">🔄 Filtering...</span>
                    ) : curationStats ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓ {curationStats.sentToClassification ?? reviews.length} Relevant</span>
                    ) : (
                      <span className="text-zinc-400">⏳ Pending</span>
                    )}
                  </span>
                </div>

                {/* Phase 3 */}
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  pipelineState === 'classifying'
                    ? 'border-[#006b5c]/40 bg-[#006b5c]/5 dark:border-[#55dbc4]/40 dark:bg-[#55dbc4]/5'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
                }`}>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Phase 3: Taxonomy Classification</span>
                  <span className="font-extrabold">
                    {pipelineState === 'classifying' ? (
                      <span className="text-[#006b5c] dark:text-[#55dbc4] animate-pulse">🔄 Classifying...</span>
                    ) : pipelineState === 'aggregating' || pipelineState === 'findings' || pipelineState === 'persisting' || pipelineState === 'complete' ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓ Classified</span>
                    ) : (
                      <span className="text-zinc-400">⏳ Pending</span>
                    )}
                  </span>
                </div>

                {/* Phase 4 */}
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  pipelineState === 'aggregating' || pipelineState === 'findings' || pipelineState === 'persisting'
                    ? 'border-[#006b5c]/40 bg-[#006b5c]/5 dark:border-[#55dbc4]/40 dark:bg-[#55dbc4]/5'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
                }`}>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Phase 4: Synthesis & Executive Report</span>
                  <span className="font-extrabold">
                    {pipelineState === 'aggregating' || pipelineState === 'findings' || pipelineState === 'persisting' ? (
                      <span className="text-[#006b5c] dark:text-[#55dbc4] animate-pulse">🔄 Synthesizing...</span>
                    ) : pipelineState === 'complete' ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓ Complete</span>
                    ) : (
                      <span className="text-zinc-400">⏳ Pending</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: CURATION EMPTY REMEDIATION */}
      {step === 4 && (
        <CurationEmpty
          curationStats={curationStats}
          onReset={() => {
            setStep(1)
            setPipelineState('idle')
          }}
          onBypass={() => {
            handleStartAnalysis({ bypassCuration: true })
          }}
        />
      )}
    </div>
  )
}

