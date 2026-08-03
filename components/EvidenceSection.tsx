import React, { useMemo, useState } from 'react'
import { Aggregation } from '../lib/types'
import { BROADER_THEME_MAP } from '../lib/taxonomy'

interface EvidenceSectionProps {
  aggregation: Aggregation
  onOpenLabelSearch: (label: string) => void
}

export default function EvidenceSection({ aggregation, onOpenLabelSearch }: EvidenceSectionProps) {
  const [crossTabMode, setCrossTabMode] = useState<'broader' | 'detailed'>('broader')

  // Safe helper to sort mapping keys by values in descending order
  const sortMap = (map: Record<string, { count: number; pct: number }> | undefined) => {
    if (!map) return []
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([, stat]) => stat.count > 0)
  }

  const sortedThemes = useMemo(() => sortMap(aggregation.themes as unknown as Record<string, { count: number; pct: number }>), [aggregation.themes])
  const sortedBarriers = useMemo(() => sortMap(aggregation.barriers as unknown as Record<string, { count: number; pct: number }>), [aggregation.barriers])
  const sortedSegments = useMemo(() => sortMap(aggregation.segments as unknown as Record<string, { count: number; pct: number }>), [aggregation.segments])
  const sortedEmotions = useMemo(() => sortMap(aggregation.emotions as unknown as Record<string, { count: number; pct: number }>), [aggregation.emotions])
  const sortedCategories = useMemo(() => sortMap(aggregation.categoryMentions as unknown as Record<string, { count: number; pct: number }>), [aggregation.categoryMentions])

  // Process Cross-Tab matrix (Broader classification & Hide 0-count empty columns)
  const processedCrossTab = useMemo(() => {
    if (!aggregation.segmentByTheme) return null
    const raw = aggregation.segmentByTheme

    if (crossTabMode === 'broader') {
      const broaderCols = [
        'Discoverability & Search Navigation',
        'Assortment, Quality & Trust',
        'Reorder & Habit Lock-In',
        'Trial & Category Delight',
        'Other Exploration Frustration',
      ]

      const cellCounts: Record<string, Record<string, number>> = {}
      const rowTotals: Record<string, number> = {}

      raw.rows.forEach((row) => {
        if (!cellCounts[row]) cellCounts[row] = {}
        raw.cols.forEach((col) => {
          const cell = raw.cells[row]?.[col]
          const count = typeof cell === 'object' && cell !== null ? cell.count : Number(cell || 0)
          if (count > 0) {
            const broaderGroup = BROADER_THEME_MAP[col] || col
            cellCounts[row][broaderGroup] = (cellCounts[row][broaderGroup] || 0) + count
            rowTotals[row] = (rowTotals[row] || 0) + count
          }
        })
      })

      const activeRows = raw.rows.filter((row) => (rowTotals[row] || 0) > 0)
      const colTotals: Record<string, number> = {}
      broaderCols.forEach((col) => {
        activeRows.forEach((row) => {
          colTotals[col] = (colTotals[col] || 0) + (cellCounts[row]?.[col] || 0)
        })
      })
      const activeCols = broaderCols.filter((col) => (colTotals[col] || 0) > 0)

      let maxCellCount = 0
      activeRows.forEach((row) => {
        activeCols.forEach((col) => {
          const count = cellCounts[row]?.[col] || 0
          if (count > maxCellCount) maxCellCount = count
        })
      })

      return {
        rows: activeRows,
        cols: activeCols,
        maxCellCount,
        rowTotals,
        getCellCount: (row: string, col: string) => cellCounts[row]?.[col] || 0,
      }
    } else {
      // Detailed mode: filter out 0 count columns and 0 count rows
      const colTotals: Record<string, number> = {}
      const rowTotals: Record<string, number> = {}

      raw.rows.forEach((row) => {
        raw.cols.forEach((col) => {
          const cell = raw.cells[row]?.[col]
          const count = typeof cell === 'object' && cell !== null ? cell.count : Number(cell || 0)
          if (count > 0) {
            colTotals[col] = (colTotals[col] || 0) + count
            rowTotals[row] = (rowTotals[row] || 0) + count
          }
        })
      })

      const activeCols = raw.cols.filter((col) => (colTotals[col] || 0) > 0)
      const activeRows = raw.rows.filter((row) => (rowTotals[row] || 0) > 0)

      let maxCellCount = 0
      activeRows.forEach((row) => {
        activeCols.forEach((col) => {
          const cell = raw.cells[row]?.[col]
          const count = typeof cell === 'object' && cell !== null ? cell.count : Number(cell || 0)
          if (count > maxCellCount) maxCellCount = count
        })
      })

      return {
        rows: activeRows,
        cols: activeCols,
        maxCellCount,
        rowTotals,
        getCellCount: (row: string, col: string) => {
          const cell = raw.cells[row]?.[col]
          return typeof cell === 'object' && cell !== null ? cell.count : Number(cell || 0)
        },
      }
    }
  }, [aggregation.segmentByTheme, crossTabMode])

  // Get total counts to calculate percentages
  const totalReviews = aggregation.totalReviews || 1

  return (
    <div className="space-y-8">
      {/* 1. Source Mix Indicator */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
          📊 Source mix distribution
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(aggregation.sourceDistribution || {}).map(([src, count]) => {
            const pct = Math.round((count / totalReviews) * 100)
            return (
              <button
                key={src}
                onClick={() => onOpenLabelSearch(src)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                <span className="uppercase">{src}</span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 font-bold">{count}</span>
                <span className="opacity-60 font-medium">({pct}%)</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Cross-Tabs: Segment by Theme */}
      {processedCrossTab && (
        <div className="glass-card p-6 rounded-2xl space-y-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-3">
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-[#446279] dark:text-[#accae5] uppercase tracking-wider">
                🧩 Cross-Tabulations: Segments by Themes
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Showing merged broader categories (empty columns automatically filtered out)
              </p>
            </div>
            
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                onClick={() => setCrossTabMode('broader')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all ${
                  crossTabMode === 'broader'
                    ? 'bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f] shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                📊 Broader Categories (Merged)
              </button>
              <button
                onClick={() => setCrossTabMode('detailed')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all ${
                  crossTabMode === 'detailed'
                    ? 'bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f] shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                🔍 Detailed Themes (Filtered)
              </button>
            </div>
          </div>

          {/* Heatmap Legend & Help Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50/80 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <span className="uppercase tracking-wider text-[#006b5c] dark:text-[#55dbc4] font-extrabold flex items-center gap-1">
                🔥 Heatmap Density:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#006b5c]/15 text-[#006b5c] dark:bg-[#55dbc4]/15 dark:text-[#55dbc4]">Low (1-25%)</span>
              <span className="px-2 py-0.5 rounded-md bg-[#006b5c]/35 text-[#004d42] dark:bg-[#55dbc4]/35 dark:text-[#76f8e0]">Med (26-50%)</span>
              <span className="px-2 py-0.5 rounded-md bg-[#006b5c]/70 text-white dark:bg-[#55dbc4]/70 dark:text-zinc-900">High (51-75%)</span>
              <span className="px-2 py-0.5 rounded-md bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f] shadow-sm">Hotspot (&gt;75%)</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-medium">
              Click any heatmap cell to inspect review evidence
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <th className="py-3 px-4 font-bold text-zinc-600 dark:text-zinc-400 min-w-[170px]">Segment</th>
                  {processedCrossTab.cols.map((col) => (
                    <th
                      key={col}
                      onClick={() => onOpenLabelSearch(col)}
                      className="py-3 px-4 font-bold text-zinc-600 dark:text-zinc-400 hover:text-[#006b5c] dark:hover:text-[#55dbc4] cursor-pointer transition-colors text-center"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {processedCrossTab.rows.map((row) => (
                  <tr key={row} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td
                      onClick={() => onOpenLabelSearch(row)}
                      className="py-3 px-4 font-bold text-zinc-900 dark:text-white cursor-pointer hover:underline"
                    >
                      {row}
                    </td>
                    {processedCrossTab.cols.map((col) => {
                      const count = processedCrossTab.getCellCount(row, col)
                      const ratio = processedCrossTab.maxCellCount > 0 ? count / processedCrossTab.maxCellCount : 0
                      const rowTotal = processedCrossTab.rowTotals[row] || 1
                      const pctOfRow = count > 0 ? Math.round((count / rowTotal) * 100) : 0

                      let bgStyle = 'bg-transparent text-zinc-300 dark:text-zinc-700'
                      if (count > 0) {
                        if (ratio > 0.75) {
                          bgStyle = 'bg-[#006b5c] text-white dark:bg-[#55dbc4] dark:text-[#00372f] font-black shadow-md ring-1 ring-teal-400/50'
                        } else if (ratio > 0.5) {
                          bgStyle = 'bg-[#006b5c]/75 text-white dark:bg-[#55dbc4]/75 dark:text-zinc-900 font-extrabold'
                        } else if (ratio > 0.25) {
                          bgStyle = 'bg-[#006b5c]/35 text-[#00372f] dark:bg-[#55dbc4]/35 dark:text-[#76f8e0] font-bold'
                        } else {
                          bgStyle = 'bg-[#006b5c]/15 text-[#006b5c] dark:bg-[#55dbc4]/15 dark:text-[#55dbc4] font-semibold'
                        }
                      }

                      return (
                        <td
                          key={col}
                          onClick={() => {
                            if (count > 0) {
                              onOpenLabelSearch(col)
                            }
                          }}
                          className="py-2.5 px-3 text-center border-l border-r border-zinc-100/50 dark:border-zinc-800/40"
                        >
                          {count > 0 ? (
                            <div className={`inline-flex flex-col items-center justify-center min-w-[54px] px-2.5 py-1 rounded-lg transition-transform hover:scale-105 cursor-pointer ${bgStyle}`}>
                              <span className="text-xs font-black">{count}</span>
                              <span className="text-[9px] opacity-80 font-semibold">{pctOfRow}%</span>
                            </div>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700 opacity-40">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Distributions lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ranked Barriers */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold text-[#ba1a1a] dark:text-[#ffb4ab] uppercase tracking-wider">
            ⚠️ Barriers Distribution
          </h3>
          <div className="space-y-3">
            {sortedBarriers.map(([name, stat]) => {
              const { count, pct } = stat as { count: number; pct: number }
              return (
                <div
                  key={name}
                  onClick={() => onOpenLabelSearch(name)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline">{name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#ba1a1a] dark:bg-[#ffb4ab] h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {count} ({pct}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Themes distribution */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
            🎨 Themes Distribution
          </h3>
          <div className="space-y-3">
            {sortedThemes.map(([name, stat]) => {
              const { count, pct } = stat as { count: number; pct: number }
              return (
                <div
                  key={name}
                  onClick={() => onOpenLabelSearch(name)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline">{name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#006b5c] dark:bg-[#55dbc4] h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {count} ({pct}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Segments distribution */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            👤 Customer Segments mix
          </h3>
          <div className="space-y-3">
            {sortedSegments.map(([name, stat]) => {
              const { count, pct } = stat as { count: number; pct: number }
              return (
                <div
                  key={name}
                  onClick={() => onOpenLabelSearch(name)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline">{name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-zinc-500 h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {count} ({pct}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Emotions distribution */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold text-[#446279] dark:text-[#accae5] uppercase tracking-wider">
            🎭 Emotions Distribution
          </h3>
          <div className="space-y-3">
            {sortedEmotions.map(([name, stat]) => {
              const { count, pct } = stat as { count: number; pct: number }
              return (
                <div
                  key={name}
                  onClick={() => onOpenLabelSearch(name)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline">{name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#446279] dark:bg-[#accae5] h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {count} ({pct}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mentioned Categories (deterministic anchor) */}
        <div className="glass-card p-6 rounded-2xl space-y-4 md:col-span-2">
          <h3 className="text-sm font-extrabold text-[#006b5c] dark:text-[#55dbc4] uppercase tracking-wider">
            🏷️ Product Category Mentions (Inferred & Grounded)
          </h3>
          <div className="flex flex-wrap gap-2">
            {sortedCategories.map(([name, stat]) => {
              const { count, pct } = stat as { count: number; pct: number }
              return (
                <button
                  key={name}
                  onClick={() => onOpenLabelSearch(name)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-[#cce8e2] dark:hover:bg-[#005045] transition-colors text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  <span>{name}</span>
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded font-bold text-[10px]">
                    {count} ({pct}%)
                  </span>
                </button>
              )
            })}
            {sortedCategories.length === 0 && (
              <span className="text-xs text-zinc-400 italic">No categories mentioned.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
