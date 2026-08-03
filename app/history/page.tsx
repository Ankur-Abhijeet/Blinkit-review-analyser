'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Run } from '../../lib/types'

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRuns = async () => {
    try {
      setTimeout(() => setLoading(true), 0)
      const res = await fetch('/api/runs')
      if (!res.ok) {
        throw new Error(`Failed to load historical runs: status ${res.status}`)
      }
      const data = await res.json()
      setRuns(data.runs || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTimeout(() => {
      fetchRuns()
    }, 0)
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this research run? This action is permanent.')) {
      return
    }

    try {
      await fetch(`/api/runs/${id}`, { method: 'DELETE' })
      setRuns((prev) => prev.filter((r) => r.id !== id))
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
            Research History & Archives
          </h1>
          <p className="text-sm text-zinc-500 font-medium">
            Browse, manage, and load historically completed Blinkit discovery reports.
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 text-xs font-bold uppercase rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
        >
          ← New Run
        </Link>
      </div>

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-8 h-8 rounded-full border-4 border-zinc-200 border-t-[#006b5c] animate-spin" />
          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Retrieving run archives...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-[#ffdad6] text-[#410002] border border-[#ba1a1a]/20 text-sm font-semibold max-w-xl mx-auto">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="text-center py-24 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 bg-white dark:bg-zinc-900/20">
          <span className="text-5xl block">🏜️</span>
          <h3 className="font-bold text-zinc-700 dark:text-zinc-300">No runs stored</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            You haven&apos;t run any research reports yet. Scrape some reviews and run classification to persist them!
          </p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {runs.map((run) => {
            const dateStr = new Date(run.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <div
                key={run.id}
                className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:shadow-lg transition-all duration-200 space-y-6"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">
                      Run #{run.seq}
                    </span>
                    <span className="text-xs font-semibold text-zinc-500">
                      {dateStr}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white line-clamp-1">
                    {run.dataset_name}
                  </h3>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
                  <div>
                    <span className="block text-[9px] uppercase text-zinc-400 font-bold">Total Reviews</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">{run.total_reviews}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-zinc-400 font-bold">Readiness Score</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">{run.readiness_score}/10</strong>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                    <span className="block text-[9px] uppercase text-zinc-400 font-bold">LLM Provider</span>
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      {run.provider} ({run.model})
                    </span>
                  </div>
                </div>

                {/* Badges and actions */}
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {run.mock ? (
                      <span className="demo-badge px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/20">
                        OFFLINE DEMO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                        LIVE API
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      v{run.taxonomy_version}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/runs/${run.id}`}
                      className="flex-1 text-center py-2 text-xs font-semibold rounded-lg bg-[#006b5c] text-white hover:bg-[#005045] dark:bg-[#55dbc4] dark:text-[#00372f] dark:hover:bg-[#76f8e0] transition-colors"
                    >
                      Open Dashboard
                    </Link>
                    <button
                      onClick={() => handleDelete(run.id)}
                      className="p-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-[#ba1a1a] transition-all"
                      title="Delete run"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
