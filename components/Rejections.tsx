'use client'

import React from 'react'

interface RejectionsProps {
  rejectionCount?: number
  coercionCount?: number
  reasons?: string[]
}

export const Rejections: React.FC<RejectionsProps> = ({
  rejectionCount = 0,
  coercionCount = 2,
  reasons = ['JSON array truncation auto-repaired via sub-batch halving', 'Field coercion applied for enum label case normalization'],
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-slate-100">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
            Validator Health & Robustness
          </span>
          <h3 className="text-lg font-bold text-white mt-0.5">Schema Validation & Coercion Logs</h3>
        </div>

        <div className="flex gap-2">
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {rejectionCount} Hard Rejections
          </span>
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20">
            {coercionCount} Auto-Coercions
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Recent Validation Handling Events:
        </span>
        <div className="space-y-1.5 font-mono text-[11px]">
          {reasons.map((r, i) => (
            <div key={i} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-2">
              <span className="text-teal-400 font-bold">▶</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
