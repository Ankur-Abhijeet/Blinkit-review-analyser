import { CuratedReview, ClassifiedReview } from '../types'
import { callLlm, LlmConfig } from './client'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import {
  POSITIVE_THEMES,
  NEGATIVE_THEMES,
  BARRIERS,
  SHOPPING_BEHAVIORS,
  EMOTIONS,
  SEGMENTS,
  ROOT_CAUSES,
  UNMET_NEEDS,
  NON_RESEARCH_FALLBACK,
  isPositiveTheme,
  Theme,
  Barrier,
  ShoppingBehavior,
  Emotion,
  Segment,
  RootCause,
  UnmetNeed,
} from '../taxonomy'
import { BLINKIT_CATEGORIES, CATEGORY_SYNONYM_MAP } from '../categories'

export class BatchLengthMismatchError extends Error {
  constructor(message = 'LLM batch output length does not match input length') {
    super(message)
    this.name = 'BatchLengthMismatchError'
  }
}

export class LlmOutputTruncatedError extends Error {
  constructor(message = 'LLM output was truncated or invalid JSON') {
    super(message)
    this.name = 'LlmOutputTruncatedError'
  }
}

// Global stats to monitor prompt drift
export const coercionStats = {
  coercions: 0,
  totalChecks: 0,
}

export function resetCoercionStats() {
  coercionStats.coercions = 0
  coercionStats.totalChecks = 0
}

export function getCoercionRate(): number {
  if (coercionStats.totalChecks === 0) return 0
  return coercionStats.coercions / coercionStats.totalChecks
}

export const SEGMENT_ALIAS_MAP: Record<string, Segment> = {
  'occasion shopper': 'Impulse & Emergency Shopper',
  'deal seeker': 'Value & Deal Seeker',
  'household manager': 'Household & Pantry Planner',
  'new or low-tenure user': 'Exploratory & Premium Trialist',
}

export function coerceLabel(val: string, allowed: readonly string[], fallback: string): string {
  coercionStats.totalChecks++
  if (!val) {
    coercionStats.coercions++
    return fallback
  }

  const trimmed = val.trim()
  if (allowed.includes(trimmed)) {
    return trimmed
  }

  const lowerVal = trimmed.toLowerCase()
  if (SEGMENT_ALIAS_MAP[lowerVal] && allowed.includes(SEGMENT_ALIAS_MAP[lowerVal])) {
    coercionStats.coercions++
    console.log(`[COERCE] Segment alias match: "${val}" -> "${SEGMENT_ALIAS_MAP[lowerVal]}"`)
    return SEGMENT_ALIAS_MAP[lowerVal]
  }

  const lowercaseAllowed = allowed.map((a) => a.toLowerCase())
  const idx = lowercaseAllowed.indexOf(lowerVal)
  if (idx !== -1) {
    coercionStats.coercions++
    console.log(`[COERCE] Case/trim match: "${val}" -> "${allowed[idx]}"`)
    return allowed[idx]
  }

  coercionStats.coercions++
  console.log(`[COERCE] No match for: "${val}". Using fallback: "${fallback}"`)
  return fallback
}

export function extractJsonArray(raw: string): unknown[] {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '')
  }
  cleaned = cleaned.trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (parsed.reviews && Array.isArray(parsed.reviews)) {
      return parsed.reviews
    }
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed.reviews && Array.isArray(parsed.reviews)) {
          return parsed.reviews
        }
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        throw new LlmOutputTruncatedError('Failed to parse matched JSON substring')
      }
    }
    throw new LlmOutputTruncatedError('No JSON object or array found in output')
  }
  throw new Error('Parsed JSON does not contain reviews array')
}

