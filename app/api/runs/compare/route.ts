import { NextRequest, NextResponse } from 'next/server'
import { loadRun } from '../../../../lib/db/runs'

// Runs external HTTP fetches and libSQL queries — must be the Node.js runtime,
// and never statically rendered at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Hobby caps functions at 60s; raise this if the project is on Pro.
export const maxDuration = 60


export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { baseRunId, targetRunId } = body

    if (!baseRunId || !targetRunId) {
      return NextResponse.json({ error: 'Both baseRunId and targetRunId are required' }, { status: 400 })
    }

    const baseData = await loadRun(baseRunId)
    const targetData = await loadRun(targetRunId)

    if (!baseData) {
      return NextResponse.json({ error: `Base run "${baseRunId}" not found` }, { status: 404 })
    }

    if (!targetData) {
      return NextResponse.json({ error: `Target run "${targetRunId}" not found` }, { status: 404 })
    }

    const baseRun = baseData.run
    const targetRun = targetData.run

    // ── Taxonomy Version Equality Guard (P7-T02 Invariant) ────────────────
    if (baseRun.taxonomy_version !== targetRun.taxonomy_version) {
      return NextResponse.json(
        {
          error: `Taxonomy version mismatch guard rejected comparison. Base run uses version "${baseRun.taxonomy_version}" while Target run uses version "${targetRun.taxonomy_version}". Comparing runs across taxonomy updates silently corrupts trend analysis.`,
          mismatch: true,
          baseTaxonomyVersion: baseRun.taxonomy_version,
          targetTaxonomyVersion: targetRun.taxonomy_version,
        },
        { status: 400 },
      )
    }

    // Compute month-over-month trend deltas
    const readinessDelta = targetRun.readiness_score - baseRun.readiness_score
    const reviewsDelta = targetRun.total_reviews - baseRun.total_reviews
    const relevantDelta = targetRun.exploration_relevant_count - baseRun.exploration_relevant_count

    return NextResponse.json({
      success: true,
      comparison: {
        baseRun,
        targetRun,
        deltas: {
          readinessDelta,
          reviewsDelta,
          relevantDelta,
        },
      },
    })
  } catch (err: unknown) {
    console.error('[POST /api/runs/compare] Error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
