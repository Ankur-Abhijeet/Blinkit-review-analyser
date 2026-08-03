'use client'

import React from 'react'
import { ExecutiveReport } from '../lib/types'
import QuoteChip from './QuoteChip'

interface ReportSectionProps {
  report: ExecutiveReport
  readinessScore: number
  readinessGaps: string[]
  onOpenLabelSearch?: (label: string) => void
}

export default function ReportSection({ report, readinessScore, readinessGaps, onOpenLabelSearch }: ReportSectionProps) {
  // Determine confidence levels
  const getConfidenceLevel = (score: number) => {
    if (score >= 8) return { label: 'High Readiness', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' }
    if (score >= 5) return { label: 'Medium Readiness', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' }
    return { label: 'Low Readiness / Exploration Phase', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800' }
  }

  const confidence = getConfidenceLevel(readinessScore)
  const answers = report.researchAnswers

  const questionIcons: Record<string, { icon: string; border: string; bg: string }> = {
    q1: { icon: '🔁', border: 'border-blue-200 dark:border-blue-900', bg: 'bg-blue-50/50 dark:bg-blue-950/20' },
    q2: { icon: '🛑', border: 'border-rose-200 dark:border-rose-900', bg: 'bg-rose-50/50 dark:bg-rose-950/20' },
    q3: { icon: '🔎', border: 'border-purple-200 dark:border-purple-900', bg: 'bg-purple-50/50 dark:bg-purple-950/20' },
    q4: { icon: '⚡', border: 'border-amber-200 dark:border-amber-900', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
    q5: { icon: '🛡️', border: 'border-emerald-200 dark:border-emerald-900', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20' },
    q6: { icon: '💥', border: 'border-orange-200 dark:border-orange-900', bg: 'bg-orange-50/50 dark:bg-orange-950/20' },
    q7: { icon: '👥', border: 'border-cyan-200 dark:border-cyan-900', bg: 'bg-cyan-50/50 dark:bg-cyan-950/20' },
    q8: { icon: '💡', border: 'border-teal-200 dark:border-teal-900', bg: 'bg-teal-50/50 dark:bg-teal-950/20' },
  }

  return (
    <div className="space-y-8">
      {/* Confidence status banner */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${confidence.color}`}>
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider">Research Integrity Assessment</span>
          <h3 className="font-bold text-lg">{confidence.label}</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs block opacity-80">Readiness Score</span>
            <span className="text-xl font-black">{readinessScore} / 10</span>
          </div>
          <div className="w-12 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full bg-current"
              style={{ width: `${readinessScore * 10}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Executive Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Summary */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider flex items-center gap-2">
            📝 Executive Summary
          </h3>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 font-medium">
            {report.summary || 'No summary available.'}
          </p>
        </div>

        {/* Right Column: Behaviors */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-extrabold text-[#446279] dark:text-[#accae5] uppercase tracking-wider flex items-center gap-2">
            🛒 Shopping Behaviors & Patterns
          </h3>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {report.behaviors || 'No behaviors overview available.'}
          </p>
        </div>

        {/* Left Column Bottom: Segment Differences */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            👤 Segment-Specific Challenges
          </h3>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {report.segmentDifferences || 'No segment differences analysis available.'}
          </p>
        </div>

        {/* Right Column Bottom: Unmet Needs */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-extrabold text-[#ba1a1a] dark:text-[#ffb4ab] uppercase tracking-wider flex items-center gap-2">
            🚨 Key Unmet Customer Needs
          </h3>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {report.unmetNeeds || 'No unmet needs checklist available.'}
          </p>
        </div>
      </div>

      {/* 8 Core PM Research Questions & Evidence Answers */}
      {answers && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider flex items-center gap-2">
              📊 Core PM Research Questions & Findings
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              8 Empirical Answers Backed by Customer Reviews
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Object.entries(answers).map(([key, item]) => {
              const meta = questionIcons[key] || { icon: '❓', border: 'border-zinc-200', bg: 'bg-zinc-50' }
              return (
                <div
                  key={key}
                  className={`p-5 rounded-2xl border bg-white dark:bg-zinc-900/60 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-200 ${meta.border} ${meta.bg}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-white leading-snug">
                        {item.question}
                      </h4>
                    </div>
                    {item.keyMetric && (
                      <span className="flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                        {item.keyMetric}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
                    {item.answer}
                  </p>

                  {item.quote && (
                    <div className="pt-2 space-y-1.5">
                      <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider block">
                        💬 Grounded Review Evidence
                      </span>
                      <QuoteChip quote={item.quote} onOpenLabelSearch={onOpenLabelSearch} />
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                    <span>Supporting Reviews: {item.supportingCount}</span>
                    <span>Confidence: High</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Readiness gaps if any */}
      {readinessGaps.length > 0 && (
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-3">
          <h4 className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">
            Identified Product Readiness Gaps
          </h4>
          <ul className="space-y-2">
            {readinessGaps.map((gap, idx) => (
              <li key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-[#ba1a1a] dark:text-[#ffb4ab] mt-0.5">⚠️</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
