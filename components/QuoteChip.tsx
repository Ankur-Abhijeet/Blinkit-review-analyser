'use client'

import React, { useState } from 'react'
import { Quote } from '../lib/types'

interface QuoteChipProps {
  quote: Quote
  onOpenLabelSearch?: (label: string) => void
}

export default function QuoteChip({ quote, onOpenLabelSearch }: QuoteChipProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Determine source visual tag
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

  const confidencePercentage = Math.round(quote.confidence * 100)

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="group relative p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
      >
        <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
          {confidencePercentage}% Match
        </span>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${getSourceStyle(quote.source)}`}>
            {quote.source}
          </span>
          {quote.segment && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              👤 {quote.segment}
            </span>
          )}
        </div>

        <p className="text-sm italic text-zinc-700 dark:text-zinc-300 line-clamp-2 pr-16 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors duration-150">
          &quot;{quote.text}&quot;
        </p>
      </div>

      {/* Modal Dialogue */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 transition-colors duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                Review Details & LLM Groundings
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-zinc-800 dark:text-zinc-200 text-base leading-relaxed italic font-medium">
                  &quot;{quote.text}&quot;
                </p>
              </div>

              {/* Classification metadata parameters */}
              <div className="grid grid-cols-2 gap-4">
                {quote.theme && (
                  <div
                    onClick={() => {
                      setIsOpen(false)
                      if (onOpenLabelSearch) onOpenLabelSearch(quote.theme)
                    }}
                    className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg hover:border-[#006b5c] hover:border cursor-pointer transition-all duration-150"
                  >
                    <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Theme</span>
                    <span className="font-semibold text-sm text-zinc-900 dark:text-white hover:underline">{quote.theme}</span>
                  </div>
                )}
                {quote.barrier && (
                  <div
                    onClick={() => {
                      setIsOpen(false)
                      if (onOpenLabelSearch) onOpenLabelSearch(quote.barrier)
                    }}
                    className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg hover:border-[#bba1a1a] hover:border cursor-pointer transition-all duration-150"
                  >
                    <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Barrier</span>
                    <span className="font-semibold text-sm text-zinc-900 dark:text-white hover:underline">{quote.barrier}</span>
                  </div>
                )}
                {quote.root_cause && (
                  <div
                    onClick={() => {
                      setIsOpen(false)
                      if (onOpenLabelSearch) onOpenLabelSearch(quote.root_cause)
                    }}
                    className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg hover:border-[#006b5c] hover:border cursor-pointer transition-all duration-150"
                  >
                    <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Root Cause</span>
                    <span className="font-semibold text-sm text-zinc-900 dark:text-white hover:underline">{quote.root_cause}</span>
                  </div>
                )}
                {quote.unmet_need && (
                  <div
                    onClick={() => {
                      setIsOpen(false)
                      if (onOpenLabelSearch) onOpenLabelSearch(quote.unmet_need)
                    }}
                    className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg hover:border-[#006b5c] hover:border cursor-pointer transition-all duration-150"
                  >
                    <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Unmet Need</span>
                    <span className="font-semibold text-sm text-zinc-900 dark:text-white hover:underline">{quote.unmet_need}</span>
                  </div>
                )}
              </div>

              {/* Extra stats */}
              <div className="flex justify-between items-center text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getSourceStyle(quote.source)}`}>
                    {quote.source.toUpperCase()}
                  </span>
                  {quote.segment && <span>Segment: <strong className="text-zinc-700 dark:text-zinc-300">{quote.segment}</strong></span>}
                </div>
                <span>Classification Confidence: <strong>{confidencePercentage}%</strong></span>
              </div>
            </div>

            {/* Actions footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#006b5c] text-white hover:bg-[#005045] dark:bg-[#55dbc4] dark:text-[#00372f] dark:hover:bg-[#76f8e0] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