export function parseBatch(raw: string, inputs: CuratedReview[]): ClassifiedReview[] {
  const arr = extractJsonArray(raw)
  if (arr.length !== inputs.length) {
    throw new BatchLengthMismatchError(`Expected ${inputs.length} reviews, got ${arr.length}`)
  }

  const ALL_THEMES = [...POSITIVE_THEMES, ...NEGATIVE_THEMES]

  return arr.map((val, i) => {
    const row = val as Record<string, unknown>
    const review = inputs[i]
    const theme = coerceLabel(row.theme as string, ALL_THEMES, NON_RESEARCH_FALLBACK.theme) as Theme
    const barrier = coerceLabel(row.barrier as string, BARRIERS, NON_RESEARCH_FALLBACK.barrier) as Barrier
    const behavior = coerceLabel(row.behavior as string, SHOPPING_BEHAVIORS, NON_RESEARCH_FALLBACK.behavior) as ShoppingBehavior
    const emotion = coerceLabel(row.emotion as string, EMOTIONS, NON_RESEARCH_FALLBACK.emotion) as Emotion
    const segment = coerceLabel(row.segment as string, SEGMENTS, NON_RESEARCH_FALLBACK.segment) as Segment
    const root_cause = coerceLabel(row.root_cause as string, ROOT_CAUSES, NON_RESEARCH_FALLBACK.root_cause) as RootCause
    const unmet_need = coerceLabel(row.unmet_need as string, UNMET_NEEDS, NON_RESEARCH_FALLBACK.unmet_need) as UnmetNeed

    // Extract mentioned categories from review text
    const lowercaseText = review.text.toLowerCase()
    const mentioned = new Set<string>()
    for (const cat of BLINKIT_CATEGORIES) {
      if (lowercaseText.includes(cat)) {
        mentioned.add(cat)
      }
    }
    for (const [syn, cat] of Object.entries(CATEGORY_SYNONYM_MAP)) {
      if (lowercaseText.includes(syn)) {
        mentioned.add(cat)
      }
    }

    const outcome = isPositiveTheme(theme)
      ? 'successful'
      : theme === 'Other Exploration Frustration'
        ? 'unclear'
        : 'failed'

    // Formulate research questions mapping
    const research_questions: ClassifiedReview['research_questions'] = [
      'shopping_behaviors',
      'segment_challenges',
    ]
    if (outcome !== 'successful') {
      research_questions.push('why_exploration_fails')
    }
    if (!isPositiveTheme(theme)) {
      research_questions.push('top_frustrations')
    }
    if (root_cause !== 'Unclear Repeat-Purchase Cause') {
      research_questions.push('repeat_purchase_causes')
    }
    if (unmet_need !== 'General Discovery Improvement') {
      research_questions.push('unmet_needs')
    }

    const confidence = Math.min(1.0, Math.max(0.0, Number(row.confidence) || 0.0))
    const classification_reasons = Array.isArray(row.classification_reasons)
      ? row.classification_reasons.map(String)
      : []

    return {
      ...review,
      research_relevant: theme !== NON_RESEARCH_FALLBACK.theme,
      research_questions,
      evidence: review.text.slice(0, Math.min(100, review.text.length)),
      exploration_outcome: outcome,
      theme,
      barrier,
      behavior,
      emotion,
      segment,
      root_cause,
      unmet_need,
      mentioned_categories: Array.from(mentioned),
      confidence,
      classification_reasons,
    }
  })
}

export function isRecoverable(status: number, message: string): boolean {
  const m = message.toLowerCase()
  const perDay = /per day|daily|tpd|rpd/.test(m)
  if (perDay) return false
  if (/billing|insufficient|credits/.test(m)) return false

  if ([429, 500, 503, 504].includes(status) || status >= 500) return true

  const perMinute = /per minute|per hour|tpm|rpm|tph|rph/.test(m)
  return perMinute || /rate limit|too many requests|resource exhausted/.test(m)
}

export async function classifyBatchWithRetries(
  inputs: CuratedReview[],
  config: LlmConfig,
  batchDelayMs = 2000,
): Promise<ClassifiedReview[]> {
  if (inputs.length === 0) return []

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(inputs)

  let attempt = 0
  const maxAttempts = 4

  while (attempt < maxAttempts) {
    try {
      const rawOutput = await callLlm(systemPrompt, userPrompt, config)
      return parseBatch(rawOutput, inputs)
    } catch (err: unknown) {
      attempt++
      const error = err as { status?: number; message?: string }
      const status = error.status || 0
      const errMsg = error.message || String(err)
      const isRec = isRecoverable(status, errMsg)

      console.warn(
        `[LLM CLASSIFY] Attempt ${attempt} failed for batch size ${inputs.length}. Status: ${status}. Error: ${errMsg}. Recoverable: ${isRec}`,
      )

      if (err instanceof LlmOutputTruncatedError) {
        // Halve batch size and retry recursively (halving the batch avoids deterministic truncation)
        if (inputs.length > 1) {
          console.info(`[LLM CLASSIFY] Truncation error. Halving batch from ${inputs.length} to two sub-batches.`)
          const mid = Math.ceil(inputs.length / 2)
          const left = inputs.slice(0, mid)
          const right = inputs.slice(mid)

          const leftResults = await classifyBatchWithRetries(left, config, batchDelayMs)
          // Add cooling-down delay before the next call
          await new Promise((r) => setTimeout(r, batchDelayMs))
          const rightResults = await classifyBatchWithRetries(right, config, batchDelayMs)

          return [...leftResults, ...rightResults]
        }
      }

      if (!isRec || attempt >= maxAttempts) {
        // Daily budget exhaustion, billing failures, or max retries reached: fatal
        throw err
      }

      // Recoverable error: backoff and retry
      const backoffDelay = 2000 * Math.pow(2, attempt)
      console.info(`[LLM CLASSIFY] Recoverable error. Waiting ${backoffDelay}ms before retry.`)
      await new Promise((r) => setTimeout(r, backoffDelay))
    }
  }

  throw new Error('LLM classification failed after maximum retries')
}
