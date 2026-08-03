'use client'

import React from 'react'
import { Run } from '../lib/types'
import { BROADER_THEME_MAP } from '../lib/taxonomy'

interface FullPrintReportProps {
  run: Run
}

export default function FullPrintReport({ run }: FullPrintReportProps) {
  const report = run.executive_report
  const agg = run.aggregation
  const answers = report?.researchAnswers
  const opportunities = report?.opportunities || []
  const findings = run.findings || []
  const gaps = run.readiness_gaps || []

  // Helper to calculate cell color intensity for heatmaps
  const getIntensityStyle = (count: number, maxCount: number) => {
    if (!count || count === 0) return 'bg-zinc-50 text-zinc-400'
    const ratio = count / (maxCount || 1)
    if (ratio > 0.6) return 'bg-[#006b5c]/20 text-[#006b5c] font-black border border-[#006b5c]/30'
    if (ratio > 0.3) return 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-200'
    return 'bg-emerald-50 text-emerald-800 font-medium border border-emerald-100'
  }

  // Calculate Cross-Tab Heatmap matrix
  const broaderCols = [
    'Discoverability & Search Navigation',
    'Assortment, Quality & Trust',
    'Reorder & Habit Lock-In',
    'Trial & Category Delight',
    'Other Exploration Frustration',
  ]

  const cellCounts: Record<string, Record<string, number>> = {}
  const rowTotals: Record<string, number> = {}
  let maxCellCount = 1

  if (agg?.segmentByTheme) {
    const raw = agg.segmentByTheme
    raw.rows.forEach((row) => {
      if (!cellCounts[row]) cellCounts[row] = {}
      raw.cols.forEach((col) => {
        const cell = raw.cells[row]?.[col]
        const count = typeof cell === 'object' && cell !== null ? cell.count : Number(cell || 0)
        if (count > 0) {
          const group = BROADER_THEME_MAP[col] || col
          cellCounts[row][group] = (cellCounts[row][group] || 0) + count
          rowTotals[row] = (rowTotals[row] || 0) + count
          if (cellCounts[row][group] > maxCellCount) {
            maxCellCount = cellCounts[row][group]
          }
        }
      })
    })
  }

  const activeRows = agg?.segmentByTheme?.rows.filter((r) => (rowTotals[r] || 0) > 0) || []
  const colTotals: Record<string, number> = {}
  broaderCols.forEach((col) => {
    activeRows.forEach((row) => {
      colTotals[col] = (colTotals[col] || 0) + (cellCounts[row]?.[col] || 0)
    })
  })
  const activeCols = broaderCols.filter((col) => (colTotals[col] || 0) > 0)

  // Sort helper for distribution tables
  const sortMap = (map?: Record<string, { count: number; pct: number }>) => {
    if (!map) return []
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([, v]) => v.count > 0)
  }

  const sortedThemes = sortMap(agg?.themes as unknown as Record<string, { count: number; pct: number }>)
  const sortedBarriers = sortMap(agg?.barriers as unknown as Record<string, { count: number; pct: number }>)
  const sortedRootCauses = sortMap(agg?.rootCauses as unknown as Record<string, { count: number; pct: number }>)
  const sortedUnmetNeeds = sortMap(agg?.unmetNeeds as unknown as Record<string, { count: number; pct: number }>)

  return (
    <div className="hidden print:block space-y-8 p-6 text-zinc-900 bg-white leading-relaxed font-sans">
      {/* SECTION 1: PROVENANCE HEADER */}
      <div className="border-b-2 border-zinc-900 pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-800">
              Blinkit PM Research Executive Report
            </span>
            <h1 className="text-2xl font-black text-zinc-900">{run.dataset_name}</h1>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-zinc-500 block">Director Readiness Score</span>
            <span className="text-2xl font-black text-[#006b5c]">{run.readiness_score} / 10</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-[11px] bg-zinc-50 p-3 rounded-lg border border-zinc-200">
          <div><span className="text-zinc-500 font-semibold">Run ID:</span> <span className="font-bold">{run.id}</span></div>
          <div><span className="text-zinc-500 font-semibold">Taxonomy Version:</span> <span className="font-bold">v{run.taxonomy_version}</span></div>
          <div><span className="text-zinc-500 font-semibold">LLM Model:</span> <span className="font-bold">{run.provider} ({run.model})</span></div>
          <div><span className="text-zinc-500 font-semibold">Total Scraped Reviews:</span> <span className="font-bold">{run.total_reviews} ({run.exploration_relevant_count} relevant)</span></div>
        </div>
      </div>

      {/* SECTION 2: EXECUTIVE OVERVIEW */}
      <div className="space-y-4">
        <h2 className="text-base font-extrabold uppercase tracking-wider text-emerald-800 border-b border-zinc-200 pb-1">
          📝 Executive Summary & Strategic Directives
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-4 border rounded-xl bg-zinc-50/50 space-y-2">
            <h3 className="font-bold text-zinc-900">Executive Summary</h3>
            <p className="text-zinc-700">{report?.summary || 'N/A'}</p>
          </div>
          <div className="p-4 border rounded-xl bg-zinc-50/50 space-y-2">
            <h3 className="font-bold text-zinc-900">Shopping Behaviors & Discovery</h3>
            <p className="text-zinc-700">{report?.behaviors || 'N/A'}</p>
          </div>
          <div className="p-4 border rounded-xl bg-zinc-50/50 space-y-2">
            <h3 className="font-bold text-zinc-900">Segment Dynamics</h3>
            <p className="text-zinc-700">{report?.segmentDifferences || 'N/A'}</p>
          </div>
          <div className="p-4 border rounded-xl bg-zinc-50/50 space-y-2">
            <h3 className="font-bold text-zinc-900">Key Unmet Customer Needs</h3>
            <p className="text-zinc-700">{report?.unmetNeeds || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* SECTION 3: 8 CORE PM RESEARCH QUESTIONS & VERBATIM QUOTES */}
      {answers && (
        <div className="space-y-4 page-break">
          <h2 className="text-base font-extrabold uppercase tracking-wider text-emerald-800 border-b border-zinc-200 pb-1">
            📊 8 Core PM Research Questions & Customer Evidence
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(answers).map(([key, item]) => (
              <div key={key} className="p-4 border rounded-xl space-y-2 bg-white avoid-break">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-zinc-900">{item.question}</h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-zinc-900 text-white">
                    {item.keyMetric}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-700">{item.answer}</p>
                {item.quote && (
                  <div className="p-2.5 bg-zinc-50 rounded border text-[10px] italic text-zinc-800">
                    &quot;{item.quote.text}&quot;
                    <div className="mt-1 flex items-center justify-between text-[9px] not-italic text-zinc-500 font-semibold">
                      <span>Source: {item.quote.source}</span>
                      <span>Segment: {item.quote.segment}</span>
                      <span>Confidence: {Math.round(item.quote.confidence * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: TOP 5 STRATEGIC OPPORTUNITIES */}
      {opportunities.length > 0 && (
        <div className="space-y-4 page-break">
          <h2 className="text-base font-extrabold uppercase tracking-wider text-emerald-800 border-b border-zinc-200 pb-1">
            💡 Top 5 Strategic Product Opportunities
          </h2>

          <div className="space-y-4">
            {opportunities.slice(0, 5).map((opp, idx) => (
              <div key={opp.id} className="p-4 border rounded-xl space-y-3 bg-white avoid-break">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-zinc-900">
                    #{idx + 1}. {opp.problem}
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                    Score: {opp.opportunity_score} ({opp.size})
                  </span>
                </div>
                <p className="text-[11px] text-zinc-700">
                  <strong>Blinkit Intervention:</strong> {opp.blinkit_opportunity}
                </p>
                <p className="text-[11px] text-zinc-600">
                  <strong>User Behavior:</strong> {opp.current_user_behavior}
                </p>
                {opp.representative_quotes?.[0] && (
                  <div className="p-2 bg-zinc-50 rounded border text-[10px] italic text-zinc-800">
                    &quot;{opp.representative_quotes[0].text}&quot;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: RESEARCH FINDINGS */}
      {findings.length > 0 && (
        <div className="space-y-4 page-break">
          <h2 className="text-base font-extrabold uppercase tracking-wider text-emerald-800 border-b border-zinc-200 pb-1">
            🔍 Executive Research Findings
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {findings.map((f) => (
              <div key={f.id} className="p-4 border rounded-xl space-y-2 bg-white avoid-break">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-zinc-900">{f.title}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
                    Evidence: {f.evidence_count} reviews
                  </span>
                </div>
                <p className="text-[11px] text-zinc-700">{f.description}</p>
                {f.representative_quotes?.[0] && (
                  <div className="p-2 bg-zinc-50 rounded border text-[10px] italic text-zinc-800">
                    &quot;{f.representative_quotes[0].text}&quot;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 6: CROSS-TABULATION HEATMAP & TABLES */}
      <div className="space-y-6 page-break">
        <h2 className="text-base font-extrabold uppercase tracking-wider text-emerald-800 border-b border-zinc-200 pb-1">
          📈 Cross-Tabulation Heatmap Matrix & Distribution Tables
        </h2>

        {/* HEATMAP MATRIX TABLE */}
        {activeRows.length > 0 && activeCols.length > 0 && (
          <div className="space-y-2 avoid-break">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
              Segment vs. Friction Themes Heatmap Matrix
            </h3>
            <table className="w-full text-[10px] border-collapse border border-zinc-300">
              <thead>
                <tr className="bg-zinc-100 text-zinc-900 font-bold">
                  <th className="p-2 border border-zinc-300 text-left">User Segment</th>
                  {activeCols.map((col) => (
                    <th key={col} className="p-2 border border-zinc-300 text-center">{col}</th>
                  ))}
                  <th className="p-2 border border-zinc-300 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => (
                  <tr key={row}>
                    <td className="p-2 border border-zinc-300 font-bold text-zinc-900">{row}</td>
                    {activeCols.map((col) => {
                      const count = cellCounts[row]?.[col] || 0
                      return (
                        <td key={col} className={`p-2 border border-zinc-300 text-center ${getIntensityStyle(count, maxCellCount)}`}>
                          {count || '-'}
                        </td>
                      )
                    })}
                    <td className="p-2 border border-zinc-300 font-bold text-right">{rowTotals[row] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DISTRIBUTION TABLES */}
        <div className="grid grid-cols-2 gap-4 avoid-break">
          {/* Top Friction Themes Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Friction Themes Distribution</h3>
            <table className="w-full text-[10px] border-collapse border border-zinc-300">
              <thead>
                <tr className="bg-zinc-100 font-bold">
                  <th className="p-1.5 border border-zinc-300 text-left">Theme</th>
                  <th className="p-1.5 border border-zinc-300 text-right">Count</th>
                  <th className="p-1.5 border border-zinc-300 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {sortedThemes.slice(0, 6).map(([label, stat]) => (
                  <tr key={label}>
                    <td className="p-1.5 border border-zinc-300">{label}</td>
                    <td className="p-1.5 border border-zinc-300 text-right font-bold">{stat.count}</td>
                    <td className="p-1.5 border border-zinc-300 text-right">{stat.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Exploration Barriers Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Category Barriers Distribution</h3>
            <table className="w-full text-[10px] border-collapse border border-zinc-300">
              <thead>
                <tr className="bg-zinc-100 font-bold">
                  <th className="p-1.5 border border-zinc-300 text-left">Barrier</th>
                  <th className="p-1.5 border border-zinc-300 text-right">Count</th>
                  <th className="p-1.5 border border-zinc-300 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {sortedBarriers.slice(0, 6).map(([label, stat]) => (
                  <tr key={label}>
                    <td className="p-1.5 border border-zinc-300">{label}</td>
                    <td className="p-1.5 border border-zinc-300 text-right font-bold">{stat.count}</td>
                    <td className="p-1.5 border border-zinc-300 text-right">{stat.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Root Causes Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Root Cause Mechanisms</h3>
            <table className="w-full text-[10px] border-collapse border border-zinc-300">
              <thead>
                <tr className="bg-zinc-100 font-bold">
                  <th className="p-1.5 border border-zinc-300 text-left">Mechanism</th>
                  <th className="p-1.5 border border-zinc-300 text-right">Count</th>
                  <th className="p-1.5 border border-zinc-300 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {sortedRootCauses.slice(0, 6).map(([label, stat]) => (
                  <tr key={label}>
                    <td className="p-1.5 border border-zinc-300">{label}</td>
                    <td className="p-1.5 border border-zinc-300 text-right font-bold">{stat.count}</td>
                    <td className="p-1.5 border border-zinc-300 text-right">{stat.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unmet Needs Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Unmet Customer Needs</h3>
            <table className="w-full text-[10px] border-collapse border border-zinc-300">
              <thead>
                <tr className="bg-zinc-100 font-bold">
                  <th className="p-1.5 border border-zinc-300 text-left">Unmet Need</th>
                  <th className="p-1.5 border border-zinc-300 text-right">Count</th>
                  <th className="p-1.5 border border-zinc-300 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {sortedUnmetNeeds.slice(0, 6).map(([label, stat]) => (
                  <tr key={label}>
                    <td className="p-1.5 border border-zinc-300">{label}</td>
                    <td className="p-1.5 border border-zinc-300 text-right font-bold">{stat.count}</td>
                    <td className="p-1.5 border border-zinc-300 text-right">{stat.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* READINESS GAPS IF ANY */}
      {gaps.length > 0 && (
        <div className="p-4 border rounded-xl bg-zinc-50 space-y-2 avoid-break">
          <h3 className="font-bold text-xs text-zinc-900">Identified Research Readiness Gaps</h3>
          <ul className="list-disc list-inside text-[11px] text-zinc-700">
            {gaps.map((g, idx) => (
              <li key={idx}>{g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
