import { NextRequest, NextResponse } from 'next/server'
import { getCacheBatch, computeContentHash, writeThroughCache, getTaxonomyHash } from '../../../../lib/db/cache'
import { CuratedReview, ClassifiedReview } from '../../../../lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { hashes, reviews, writeItems } = body

    // 1. If writeItems is provided, write them through to cache
    if (writeItems && typeof writeItems === 'object') {
      await writeThroughCache(writeItems as Record<string, ClassifiedReview>)
      return NextResponse.json({ success: true, count: Object.keys(writeItems).length })
    }

    // 2. Determine target hashes
    let targetHashes: string[] = []

    if (Array.isArray(hashes) && hashes.length > 0) {
      targetHashes = hashes.map(String)
    } else if (Array.isArray(reviews) && reviews.length > 0) {
      targetHashes = (reviews as CuratedReview[]).map((r) => computeContentHash(r.text, r.source))
    } else {
      return NextResponse.json({ error: 'Either hashes or reviews array is required' }, { status: 400 })
    }

    // 3. Check cache
    const { hits, misses } = await getCacheBatch(targetHashes)
    const currentTaxonomyHash = getTaxonomyHash()

    return NextResponse.json({
      hits,
      misses,
      hitCount: Object.keys(hits).length,
      missCount: misses.length,
      taxonomyHash: currentTaxonomyHash,
    })
  } catch (err: unknown) {
    console.error('[POST /api/classify/cache] Error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
