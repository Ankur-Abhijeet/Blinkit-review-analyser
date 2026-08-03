import { NextRequest, NextResponse } from 'next/server'
import { loadRun } from '../../../lib/db/runs'
import { generateChatResponse } from '../../../lib/llm/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { runId, message } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 })
    }

    const runData = await loadRun(runId)
    if (!runData) {
      return NextResponse.json({ error: `Run "${runId}" not found` }, { status: 404 })
    }

    const { run, reviews } = runData

    // Build context summary from classified reviews
    const contextSummary = reviews
      .slice(0, 30) // Take top 30 classified reviews to fit token budget
      .map(
        (r) =>
          `[Review ID: ${r.review_id} | Source: ${r.source} | Theme: ${r.theme} | Barrier: ${r.barrier} | Segment: ${r.segment}]\nText: "${r.text}"`,
      )
      .join('\n\n')

    const prompt = `You are the ReviewLens PM Assistant. You MUST answer the user's question grounded strictly in the provided review evidence below. Always cite exact [Review ID: ...] citations whenever referencing a finding or verbatim quote.

GROUNDED REVIEW EVIDENCE (Run Dataset: "${run.dataset_name}", ID: ${run.id}):
${contextSummary}

USER QUESTION:
"${message}"

INSTRUCTIONS:
1. Provide a direct, PM-level analytical answer.
2. Include exact [Review ID: ...] citations for every claim.
3. If the evidence does not contain information to answer the question, state that clearly.`

    const reply = await generateChatResponse(prompt)

    // Extract citations
    const citationMatches = reply.match(/Review ID: [a-zA-Z0-9_-]+/g) || []
    const citations = Array.from(new Set(citationMatches))

    return NextResponse.json({
      reply,
      reviewsInContext: reviews.length,
      citations,
      datasetName: run.dataset_name,
    })
  } catch (err: unknown) {
    console.error('[POST /api/chat] Error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
