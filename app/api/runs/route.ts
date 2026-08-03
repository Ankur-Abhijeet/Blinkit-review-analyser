import { NextRequest, NextResponse } from 'next/server'
import { saveRun, listRuns } from '../../../lib/db/runs'
import { Run, ClassifiedReview } from '../../../lib/types'

export async function GET() {
  try {
    const runs = await listRuns()
    return NextResponse.json({ runs })
  } catch (err: unknown) {
    const error = err as Error
    console.error('[API RUNS] Failed to list runs:', error)
    return NextResponse.json({ error: error.message || 'Failed to list runs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { run, reviews } = body as { run: Run; reviews: ClassifiedReview[] }

    if (!run || !reviews) {
      return NextResponse.json({ error: 'Missing run or reviews in request body' }, { status: 400 })
    }

    await saveRun(run, reviews)
    return NextResponse.json({ success: true, id: run.id })
  } catch (err: unknown) {
    const error = err as Error
    console.error('[API RUNS] Failed to save run:', error)
    return NextResponse.json({ error: error.message || 'Failed to save run' }, { status: 500 })
  }
}
