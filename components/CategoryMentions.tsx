'use client'

import React from 'react'

interface CategoryMentionsProps {
  categories?: Record<string, number>
}

export const CategoryMentions: React.FC<CategoryMentionsProps> = ({ categories = {} }) => {
  const defaultCategories: Record<string, number> = {
    'Milk, Bread & Dairy': 42,
    'Fresh Fruits & Vegetables': 38,
    'Personal Care & Beauty': 18,
    'Gourmet & Imported Foods': 15,
    'Pet Food & Pet Supplies': 12,
    'Baby Care & Diapers': 9,
    'Stationery & Electronics': 7,
    'Snacks & Beverages': 24,
  }

  const merged = Object.keys(categories).length > 0 ? categories : defaultCategories
  const totalMentions = Object.values(merged).reduce((a, b) => a + b, 0) || 1

  const sorted = Object.entries(merged).sort(([, a], [, b]) => b - a)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-100">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-teal-400">🛍️ Quick-Commerce Category Trust & Awareness Map</h3>
          <p className="text-xs text-slate-400">
            Mention frequency across quick-commerce categories (determines repeat habit vs trial barriers).
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-teal-500/10 text-teal-300 rounded-full border border-teal-500/20">
          {totalMentions} Category Mentions
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map(([cat, count]) => {
          const pct = Math.round((count / totalMentions) * 100)
          const isHighTrust = cat.includes('Dairy') || cat.includes('Snacks')

          return (
            <div key={cat} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-200">{cat}</span>
                <span className="text-teal-400 font-mono">{count} mentions ({pct}%)</span>
              </div>

              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full ${isHighTrust ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-rose-400'}`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px]">
                <span className={isHighTrust ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {isHighTrust ? 'High Reorder Habit' : 'High Trial Barrier / Trust Gap'}
                </span>
                <span className="text-slate-500 uppercase font-mono">SKU Density</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
