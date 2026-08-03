import { NextRequest, NextResponse } from 'next/server'
import { loadRun } from '../../../lib/db/runs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('runId')
    const query = searchParams.get('query') || ''
    const sourceFilter = searchParams.get('source')
    const themeFilter = searchParams.get('theme')
    const barrierFilter = searchParams.get('barrier')
    const segmentFilter = searchParams.get('segment')

    if (!runId) {
      return NextResponse.json({ error: 'runId query parameter is required' }, { status: 400 })
    }

    const data = await loadRun(runId)
    if (!data) {
      return NextResponse.json({ error: `Run with ID "${runId}" not found` }, { status: 404 })
    }

    let reviews = data.reviews

    // 1. Apply free-text search
    if (query.trim()) {
      const qLower = query.toLowerCase().trim()
      reviews = reviews.filter((r) => r.text.toLowerCase().includes(qLower))
    }

    // 2. Apply source filter
    if (sourceFilter && sourceFilter !== 'all') {
      reviews = reviews.filter((r) => r.source === sourceFilter)
    }

    // 3. Apply theme filter
    if (themeFilter && themeFilter !== 'all') {
      reviews = reviews.filter((r) => r.theme === themeFilter)
    }

    // 4. Apply barrier filter
    if (barrierFilter && barrierFilter !== 'all') {
      reviews = reviews.filter((r) => r.barrier === barrierFilter)
    }

    // 5. Apply segment filter
    if (segmentFilter && segmentFilter !== 'all') {
      reviews = reviews.filter((r) => r.segment === segmentFilter)
    }

    // Seed available options from the actual run's reviews
    const availableSources = Array.from(new Set(data.reviews.map((r) => r.source))).filter(Boolean)
    const availableThemes = Array.from(new Set(data.reviews.map((r) => r.theme))).filter(Boolean)
    const availableBarriers = Array.from(new Set(data.reviews.map((r) => r.barrier))).filter(Boolean)
    const availableSegments = Array.from(new Set(data.reviews.map((r) => r.segment))).filter(Boolean)

    return NextResponse.json({
      runId,
      totalCount: reviews.length,
      reviews,
      options: {
        sources: availableSources,
        themes: availableThemes,
        barriers: availableBarriers,
        segments: availableSegments,
      },
    })
  } catch (err: unknown) {
    console.error('[GET /api/quotes] Error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
