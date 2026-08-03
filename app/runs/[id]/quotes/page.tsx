'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClassifiedReview } from '../../../../lib/types'

export default function QuoteExplorerPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params.id as string

  const [query, setQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState('all')
  const [selectedTheme, setSelectedTheme] = useState('all')
  const [selectedBarrier, setSelectedBarrier] = useState('all')
  const [selectedSegment, setSelectedSegment] = useState('all')

  const [reviews, setReviews] = useState<ClassifiedReview[]>([])
  const [options, setOptions] = useState<{ sources: string[]; themes: string[]; barriers: string[]; segments: string[] }>({
    sources: [],
    themes: [],
    barriers: [],
    segments: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchQuotes = async () => {
    setLoading(true)
    setError('')
    try {
      const url = new URL('/api/quotes', window.location.origin)
      url.searchParams.set('runId', runId)
      if (query) url.searchParams.set('query', query)
      if (selectedSource !== 'all') url.searchParams.set('source', selectedSource)
      if (selectedTheme !== 'all') url.searchParams.set('theme', selectedTheme)
      if (selectedBarrier !== 'all') url.searchParams.set('barrier', selectedBarrier)
      if (selectedSegment !== 'all') url.searchParams.set('segment', selectedSegment)

      const res = await fetch(url.toString())
      if (!res.ok) {
        throw new Error('Failed to fetch quotes for this run.')
      }

      const data = await res.json()
      setReviews(data.reviews || [])
      setOptions(data.options || { sources: [], themes: [], barriers: [], segments: [] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching quotes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (runId) fetchQuotes()
  }, [runId, selectedSource, selectedTheme, selectedBarrier, selectedSegment])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchQuotes()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/runs/${runId}`} className="text-teal-400 text-xs font-bold hover:underline">
              ← Back to Dashboard
            </Link>
            <span className="text-slate-600 text-xs">•</span>
            <span className="text-slate-400 text-xs font-mono">Run: {runId}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-2">🔍 Quote & Verbatim Evidence Explorer</h1>
        </div>

        <button
          onClick={() => router.push(`/runs/${runId}`)}
          className="px-4 py-2 bg-teal-500 text-slate-950 hover:bg-teal-400 rounded-lg text-xs font-bold transition-colors"
        >
          View Dashboard Report 📊
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="Search verbatim review text (e.g. gourmet cheese, search, delivery, categories)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400"
          />
          <button type="submit" className="px-6 py-2.5 bg-teal-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-teal-400">
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
            >
              <option value="all">All Sources</option>
              {options.sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Theme</label>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
            >
              <option value="all">All Themes</option>
              {options.themes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Barrier</label>
            <select
              value={selectedBarrier}
              onChange={(e) => setSelectedBarrier(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
            >
              <option value="all">All Barriers</option>
              {options.barriers.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">User Segment</label>
            <select
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
            >
              <option value="all">All Segments</option>
              {options.segments.map((seg) => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quote Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse text-sm">Searching quotes...</div>
      ) : error ? (
        <div className="text-center py-12 text-rose-400 text-sm">{error}</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
          No matching quotes found for the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Showing <strong>{reviews.length}</strong> matching verbatim quotes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r.review_id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-lg hover:border-slate-700 transition-colors">
                <blockquote className="text-sm text-slate-200 italic border-l-2 border-teal-400 pl-3">
                  "{r.text}"
                </blockquote>

                <div className="flex flex-wrap gap-1.5 pt-2 text-[10px]">
                  <span className="px-2 py-0.5 bg-teal-500/10 text-teal-300 rounded font-semibold">{r.source}</span>
                  {r.theme && <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded">Theme: {r.theme}</span>}
                  {r.barrier && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded">Barrier: {r.barrier}</span>}
                  {r.segment && <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded">Segment: {r.segment}</span>}
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 font-mono">
                  <span>ID: {r.review_id}</span>
                  <span>Confidence: {r.confidence ? `${Math.round(r.confidence * 100)}%` : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
