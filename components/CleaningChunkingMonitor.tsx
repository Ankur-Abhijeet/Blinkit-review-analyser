'use client'

import React, { useState, useMemo } from 'react'
import { RawReview } from '../lib/types'

interface CleaningChunkingMonitorProps {
  reviews: RawReview[]
  onLaunch: (options: {
    batchSize: number
    batchDelayMs: number
    bypassCuration: boolean
  }) => void
  onBack: () => void
}

export function CleaningChunkingMonitor({
  reviews,
  onLaunch,
  onBack,
}: CleaningChunkingMonitorProps) {
  const [batchSize, setBatchSize] = useState<number>(5)
  const [batchDelayMs, setBatchDelayMs] = useState<number>(300)
  const [bypassCuration, setBypassCuration] = useState<boolean>(false)
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0)

  // Compute chunks breakdown
  const chunks = useMemo(() => {
    const res: Array<{ index: number; reviews: RawReview[]; estTokens: number }> = []
    for (let i = 0; i < reviews.length; i += batchSize) {
      const chunkReviews = reviews.slice(i, i + batchSize)
      let chars = 0
      chunkReviews.forEach((r) => (chars += r.text.length))
      const estTokens = Math.ceil(chars / 3.8) + 120 // ~3.8 chars per token + prompt overhead
      res.push({
        index: res.length + 1,
        reviews: chunkReviews,
        estTokens,
      })
    }
    return res
  }, [reviews, batchSize])

  const totalEstTokens = useMemo(() => {
    return chunks.reduce((sum, c) => sum + c.estTokens, 0)
  }, [chunks])

  const estDurationSec = useMemo(() => {
    const apiTimePerChunk = 1.2 // avg LLM response time
    const delayTimePerChunk = batchDelayMs / 1000
    return Math.ceil(chunks.length * (apiTimePerChunk + delayTimePerChunk))
  }, [chunks, batchDelayMs])

  const currentChunk = chunks[selectedChunkIndex] || chunks[0]

  return (
    <div className="glass-card p-6 rounded-2xl space-y-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-150 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
              Cleaning & LLM Chunking Controller
            </h3>
            <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-[#006b5c]/10 text-[#006b5c] dark:bg-[#55dbc4]/10 dark:text-[#55dbc4]">
              {reviews.length} Cleaned Reviews
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Configure prompt batching, token allocation & inspect LLM payload chunks before launching analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Grid Controls & Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Chunking & Speed Controls */}
        <div className="space-y-5 md:col-span-1 border-r border-zinc-150 dark:border-zinc-800 pr-0 md:pr-4">
          <h4 className="text-xs font-extrabold uppercase text-zinc-400 tracking-wide flex items-center gap-1.5">
            <span>🎛️</span> Batching Parameters
          </h4>

          {/* Chunk Size Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex justify-between">
              <span>Batch Size (Items per prompt)</span>
              <span className="text-[#006b5c] dark:text-[#55dbc4] font-extrabold">{batchSize} reviews</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[3, 5, 10, 15].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setBatchSize(size)
                    setSelectedChunkIndex(0)
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    batchSize === size
                      ? 'bg-[#006b5c] text-white border-[#006b5c] dark:bg-[#55dbc4] dark:text-[#00372f] dark:border-[#55dbc4]'
                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-400">
              Smaller batch sizes (3-5) prevent LLM token truncation and 413 rate limit errors.
            </p>
          </div>

          {/* Delay / Pacing Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Inter-Batch Cooling Delay
            </label>
            <select
              value={batchDelayMs}
              onChange={(e) => setBatchDelayMs(Number(e.target.value))}
              className="w-full p-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:border-[#006b5c]"
            >
              <option value={100}>⚡ Fast (100ms delay)</option>
              <option value={300}>⚡ Standard (300ms delay - Recommended)</option>
              <option value={600}>🛡️ Safe (600ms delay)</option>
              <option value={1200}>🐢 Polite (1200ms delay)</option>
            </select>
          </div>

          {/* Curation Bypass Option */}
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={bypassCuration}
                onChange={(e) => setBypassCuration(e.target.checked)}
                className="mt-0.5 rounded text-[#006b5c] dark:text-[#55dbc4] focus:ring-[#006b5c]"
              />
              <div>
                <span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Bypass Relevance Curation
                </span>
                <span className="block text-[10px] text-zinc-400 leading-normal">
                  Classify all {reviews.length} cleaned reviews directly without dropping non-exploration items.
                </span>
              </div>
            </label>
          </div>

          {/* Summary Stats */}
          <div className="p-3 rounded-xl bg-[#006b5c]/5 dark:bg-[#55dbc4]/5 border border-[#006b5c]/20 dark:border-[#55dbc4]/20 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Chunks:</span>
              <span className="font-extrabold text-[#006b5c] dark:text-[#55dbc4]">{chunks.length} chunks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Est. Tokens:</span>
              <span className="font-extrabold">{totalEstTokens.toLocaleString()} tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Est. Duration:</span>
              <span className="font-extrabold">~{estDurationSec} sec</span>
            </div>
          </div>
        </div>

        {/* Right Column: Chunk Inspector & Data Preview */}
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase text-zinc-400 tracking-wide flex items-center gap-1.5">
              <span>🔍</span> Chunk Payload Inspector
            </h4>
            <span className="text-xs font-bold text-[#006b5c] dark:text-[#55dbc4]">
              Chunk {selectedChunkIndex + 1} of {chunks.length}
            </span>
          </div>

          {/* Chunk Selector Strip */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
            {chunks.map((c, idx) => (
              <button
                key={c.index}
                type="button"
                onClick={() => setSelectedChunkIndex(idx)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border whitespace-nowrap transition-all ${
                  selectedChunkIndex === idx
                    ? 'bg-[#006b5c] text-white border-[#006b5c] dark:bg-[#55dbc4] dark:text-[#00372f]'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                Chunk #{c.index} ({c.reviews.length})
              </button>
            ))}
          </div>

          {/* Selected Chunk Details */}
          {currentChunk && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span>Items in this chunk: <strong>{currentChunk.reviews.length}</strong></span>
                <span>Est. Tokens: <strong>~{currentChunk.estTokens}</strong></span>
              </div>

              {/* Items List inside Selected Chunk */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {currentChunk.reviews.map((r, itemIdx) => (
                  <div
                    key={r.review_id || itemIdx}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="font-bold uppercase text-[#006b5c] dark:text-[#55dbc4]">{r.source}</span>
                      <span>ID: {r.review_id || `#${itemIdx + 1}`}</span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 font-medium">&quot;{r.text}&quot;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Launch Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-150 dark:border-zinc-800">
        <div className="text-xs text-zinc-500">
          Ready to process <strong className="text-zinc-800 dark:text-zinc-200">{reviews.length} reviews</strong> across <strong className="text-zinc-800 dark:text-zinc-200">{chunks.length} chunks</strong>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onLaunch({ batchSize, batchDelayMs, bypassCuration: true })}
            className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            ⚡ Bypass Curation (Direct Classify)
          </button>
          <button
            type="button"
            onClick={() => onLaunch({ batchSize, batchDelayMs, bypassCuration })}
            className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold rounded-xl bg-[#006b5c] hover:bg-[#005045] dark:bg-[#55dbc4] dark:text-[#00372f] dark:hover:bg-[#76f8e0] text-white transition-all shadow-md flex items-center justify-center gap-2"
          >
            🚀 Launch Advanced LLM Pipeline
          </button>
        </div>
      </div>
    </div>
  )
}
