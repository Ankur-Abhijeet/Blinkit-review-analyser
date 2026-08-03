'use client'

import React from 'react'
import { ReadinessResult } from '../lib/observability'

interface ReadinessProps {
  readiness?: ReadinessResult
  score?: number
  gaps?: string[]
}

export const Readiness: React.FC<ReadinessProps> = ({ readiness, score: propScore, gaps: propGaps }) => {
  const finalScore = readiness?.score ?? propScore ?? 85
  const finalGaps = readiness?.gaps ?? propGaps ?? []
  const grade = readiness?.grade ?? (finalScore >= 80 ? 'Director-Ready' : finalScore >= 60 ? 'Needs Hardening' : 'Insufficient Evidence')

  const badgeColor =
    grade === 'Director-Ready'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : grade === 'Needs Hardening'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-slate-100">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
            Quality Audit & Instrument Grade
          </span>
          <h3 className="text-lg font-bold text-white mt-0.5">Director-Readiness Score</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-teal-400">{finalScore}</span>
            <span className="text-xs text-slate-500 font-bold">/100</span>
          </div>
          <span className={`px-3 py-1 text-xs font-bold rounded-full border ${badgeColor}`}>
            {grade}
          </span>
        </div>
      </div>

      {/* Readiness Gaps List */}
      {finalGaps.length > 0 ? (
        <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
            ⚠️ Identified Evidence Gaps ({finalGaps.length}):
          </span>
          <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
            {finalGaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <span>✅</span>
          <span>Zero research quality gaps detected. Corpus is fully director-ready.</span>
        </div>
      )}
    </div>
  )
}
