'use client'

import React, { useState, useMemo } from 'react'
import { RawReview } from '../lib/types'

interface ScrapedDataViewerProps {
  reviews: RawReview[]
}

const SOURCE_LABELS: Record<string, { label: string; color: string; border: string; bg: string }> = {
  playstore: {
    label: 'Play Store',
    color: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  appstore: {
    label: 'App Store',
    color: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
  },
  reddit: {
    label: 'Reddit',
    color: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
  },
  forums: {
    label: 'Forums',
    color: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
  },
  social: {
    label: 'Social (X/Twitter)',
    color: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  product_reviews: {
    label: 'Product Reviews',
    color: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  quickcommerce: {
    label: 'Quick Commerce',
    color: 'text-teal-700 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
  },
}

export function ScrapedDataViewer({ reviews }: ScrapedDataViewerProps) {
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'json'>('cards')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 10

  // Extract counts per source
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: reviews.length }
    reviews.forEach((r) => {
      counts[r.source] = (counts[r.source] || 0) + 1
    })
    return counts
  }, [reviews])

  // Filter reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const textMatch = r.text.toLowerCase().includes(q)
        const cityMatch = (r.city || '').toLowerCase().includes(q)
        const idMatch = (r.review_id || '').toLowerCase().includes(q)
        return textMatch || cityMatch || idMatch
      }
      return true
    })
  }, [reviews, sourceFilter, searchQuery])

  // Reset pagination when filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [sourceFilter, searchQuery])

  const totalPages = Math.ceil(filteredReviews.length / pageSize) || 1
  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredReviews.slice(start, start + pageSize)
  }, [filteredReviews, currentPage, pageSize])

  const renderStars = (rating?: number) => {
    if (!rating) return null
    return (
      <div className="flex items-center gap-0.5 text-amber-500 text-xs" title={`Rating: ${rating}/5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star}>{star <= rating ? '★' : '☆'}</span>
        ))}
      </div>
    )
  }

  return (
    <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-150 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
              🧹 Scraped & Cleaned Reviews
            </h3>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#006b5c]/10 text-[#006b5c] dark:bg-[#55dbc4]/10 dark:text-[#55dbc4]">
              {reviews.length} total
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Normalized, deduplicated & entity-decoded data ready for AI analysis
          </p>
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            🎴 Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            📊 Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'json'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {'{ }'} JSON
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Source Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap transition-all ${
              sourceFilter === 'all'
                ? 'bg-[#006b5c] text-white border-[#006b5c] dark:bg-[#55dbc4] dark:text-[#00372f] dark:border-[#55dbc4]'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
            }`}
          >
            All ({sourceCounts['all'] || 0})
          </button>
          {Object.keys(sourceCounts)
            .filter((s) => s !== 'all')
            .map((srcKey) => {
              const meta = SOURCE_LABELS[srcKey] || { label: srcKey, color: 'text-zinc-600', border: 'border-zinc-200', bg: 'bg-zinc-50' }
              const isSelected = sourceFilter === srcKey
              return (
                <button
                  key={srcKey}
                  type="button"
                  onClick={() => setSourceFilter(srcKey)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap transition-all ${
                    isSelected
                      ? `${meta.bg} ${meta.border} ${meta.color} ring-1 ring-current`
                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                  }`}
                >
                  {meta.label} ({sourceCounts[srcKey]})
                </button>
              )
            })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cleaned text..."
            className="w-full pl-7 pr-7 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c] text-zinc-800 dark:text-zinc-200"
          />
          <span className="absolute left-2 top-2 text-xs text-zinc-400">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-xs text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          {paginatedReviews.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed">
              No matching cleaned reviews found for query &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedReviews.map((r, idx) => {
                const meta = SOURCE_LABELS[r.source] || { label: r.source, color: 'text-zinc-600', border: 'border-zinc-200', bg: 'bg-zinc-50' }
                const globalIndex = (currentPage - 1) * pageSize + idx + 1
                return (
                  <div
                    key={r.review_id || `${r.source}_${globalIndex}`}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between gap-2"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${meta.bg} ${meta.border} ${meta.color}`}>
                          {meta.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {renderStars(r.rating)}
                          <span className="text-[10px] font-mono text-zinc-400">#{globalIndex}</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans font-medium">
                        &quot;{r.text}&quot;
                      </p>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-150/50 dark:border-zinc-800/50">
                      <div className="flex items-center gap-2">
                        {r.city && <span>📍 {r.city}</span>}
                        {r.date && <span>📅 {r.date}</span>}
                      </div>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#006b5c] dark:text-[#55dbc4] font-semibold hover:underline"
                        >
                          View Link ↗
                        </a>
                      ) : (
                        r.review_id && <span className="font-mono text-[9px] text-zinc-400">ID: {r.review_id}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-100 dark:bg-zinc-950 text-[10px] uppercase text-zinc-400 font-extrabold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-2.5">#</th>
                <th className="p-2.5">Source</th>
                <th className="p-2.5">Cleaned Text</th>
                <th className="p-2.5">Rating</th>
                <th className="p-2.5">Region</th>
                <th className="p-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
              {paginatedReviews.map((r, idx) => {
                const meta = SOURCE_LABELS[r.source] || { label: r.source, color: 'text-zinc-600', border: 'border-zinc-200', bg: 'bg-zinc-50' }
                const globalIndex = (currentPage - 1) * pageSize + idx + 1
                return (
                  <tr key={r.review_id || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/50">
                    <td className="p-2.5 font-mono text-[10px] text-zinc-400">{globalIndex}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${meta.bg} ${meta.border} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-2.5 font-medium max-w-md">{r.text}</td>
                    <td className="p-2.5">{r.rating ? `${r.rating}★` : '-'}</td>
                    <td className="p-2.5 text-zinc-500">{r.city || '-'}</td>
                    <td className="p-2.5 text-zinc-500 whitespace-nowrap">{r.date || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'json' && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(filteredReviews, null, 2))
              alert('Cleaned reviews copied to clipboard as JSON!')
            }}
            className="absolute right-3 top-3 px-3 py-1 text-[10px] font-bold rounded bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f] hover:opacity-90"
          >
            📋 Copy JSON
          </button>
          <textarea
            readOnly
            value={JSON.stringify(filteredReviews, null, 2)}
            rows={14}
            className="w-full p-3 font-mono text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-emerald-400 focus:outline-none"
          />
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && viewMode !== 'json' && (
        <div className="flex items-center justify-between pt-2 text-xs text-zinc-500 border-t border-zinc-150 dark:border-zinc-800">
          <span>
            Showing <strong className="text-zinc-800 dark:text-zinc-200">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-zinc-800 dark:text-zinc-200">
              {Math.min(currentPage * pageSize, filteredReviews.length)}
            </strong>{' '}
            of <strong className="text-zinc-800 dark:text-zinc-200">{filteredReviews.length}</strong> cleaned reviews
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg border text-xs font-semibold bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 disabled:opacity-40"
            >
              ◀ Prev
            </button>
            <span className="px-2 font-bold text-zinc-700 dark:text-zinc-300">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-lg border text-xs font-semibold bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 disabled:opacity-40"
            >
              Next ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
