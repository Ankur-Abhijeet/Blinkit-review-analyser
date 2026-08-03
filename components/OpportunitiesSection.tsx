'use client'

import React from 'react'
import { Opportunity } from '../lib/types'
import QuoteChip from './QuoteChip'

interface OpportunitiesSectionProps {
  opportunities: Opportunity[]
  rejectedOpportunities?: Opportunity[]
  onOpenLabelSearch: (label: string) => void
}

export default function OpportunitiesSection({
  opportunities,
  rejectedOpportunities = [],
  onOpenLabelSearch,
}: OpportunitiesSectionProps) {
  // Sort opportunities by score descending
  const sorted = [...opportunities].sort((a, b) => b.opportunity_score - a.opportunity_score)

  const getSizeStyle = (size: string) => {
    switch (size.toLowerCase()) {
      case 'large':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
      case 'medium':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
    }
  }

  return (
    <div className="space-y-8">
      {/* Active opportunities */}
      <div className="space-y-6">
        <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
          💡 Ranked Product Opportunities
        </h3>
        {sorted.map((opp) => (
          <div
            key={opp.id}
            className="glass-card p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-6 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            {/* Title / Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-base text-zinc-900 dark:text-white leading-tight">
                  {opp.problem}
                </h4>
                {opp.related_finding_id && (
                  <span className="inline-block text-[10px] text-zinc-400 font-semibold tracking-wider uppercase">
                    Finding ID: {opp.related_finding_id}
                  </span>
                )}
              </div>

              {/* Score Badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full ${getSizeStyle(opp.size)}`}>
                  {opp.size} Opportunity
                </span>
                <span className="text-xs font-black px-3 py-1 rounded-full bg-[#cce8e2] text-[#00201a] dark:bg-[#005045] dark:text-[#76f8e0] border border-[#006b5c]/10">
                  Score: {opp.opportunity_score}
                </span>
              </div>
            </div>

            {/* Opportunity Mechanism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-150 dark:border-zinc-800/80">
              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">Current User Behavior</span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {opp.current_user_behavior}
                </p>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">Diagnosis (Root Cause)</span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-semibold">
                  {opp.root_cause}
                </p>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">Proposed Blinkit Opportunity</span>
                <p className="text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed font-bold">
                  {opp.blinkit_opportunity}
                </p>
              </div>
            </div>

            {/* Score Breakdowns */}
            <div className="flex flex-wrap gap-4 text-xs text-zinc-500 border-t border-b border-zinc-100 dark:border-zinc-800 py-3">
              <div>
                Impact Score: <strong className="text-zinc-800 dark:text-zinc-200">{opp.impact_score}/5</strong>
              </div>
              <div>
                Frequency Score: <strong className="text-zinc-800 dark:text-zinc-200">{opp.frequency_score}/5</strong>
              </div>
              <div>
                Confidence Score: <strong className="text-zinc-800 dark:text-zinc-200">{opp.confidence_score}/5</strong>
              </div>
              <div>
                Supporting Reviews: <strong className="text-zinc-800 dark:text-zinc-200">{opp.supporting_reviews}</strong>
              </div>
              {opp.affected_segments.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  Segments:
                  {opp.affected_segments.map((seg) => (
                    <span
                      key={seg}
                      onClick={() => onOpenLabelSearch(seg)}
                      className="cursor-pointer hover:underline text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    >
                      {seg}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Representative Quotes (The evidence) */}
            {opp.representative_quotes && opp.representative_quotes.length > 0 && (
              <div className="space-y-3">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">Grounded evidence quotes</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {opp.representative_quotes.map((quote, idx) => (
                    <QuoteChip
                      key={idx}
                      quote={quote}
                      onOpenLabelSearch={onOpenLabelSearch}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center py-12 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl">
            <span className="text-3xl">🏜️</span>
            <p className="text-sm text-zinc-400 font-semibold mt-2">No opportunities found.</p>
          </div>
        )}
      </div>

      {/* Rejected opportunities if any */}
      {rejectedOpportunities.length > 0 && (
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-3">
          <h4 className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">
            Rejected Hypotheses / Opportunities (Insincere evidence)
          </h4>
          <ul className="space-y-2">
            {rejectedOpportunities.map((opp, idx) => (
              <li key={idx} className="text-xs text-zinc-500 flex items-start gap-2">
                <span className="mt-0.5">✕</span>
                <span className="line-through">{opp.problem}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
