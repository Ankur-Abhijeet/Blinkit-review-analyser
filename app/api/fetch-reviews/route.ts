import { NextRequest, NextResponse } from 'next/server'
import { fetchFromAllSources, COLLECTOR_REGISTRY } from '../../../lib/collectors'

// Runs external HTTP fetches and libSQL queries — must be the Node.js runtime,
// and never statically rendered at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Hobby caps functions at 60s; raise this if the project is on Pro.
export const maxDuration = 60


export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sources, amount, region, sort, minRating } = body

    // 1. Validation
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ error: 'At least one source must be selected' }, { status: 400 })
    }

    if (sources.length > 7) {
      return NextResponse.json({ error: 'Maximum of 7 sources can be selected' }, { status: 400 })
    }

    const invalidSource = sources.find((s) => !COLLECTOR_REGISTRY[s])
    if (invalidSource) {
      return NextResponse.json({ error: `Invalid collector source: ${invalidSource}` }, { status: 400 })
    }

    const amt = Number(amount)
    if (isNaN(amt) || amt < 1 || amt > 50000) {
      return NextResponse.json({ error: 'Fetch amount must be between 1 and 50000 reviews' }, { status: 400 })
    }

    // 2. Fetch reviews with concurrency and politeness controls
    const result = await fetchFromAllSources(sources, {
      amount: amt,
      region: region || 'All India',
      sort: sort || 'newest',
      minRating: minRating !== undefined ? Number(minRating) : undefined,
    })

    // 3. Stably shuffle results to prevent single-source domination at head of array
    // Standard Fisher-Yates stable shuffle
    const shuffled = [...result.reviews]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    return NextResponse.json({
      reviews: shuffled,
      stats: result.stats,
    })
  } catch (err: unknown) {
    console.error('[POST /api/fetch-reviews] Request error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg || 'Failed to fetch reviews' }, { status: 500 })
  }
}
