'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Run } from '../../../lib/types'

export default function RunComparePage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [baseRunId, setBaseRunId] = useState('')
  const [targetRunId, setTargetRunId] = useState('')
  const [comparison, setComparison] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mismatchError, setMismatchError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch('/api/history')
        if (res.ok) {
          const data = await res.json()
          const list = data.runs || []
          setRuns(list)
          if (list.length >= 2) {
            setBaseRunId(list[1].id)
            setTargetRunId(list[0].id)
          } else if (list.length === 1) {
            setBaseRunId(list[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch runs:', err)
      }
    }
    fetchRuns()
  }, [])

  const handleCompare = async () => {
    if (!baseRunId || !targetRunId) {
      setError('Please select both a base run and a target run to compare.')
      return
    }

    if (baseRunId === targetRunId) {
      setError('Base run and target run must be different.')
      return
    }

    setLoading(true)
    setError('')
    setMismatchError(null)
    setComparison(null)

    try {
      const res = await fetch('/api/runs/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRunId, targetRunId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.mismatch) {
          setMismatchError(data.error)
        } else {
          setError(data.error || 'Failed to compare runs.')
        }
        return
      }

      setComparison(data.comparison)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error comparing runs.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 space-y-8">
      <div className="flex justify-between items-center border-b border-slate-800 pb-6">
        <div>
          <Link href="/history" className="text-teal-400 text-xs font-bold hover:underline">
            ← Back to History
          </Link>
          <h1 className="text-2xl font-extrabold text-white mt-2">📊 Run Comparison & Trend Analysis</h1>
        </div>
      </div>

      {/* Selectors Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-xs font-extrabold uppercase text-teal-400 tracking-wider">Select Runs to Compare</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1">Base Run (Baseline / Past Month)</label>
            <select
              value={baseRunId}
              onChange={(e) => setBaseRunId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100"
            >
              <option value="">Select Base Run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.dataset_name} ({r.created_at.split('T')[0]}) [v{r.taxonomy_version}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1">Target Run (Current / Recent Month)</label>
            <select
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100"
            >
              <option value="">Select Target Run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.dataset_name} ({r.created_at.split('T')[0]}) [v{r.taxonomy_version}]
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          onClick={handleCompare}
          disabled={loading || !baseRunId || !targetRunId}
          className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs transition-colors"
        >
          {loading ? 'Comparing...' : 'Compare Runs 🔄'}
        </button>
      </div>

      {/* Mismatch Guard Error Alert */}
      {mismatchError && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-6 text-rose-200 space-y-2 shadow-xl">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Taxonomy Version Equality Guard Triggered</span>
          </div>
          <p className="text-xs text-rose-200/90 leading-relaxed">{mismatchError}</p>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Director Readiness Delta</span>
              <div className="text-2xl font-extrabold text-teal-400">
                {comparison.deltas.readinessDelta >= 0 ? `+${comparison.deltas.readinessDelta}` : comparison.deltas.readinessDelta} pts
              </div>
              <span className="text-[10px] text-slate-500">
                Base: {comparison.baseRun.readiness_score} → Target: {comparison.targetRun.readiness_score}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Analyzed Reviews Delta</span>
              <div className="text-2xl font-extrabold text-teal-400">
                {comparison.deltas.reviewsDelta >= 0 ? `+${comparison.deltas.reviewsDelta}` : comparison.deltas.reviewsDelta}
              </div>
              <span className="text-[10px] text-slate-500">
                Base: {comparison.baseRun.total_reviews} → Target: {comparison.targetRun.total_reviews}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Taxonomy Space Version</span>
              <div className="text-2xl font-extrabold text-emerald-400">
                v{comparison.baseRun.taxonomy_version}
              </div>
              <span className="text-[10px] text-emerald-500 font-semibold">✓ Verified Matching Taxonomy Space</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
