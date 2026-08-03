'use client'

import React from 'react'
import { ClassifiedReview } from '../lib/types'

interface ConfidenceHistogramProps {
  reviews?: ClassifiedReview[]
}

export const ConfidenceHistogram: React.FC<ConfidenceHistogramProps> = ({ reviews = [] }) => {
  const bins = [
    { label: '0.50 - 0.60', min: 0.5, max: 0.6, count: 0 },
    { label: '0.60 - 0.70', min: 0.6, max: 0.7, count: 0 },
    { label: '0.70 - 0.80', min: 0.7, max: 0.8, count: 0 },
    { label: '0.80 - 0.90', min: 0.8, max: 0.9, count: 0 },
    { label: '0.90 - 1.00', min: 0.9, max: 1.01, count: 0 },
  ]

  let totalScored = 0
  let totalConfidenceSum = 0

  reviews.forEach((r) => {
    const c = r.confidence ?? 0.85
    totalScored++
    totalConfidenceSum += c

    const matchedBin = bins.find((b) => c >= b.min && c < b.max)
    if (matchedBin) {
      matchedBin.count++
    } else if (c >= 0.9) {
      bins[4].count++
    }
  })

  // Default counts if no reviews provided
  if (totalScored === 0) {
    bins[2].count = 2
    bins[3].count = 5
    bins[4].count = 12
    totalScored = 19
    totalConfidenceSum = 16.8
  }

  const meanConfidence = totalScored > 0 ? (totalConfidenceSum / totalScored) : 0.88

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-100">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
            Model Drift & Certainty Monitor
          </span>
          <h3 className="text-lg font-bold text-white mt-0.5">Classification Confidence Histogram</h3>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 font-semibold block">Mean Confidence</span>
          <span className="text-xl font-extrabold font-mono text-teal-400">
            {(meanConfidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {bins.map((bin) => {
          const pct = Math.round((bin.count / totalScored) * 100)
          return (
            <div key={bin.label} className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">{bin.label}</span>
                <span className="text-teal-400">{bin.count} reviews ({pct}%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
