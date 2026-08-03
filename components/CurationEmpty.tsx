'use client'

import React from 'react'
import { CurationStats } from '../lib/types'

interface CurationEmptyProps {
  onReset: () => void
  onBypass?: () => void
  curationStats?: CurationStats
}

export const CurationEmpty: React.FC<CurationEmptyProps> = ({ onReset, onBypass, curationStats }) => {
  return (
    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-8 max-w-2xl mx-auto my-8 text-amber-100 shadow-xl backdrop-blur-sm">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-3 bg-amber-500/20 text-amber-400 rounded-lg">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-amber-300">No Discovery-Relevant Reviews Found</h3>
          <p className="text-sm text-amber-200/80">
            {curationStats?.loaded ? `${curationStats.loaded} reviews were ingested, but 0 survived domain curation.` : 'The curation filter returned 0 relevant reviews for classification.'}
          </p>
        </div>
      </div>

      <div className="space-y-4 my-6 bg-black/40 p-4 rounded-lg border border-amber-500/20 text-sm">
        <h4 className="font-semibold text-amber-400">💡 Recommended Remediation Guidance:</h4>
        <ul className="space-y-2 text-amber-200/90 list-disc list-inside">
          <li><strong>Select More Sources:</strong> Ensure Play Store, App Store, Reddit, and forums are enabled.</li>
          <li><strong>Broaden Region Filter:</strong> Change region from city-specific filter to <code className="bg-amber-900/50 px-1 rounded">All India</code>.</li>
          <li><strong>Adjust Minimum Rating:</strong> Lower the minimum rating filter to include 1-star and 2-star reviews.</li>
          <li><strong>Increase Amount:</strong> Increase the fetch amount slider (e.g. from 20 to 100+).</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3">
        {onBypass && (
          <button
            onClick={onBypass}
            className="px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold rounded-lg transition-colors text-sm"
          >
            ⚡ Bypass Filter & Classify All Scraped Reviews
          </button>
        )}
        <button
          onClick={onReset}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors duration-150 shadow-md hover:shadow-amber-500/20 text-sm"
        >
          🔄 Adjust Fetch Parameters & Retry
        </button>
      </div>
    </div>
  )
}
