import { NextRequest, NextResponse } from 'next/server'
import { CuratedReview } from '../../../lib/types'
import { mockClassifyReview } from '../../../lib/llm/mock'
import { classifyBatchWithRetries } from '../../../lib/llm/classify'
import { setCache } from '../../../lib/db/cache'
import { computeCleanTextHash } from '../../../lib/collectors/dedupe'

// Runs external HTTP fetches and libSQL queries — must be the Node.js runtime,
// and never statically rendered at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Hobby caps functions at 60s; raise this if the project is on Pro.
export const maxDuration = 60


export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const reviews = body.reviews as CuratedReview[]

    if (!reviews || !Array.isArray(reviews)) {
      return NextResponse.json({ error: 'Missing reviews array in request body' }, { status: 400 })
    }

    const provider = (process.env.LLM_PROVIDER || 'groq') as 'groq' | 'cerebras'
    const model = process.env.LLM_MODEL || undefined
    const apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || ''
    const maxOutputTokens = Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 16384

    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API Key (LLM_API_KEY / GROQ_API_KEY) is not configured in the environment.' }, { status: 400 })
    }

    let classified = []

    if (apiKey) {
      try {
        console.log(`[API CLASSIFY] Live mode (${provider}). Classifying ${reviews.length} reviews.`)
        classified = await classifyBatchWithRetries(reviews, {
          provider,
          model,
          apiKey,
          maxOutputTokens,
        })
      } catch (liveErr: unknown) {
        console.warn('[API CLASSIFY] Live LLM provider error/403. Falling back to heuristic classifier:', liveErr)
        classified = reviews.map((r) => mockClassifyReview(r))
      }
    } else {
      console.log(`[API CLASSIFY] No API key configured. Using heuristic classifier for ${reviews.length} reviews.`)
      classified = reviews.map((r) => mockClassifyReview(r))
    }

    // Write-through cache write
    classified.forEach((item) => {
      const hash = computeCleanTextHash(item.text)
      setCache(hash, item)
    })

    return NextResponse.json({ classified })
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }
    console.error('[API CLASSIFY] Classification failed:', err)
    return NextResponse.json({ error: error.message || 'Classification failed' }, { status: error.status || 500 })
  }
}
