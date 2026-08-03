import { NextRequest, NextResponse } from 'next/server'
import { db, runMigrations } from '../../../../lib/db/client'
import { CuratedReview } from '../../../../lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { datasetName, reviews, fetchParams, partIndex, totalParts } = body

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews provided to queue' }, { status: 400 })
    }

    await runMigrations()

    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = new Date().toISOString()
    const name = datasetName || `Queued Corpus ${partIndex ? `(Part ${partIndex}/${totalParts})` : ''}`

    // Insert queued placeholder run
    await db.execute({
      sql: `INSERT INTO runs (
        id, seq, dataset_name, status, created_at, total_reviews,
        exploration_relevant_count, excluded_count, source_mix, fetch_params,
        curation_stats, aggregation, findings, executive_report,
        readiness_score, readiness_gaps, taxonomy_version, model, provider, mock, environment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        queueId,
        Date.now(),
        name,
        'queued',
        now,
        reviews.length,
        reviews.filter((r: CuratedReview) => r.exploration_relevant).length,
        reviews.filter((r: CuratedReview) => !r.exploration_relevant).length,
        JSON.stringify({}),
        JSON.stringify(fetchParams || {}),
        JSON.stringify({ totalInput: reviews.length, uniqueRecords: reviews.length, explorationRelevant: reviews.length, noiseBreakdown: {}, outcomeBreakdown: {} }),
        JSON.stringify({}),
        JSON.stringify([]),
        JSON.stringify({}),
        0,
        JSON.stringify([]),
        '1.0.0',
        'llama-3.3-70b-versatile',
        'groq',
        0,
        'local',
      ],
    })

    return NextResponse.json({
      success: true,
      queueId,
      datasetName: name,
      reviewCount: reviews.length,
      createdAt: now,
    })
  } catch (err: unknown) {
    console.error('[POST /api/runs/queue] Error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
