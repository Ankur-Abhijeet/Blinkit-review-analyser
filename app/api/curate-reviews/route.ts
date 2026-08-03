import { NextRequest, NextResponse } from 'next/server'
import { RawReview } from '../../../lib/types'
import { curateReviews } from '../../../lib/curate'
import { curateReviewsLlm } from '../../../lib/curate' // We will implement curateReviewsLlm in lib/curate.ts

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reviews, batchSize } = body

    if (!reviews || !Array.isArray(reviews)) {
      return NextResponse.json({ error: 'Missing reviews array in request body' }, { status: 400 })
    }

    const provider = (process.env.LLM_PROVIDER || 'groq') as 'groq' | 'cerebras'
    const model = process.env.LLM_MODEL || undefined
    const apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || ''
    const maxOutputTokens = Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 1024

    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API Key (LLM_API_KEY / GROQ_API_KEY) is not configured in the environment.' }, { status: 400 })
    }

    const effectiveBatchSize = Number(batchSize) || 5
    console.log(`[API CURATE] Live mode (${provider}). Curating ${reviews.length} reviews in batches of ${effectiveBatchSize}.`)
    const result = await curateReviewsLlm(
      reviews,
      {
        provider,
        model,
        apiKey,
        maxOutputTokens,
      },
      effectiveBatchSize,
    )

    return NextResponse.json(result)
  } catch (err: unknown) {
    const error = err as Error
    console.error('[API CURATE] Curation failed:', error)
    return NextResponse.json({ error: error.message || 'Curation failed' }, { status: 500 })
  }
}
