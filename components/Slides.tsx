'use client'

import React, { useState } from 'react'

interface ActionableFinding {
  headline: string
  verbatimQuote: string
  quoteId?: string
  businessImplication: string
  recommendedAction: string
}

interface SlidesProps {
  findings?: ActionableFinding[]
}

export const Slides: React.FC<SlidesProps> = ({ findings = [] }) => {
  const [currentSlide, setCurrentSlide] = useState(0)

  const defaultFindings: ActionableFinding[] = [
    {
      headline: 'Basket Habit Lock-In prevents trial of high-margin fresh categories',
      verbatimQuote: 'I only buy milk and bread on Blinkit. Whenever I try to browse other categories, the main page just pushes my past buy-again items.',
      quoteId: 'rev_101',
      businessImplication: 'High LTV potential in non-grocery categories is bottlenecked by repetitive reorder UI loops.',
      recommendedAction: 'Introduce "Category Discovery Tiles" after reorder basket confirmation to prompt cross-category trial.',
    },
    {
      headline: 'Search-Only Shopping behavior bypasses discovery surface entirely',
      verbatimQuote: 'The search is the only way to find gourmet ingredients. The home page is full of random promotional banners.',
      quoteId: 'rev_105',
      businessImplication: 'Product discovery rely 80%+ on explicit intent search rather than organic browsing.',
      recommendedAction: 'Build structured category aisles and clean navigation filters for non-grocery lines.',
    },
    {
      headline: 'Information Gap & Lack of Trial Packs Blocks Trust in Gourmet Produce',
      verbatimQuote: 'Why is there no trial pack for expensive gourmet cheese? I do not want to buy 500g and find out it is bad.',
      quoteId: 'rev_104',
      businessImplication: 'High risk aversion prevents first-time purchase of premium SKUs.',
      recommendedAction: 'Partner with suppliers to offer 50g-100g sample/trial sizes at low entry price points.',
    },
  ]

  const slidesToRender = findings.length > 0 ? findings : defaultFindings
  const activeSlide = slidesToRender[currentSlide] || slidesToRender[0]

  return (
    <div className="bg-slate-950 border border-teal-500/30 rounded-2xl p-8 shadow-2xl space-y-6 text-slate-100 max-w-4xl mx-auto my-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-400">
            Slide Deck View — Executive Research Presentation
          </span>
          <h2 className="text-xl font-extrabold text-white mt-1">
            Slide {currentSlide + 1} of {slidesToRender.length}: {activeSlide.headline}
          </h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-xs font-semibold"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => Math.min(slidesToRender.length - 1, prev + 1))}
            disabled={currentSlide === slidesToRender.length - 1}
            className="px-3 py-1.5 bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-30 rounded-lg text-xs font-bold"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/90 p-6 rounded-xl border border-slate-800 space-y-3">
          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">💬 Grounded Verbatim Evidence</span>
          <blockquote className="text-sm italic text-slate-200 border-l-2 border-teal-400 pl-4 my-2">
            "{activeSlide.verbatimQuote}"
          </blockquote>
          {activeSlide.quoteId && (
            <span className="inline-block text-[10px] font-mono bg-slate-800 text-teal-300 px-2 py-0.5 rounded">
              Review ID: {activeSlide.quoteId}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/30 space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">📉 Business Implication</span>
            <p className="text-xs text-slate-300">{activeSlide.businessImplication}</p>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-emerald-500/30 space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">🚀 Recommended Action</span>
            <p className="text-xs text-slate-300">{activeSlide.recommendedAction}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
