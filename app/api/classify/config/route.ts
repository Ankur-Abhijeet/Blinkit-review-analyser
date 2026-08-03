import { NextRequest, NextResponse } from 'next/server'
import { calculateBatchSize } from '../../../../lib/llm/limits'
import { getDailyUsage } from '../../../../lib/db/runs'

export async function GET(req: NextRequest) {
  const isMock = false
  const provider = (process.env.LLM_PROVIDER || 'groq') as 'groq' | 'cerebras'
  const model = process.env.LLM_MODEL || ''
  const maxOutputTokens = Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 16384
  const batchSizeOverride = process.env.LLM_CLASSIFY_BATCH_SIZE ? Number(process.env.LLM_CLASSIFY_BATCH_SIZE) : undefined

  const batchSize = calculateBatchSize(provider, maxOutputTokens, batchSizeOverride)

  const { tpdConsumed, rpdConsumed } = await getDailyUsage()
  
  // Groq defaults: TPD = 100,000, RPD = 14,400
  const tpdLimit = 100000
  const rpdLimit = 14400

  return NextResponse.json({
    isMock,
    provider,
    model,
    batchSize,
    maxOutputTokens,
    tpdConsumed,
    rpdConsumed,
    tpdLimit,
    rpdLimit,
  })
}
