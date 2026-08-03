'use client'

import React, { useState, useMemo } from 'react'
import { ClassifiedReview } from '../lib/types'

interface EvidenceDrawerProps {
  isOpen: boolean
  onClose: () => void
  label: string // The label we are searching for (could be a theme, barrier, root cause, segment, or empty for all)
  reviews: ClassifiedReview[]
}

export default function EvidenceDrawer({ isOpen, onClose, label, reviews }: EvidenceDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Reset search when label changes
  React.useEffect(() => {
    setTimeout(() => setSearchQuery(''), 0)
  }, [label])

  // Filter reviews matching the active label and optional search query
  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      // 1. Label match
      const l = label.toLowerCase().trim()
      let matchesLabel = false

      if (!l) {
        matchesLabel = true
      } else {
        matchesLabel =
          r.theme.toLowerCase() === l ||
          r.barrier.toLowerCase() === l ||
          r.behavior.toLowerCase() === l ||
          r.emotion.toLowerCase() === l ||
          r.segment.toLowerCase() === l ||
          r.root_cause.toLowerCase() === l ||
          r.unmet_need.toLowerCase() === l ||
          (r.mentioned_categories &&
            r.mentioned_categories.some((cat) => cat.toLowerCase() === l))
      }

      // 2. Search query match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesQuery =
          r.text.toLowerCase().includes(query) ||
          r.source.toLowerCase().includes(query) ||
          r.segment.toLowerCase().includes(query) ||
          r.theme.toLowerCase().includes(query) ||
          r.barrier.toLowerCase().includes(query)
        return matchesLabel && matchesQuery
      }

      return matchesLabel
    })
  }, [reviews, label, searchQuery])

  // Aggregate stats from filtered set
  const stats = useMemo(() => {
    if (filtered.length === 0) {
      return { meanConfidence: 0, sources: {} as Record<string, number> }
    }

    let sumConf = 0
    const sources: Record<string, number> = {}

    filtered.forEach((r) => {
      sumConf += r.confidence
      sources[r.source] = (sources[r.source] || 0) + 1
    })

    return {
      meanConfidence: sumConf / filtered.length,
      sources,
    }
  }, [filtered])

  const getSourceStyle = (source: string) => {
    switch (source.toLowerCase()) {
      case 'playstore':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'appstore':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'reddit':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'forums':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="w-screen max-w-2xl transform bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full relative transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="p-6 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              📖 Evidence Explorer
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-2xl font-bold p-1 leading-none"
            >
              ✕
            </button>
          </div>
          {label && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Active Filter:</span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#cce8e2] text-[#00201a] dark:bg-[#005045] dark:text-[#76f8e0]">
                {label}
              </span>
            </div>
          )}
        </div>

        {/* Stats summary panel */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 grid grid-cols-2 gap-4">
          <div>
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Yield Count</span>
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-white">{filtered.length} reviews</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Mean Confidence</span>
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-white">
              {Math.round(stats.meanConfidence * 100)}%
            </span>
          </div>
        </div>

        {/* Source mix distribution filter */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-zinc-400">Sources:</span>
          {Object.entries(stats.sources).map(([source, count]) => (
            <span
              key={source}
              className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 ${getSourceStyle(source)}`}
            >
              {source.toUpperCase()} <span className="opacity-60">({count})</span>
            </span>
          ))}
          {filtered.length === 0 && <span className="text-xs text-zinc-400 italic">None</span>}
        </div>

        {/* Local Search input */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="relative">
            <input
              type="text"
              placeholder="Search content, source, labels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            />
            <span className="absolute left-3.5 top-2.5 text-zinc-400 text-sm">🔍</span>
          </div>
        </div>

        {/* Review list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/20">
          {filtered.map((r, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm space-y-3 hover:shadow transition-shadow duration-150"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${getSourceStyle(r.source)}`}>
                    {r.source}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    👤 {r.segment}
                  </span>
                  {r.rating !== undefined && (
                    <span className="text-xs text-amber-500 font-bold">
                      ★ {r.rating}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {Math.round(r.confidence * 100)}% Conf
                </span>
              </div>

              <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                &quot;{r.text}&quot;
              </p>

              {/* Taxonomy tags in review */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                <div>
                  Theme: <strong className="text-zinc-700 dark:text-zinc-300">{r.theme}</strong>
                </div>
                <div>
                  Barrier: <strong className="text-zinc-700 dark:text-zinc-300">{r.barrier}</strong>
                </div>
                <div>
                  Root Cause: <strong className="text-zinc-700 dark:text-zinc-300">{r.root_cause}</strong>
                </div>
                <div>
                  Unmet Need: <strong className="text-zinc-700 dark:text-zinc-300">{r.unmet_need}</strong>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <span className="text-4xl">🏜️</span>
              <h3 className="font-bold text-zinc-700 dark:text-zinc-300">No matching reviews</h3>
              <p className="text-xs text-zinc-400">Try adjusting your filters or search query.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
