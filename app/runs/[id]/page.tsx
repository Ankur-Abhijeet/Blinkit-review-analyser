'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Run, ClassifiedReview } from '@/lib/types'
import ReportSection from '@/components/ReportSection'
import EvidenceSection from '@/components/EvidenceSection'
import OpportunitiesSection from '@/components/OpportunitiesSection'
import EvidenceDrawer from '@/components/EvidenceDrawer'
import FullPrintReport from '@/components/FullPrintReport'
import { openPrintablePdfWindow, downloadPdfFile } from '@/lib/export'
import { DemoBadge } from '@/components/DemoToggle'
import { apiFetch } from '@/lib/api'

export default function RunDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = params.id as string

  const [run, setRun] = useState<Run | null>(null)
  const [reviews, setReviews] = useState<ClassifiedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Client-side projection filters
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [minConfidence, setMinConfidence] = useState(0.0) // 0..1
  const [activeTab, setActiveTab] = useState<'report' | 'evidence' | 'opportunities'>('report')

  // Sliding Drawer target
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLabel, setDrawerLabel] = useState('')

  useEffect(() => {
    if (!id) return
    setTimeout(() => setLoading(true), 0)
    apiFetch(`/api/runs/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load research run: status ${res.status}`)
        }
        return res.json()
      })
      .then((data: { run: Run; reviews: ClassifiedReview[] }) => {
        setRun(data.run)
        setReviews(data.reviews)
        // Initial sources mix
        const sources = new Set(data.reviews.map((r) => r.source))
        setSelectedSources(sources)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setTimeout(() => setLoading(false), 0)
      })
  }, [id])

  // Open drawer automatically if query param `label` is present
  useEffect(() => {
    const label = searchParams.get('label')
    if (label) {
      setTimeout(() => {
        setDrawerLabel(label)
        setDrawerOpen(true)
      }, 0)
    }
  }, [searchParams])

  const handleOpenLabel = (label: string) => {
    setDrawerLabel(label)
    setDrawerOpen(true)
    // Update URL query parameter
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set('label', label)
    router.push(`?${newParams.toString()}`, { scroll: false })
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.delete('label')
    router.push(`?${newParams.toString()}`, { scroll: false })
  }

  // Filter reviews based on client-side state
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const matchesSource = selectedSources.has(r.source)
      const matchesConfidence = r.confidence >= minConfidence
      return matchesSource && matchesConfidence
    })
  }, [reviews, selectedSources, minConfidence])

  // Project findings & opportunity quotes in real-time
  const projectedRun = useMemo(() => {
    if (!run) return null

    const validIds = new Set(filteredReviews.map((r) => r.review_id))

    // Filter quotes inside findings safely
    const rawFindings = run.findings || []
    const findings = rawFindings.map((f) => ({
      ...f,
      representative_quotes: (f.representative_quotes || []).filter((q) => validIds.has(q.review_id)),
    }))

    // Filter quotes inside opportunities safely
    const execReport = run.executive_report || {
      scorecard: { launchReadinessIndex: 0, categoryUnmetNeedScore: 0, sentimentBalance: 0, confidenceScore: 0 },
      verdict: 'Needs Attention',
      opportunities: [],
      rejectedOpportunities: [],
    }

    const rawOpps = execReport.opportunities || []
    const opportunities = rawOpps.map((opp) => ({
      ...opp,
      representative_quotes: (opp.representative_quotes || []).filter((q) => validIds.has(q.review_id)),
    }))

    return {
      ...run,
      findings,
      executive_report: {
        ...execReport,
        opportunities,
        rejectedOpportunities: execReport.rejectedOpportunities || [],
      },
    }
  }, [run, filteredReviews])

  const toggleSource = (source: string) => {
    const next = new Set(selectedSources)
    if (next.has(source)) {
      next.delete(source)
    } else {
      next.add(source)
    }
    setSelectedSources(next)
  }

  if (loading) {
    return (
      <div className="text-center py-32 space-y-4">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-[#006b5c] rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-400 font-semibold">Analyzing persisted dataset...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-16 p-6 bg-red-50 text-red-800 rounded-xl border border-red-200">
        <h2 className="font-extrabold text-base mb-2">⚠️ Persistent Error loading run</h2>
        <p className="text-sm">{error}</p>
        <Link href="/history" className="inline-block mt-4 text-xs font-semibold underline text-[#ba1a1a]">
          Return to History Archive
        </Link>
      </div>
    )
  }

  if (!projectedRun) return null

  // Collect all unique sources from raw reviews to show filter toggles
  const uniqueSources = Array.from(new Set(reviews.map((r) => r.source)))

  return (
    <div className="flex flex-col min-h-screen">
      {/* Dynamic persistent Demo badge if mock is enabled */}
      <DemoBadge forceShow={projectedRun.mock} />

      <div className="max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8 flex-1">
        {/* Header Metadata */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider">
                Run #{projectedRun.seq}
              </span>
              <span className="text-xs text-zinc-500 font-medium">
                {new Date(projectedRun.created_at).toLocaleString('en-IN')}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {projectedRun.dataset_name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-500 font-medium">
              <span>Model: <strong>{projectedRun.provider} ({projectedRun.model})</strong></span>
              <span>•</span>
              <span>Taxonomy: <strong>v{projectedRun.taxonomy_version}</strong></span>
              <span>•</span>
              <span>Scope: <strong>{projectedRun.environment}</strong></span>
            </div>
          </div>

          <div className="no-print flex items-center gap-2">
            <button
              onClick={() => downloadPdfFile(projectedRun)}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#006b5c] text-white hover:bg-[#005045] dark:bg-[#55dbc4] dark:text-[#00372f] dark:hover:bg-[#76f8e0] shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>📥 Download PDF File</span>
            </button>
            <button
              onClick={() => openPrintablePdfWindow(projectedRun)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              title="Open Printable Document Window"
            >
              📄 Printable Window
            </button>
            <Link
              href="/history"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              📁 History Archive
            </Link>
          </div>
        </div>

        {/* Global Statistics Counts & KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Total Scrapings</span>
            <span className="text-2xl font-black text-zinc-900 dark:text-white">{projectedRun.total_reviews}</span>
          </div>
          <div className="glass-card p-5 rounded-2xl">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Exploration Relevant</span>
            <span className="text-2xl font-black text-[#006b5c] dark:text-[#55dbc4]">
              {projectedRun.exploration_relevant_count}
            </span>
          </div>
          <div className="glass-card p-5 rounded-2xl">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Excluded (Noise)</span>
            <span className="text-2xl font-black text-[#ba1a1a] dark:text-[#ffb4ab]">
              {projectedRun.excluded_count}
            </span>
          </div>
          <div className="glass-card p-5 rounded-2xl bg-gradient-to-br from-[#cce8e2] to-[#dae5e1] dark:from-[#005045]/40 dark:to-zinc-900 border-none">
            <span className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">Readiness Score</span>
            <span className="text-2xl font-black text-[#00201a] dark:text-white">{projectedRun.readiness_score} / 10</span>
          </div>
        </div>

        {/* Client-Side Projections Filters (P4-T10) */}
        <div className="no-print p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">
            🔎 Client-Side Projection Filters
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            {/* Source chips selection */}
            <div className="space-y-2">
              <span className="block text-[10px] uppercase font-bold text-zinc-400">Sources</span>
              <div className="flex flex-wrap gap-2">
                {uniqueSources.map((source) => (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedSources.has(source)
                        ? 'bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f]'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {source.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence threshold slider */}
            <div className="flex-1 max-w-xs space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="uppercase font-bold text-zinc-400 text-[10px]">Min Confidence</span>
                <strong className="text-zinc-800 dark:text-zinc-200">
                  {Math.round(minConfidence * 100)}%
                </strong>
              </div>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#006b5c] dark:accent-[#55dbc4]"
              />
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Filtered subset: <strong>{filteredReviews.length}</strong> of <strong>{reviews.length}</strong> reviews</span>
            {filteredReviews.length === 0 && <span className="text-[#ba1a1a] font-semibold animate-pulse">⚠️ No reviews survive filters</span>}
          </div>
        </div>

        {/* Sub-view Section Tabs */}
        <div className="no-print flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('report')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'report'
                ? 'border-[#006b5c] text-[#006b5c] dark:border-[#55dbc4] dark:text-[#55dbc4]'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            📋 Executive Report
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'evidence'
                ? 'border-[#006b5c] text-[#006b5c] dark:border-[#55dbc4] dark:text-[#55dbc4]'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            📊 Corpus Evidence
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'opportunities'
                ? 'border-[#006b5c] text-[#006b5c] dark:border-[#55dbc4] dark:text-[#55dbc4]'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            💡 Root Causes & Opportunities
          </button>
        </div>

        {/* Section rendering (Screen view only) */}
        <div className="no-print space-y-6">
          {activeTab === 'report' && (
            <ReportSection
              report={projectedRun.executive_report}
              readinessScore={projectedRun.readiness_score}
              readinessGaps={projectedRun.readiness_gaps}
              onOpenLabelSearch={handleOpenLabel}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidenceSection
              aggregation={projectedRun.aggregation}
              onOpenLabelSearch={handleOpenLabel}
            />
          )}

          {activeTab === 'opportunities' && (
            <OpportunitiesSection
              opportunities={projectedRun.executive_report?.opportunities || []}
              rejectedOpportunities={projectedRun.executive_report?.rejectedOpportunities || []}
              onOpenLabelSearch={handleOpenLabel}
            />
          )}
        </div>

        {/* In-depth Full Print Report (PDF export view) */}
        <FullPrintReport run={projectedRun} />
      </div>

      {/* Global sliding Evidence Drawer */}
      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        label={drawerLabel}
        reviews={filteredReviews}
      />
    </div>
  )
}
