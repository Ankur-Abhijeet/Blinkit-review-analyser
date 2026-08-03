import { describe, it, expect, vi, beforeEach } from 'vitest'
import { estimateTokens, getLlmLimits, calculateBatchSize } from '../llm/limits'
import { isRecoverable, parseBatch, coerceLabel, classifyBatchWithRetries, BatchLengthMismatchError } from '../llm/classify'
import { buildSystemPrompt, buildUserPrompt } from '../llm/prompts'
import * as clientModule from '../llm/client'
import { CuratedReview } from '../types'

vi.mock('../llm/client', async () => {
  const actual = await vi.importActual<typeof clientModule>('../llm/client')
  return {
    ...actual,
    callLlm: vi.fn(),
  }
})

describe('Phase 3 - LLM Classification Integration & Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- 1. Token Estimator & Limits ---
  it('EV-P3-01: Token estimator vs typical spend is within 15%', () => {
    const text = 'This is a normal customer review for grocery delivery.'
    // A standard tokenizer gives ~10 tokens for 54 characters (4.1 chars per token is standard)
    const estimate = estimateTokens(text)
    // Real word count is 9. 9 * 1.3 = 11.7 tokens. 54 / 4.1 = 13.1 tokens.
    expect(estimate).toBeGreaterThanOrEqual(10)
    expect(estimate).toBeLessThanOrEqual(15)
  })

  it('EV-P3-02: getLlmLimits returns valid properties', () => {
    const groqLimits = getLlmLimits('groq')
    expect(groqLimits.requestsPerMinute).toBe(30)
    expect(groqLimits.defaultBatchSize).toBe(3)

    const cerebrasLimits = getLlmLimits('cerebras')
    expect(cerebrasLimits.requestsPerMinute).toBe(30)
  })

  it('EV-P3-03: calculateBatchSize respects limits and overrides', () => {
    expect(calculateBatchSize('groq')).toBe(3)
    expect(calculateBatchSize('groq', 16384, 8)).toBe(8)
    expect(calculateBatchSize('groq', 2000)).toBe(1)
  })

  // --- 2. Prompt Assembly ---
  it('EV-P3-04: prompt assembly includes research questions and allowed taxonomy values', () => {
    const system = buildSystemPrompt()
    expect(system).toContain('Blinkit category exploration and cross-category trial ONLY')
    expect(system).toContain('why_exploration_fails')
    expect(system).toContain('Basket Habit Lock-In')

    const user = buildUserPrompt([
      { source: 'playstore', text: 'Nice veggies', review_id: '123', exploration_relevant: true },
    ])
    expect(user).toContain('Nice veggies')
    expect(user).toContain('123')
  })

  // --- 3. Coercion & Parsing ---
  it('EV-P3-05: coerceLabel handles exact, case/trim match, and fallbacks', () => {
    const allowed = ['Frustration', 'Disappointment', 'Neutral']

    // Exact
    expect(coerceLabel('Frustration', allowed, 'Neutral')).toBe('Frustration')

    // Case and trim
    expect(coerceLabel('  disappointment  ', allowed, 'Neutral')).toBe('Disappointment')

    // Fallback
    expect(coerceLabel('Happy', allowed, 'Neutral')).toBe('Neutral')
  })

  it('EV-P3-06: parseBatch recovers from code fences, prose, and throws mismatch error', () => {
    const inputs: CuratedReview[] = [
      { source: 'reddit', text: 'Veggies are not fresh', review_id: 'r1', exploration_relevant: true },
    ]

    // JSON wrapped in code fences
    const responseWithFences = `
Here is your analysis:
\`\`\`json
{
  "reviews": [
    {
      "id": "r1",
      "theme": "Basket Habit Lock-In",
      "barrier": "Low Category Awareness",
      "behavior": "Reorder Previous Basket",
      "emotion": "Frustration",
      "segment": "Habitual Replenisher",
      "root_cause": "Reorder-Surface Dominance",
      "unmet_need": "Trial-Sized First Purchase",
      "confidence": 0.85,
      "classification_reasons": ["Test logic match"]
    }
  ]
}
\`\`\`
    `

    const parsed = parseBatch(responseWithFences, inputs)
    expect(parsed.length).toBe(1)
    expect(parsed[0].theme).toBe('Basket Habit Lock-In')
    expect(parsed[0].confidence).toBe(0.85)

    // Length mismatch throws BatchLengthMismatchError
    const mismatchedResponse = `{"reviews": []}`
    expect(() => parseBatch(mismatchedResponse, inputs)).toThrow(BatchLengthMismatchError)
  })

  // --- 4. Recovery & Backoff (isRecoverable) ---
  it('EV-P3-07: isRecoverable behaves as expected for various status and messages', () => {
    // 429 / 503 / 500 are recoverable
    expect(isRecoverable(429, 'Rate limit exceeded')).toBe(true)
    expect(isRecoverable(503, 'Service unavailable')).toBe(true)

    // 401 / 403 are fatal
    expect(isRecoverable(401, 'Unauthorized API Key')).toBe(false)

    // Daily quota message is fatal
    expect(isRecoverable(429, 'Daily quota exhausted for this model')).toBe(false)
    expect(isRecoverable(200, 'Credits depleted')).toBe(false)
  })

  // --- 5. Batch Classification Retry & Halving Recovery ---
  it('EV-P3-08: classifyBatchWithRetries recovers from 429 and output truncation', async () => {
    const inputs: CuratedReview[] = [
      { source: 'reddit', text: 'Text 1', review_id: 'r1', exploration_relevant: true },
      { source: 'social', text: 'Text 2', review_id: 'r2', exploration_relevant: true },
    ]

    const config = {
      provider: 'groq' as const,
      apiKey: 'test-key',
    }

    // Call 1: Throws 429
    // Call 2: Returns valid response
    const mockCallLlm = vi.spyOn(clientModule, 'callLlm')
    mockCallLlm
      .mockRejectedValueOnce(Object.assign(new Error('Rate Limit'), { status: 429 }))
      .mockResolvedValueOnce(JSON.stringify({
        reviews: [
          {
            id: 'r1',
            theme: 'Basket Habit Lock-In',
            barrier: 'Low Category Awareness',
            behavior: 'Reorder Previous Basket',
            emotion: 'Frustration',
            segment: 'Habitual Replenisher',
            root_cause: 'Reorder-Surface Dominance',
            unmet_need: 'Trial-Sized First Purchase',
            confidence: 0.9,
            classification_reasons: [],
          },
          {
            id: 'r2',
            theme: 'Successful Category Trial',
            barrier: 'Unclear Exploration Struggle',
            behavior: 'Browse Category Aisles',
            emotion: 'Neutral',
            root_cause: 'Unclear Repeat-Purchase Cause',
            unmet_need: 'General Discovery Improvement',
            confidence: 0.95,
            classification_reasons: [],
          },
        ]
      }))

    const results = await classifyBatchWithRetries(inputs, config, 10)
    expect(results.length).toBe(2)
    expect(results[0].theme).toBe('Basket Habit Lock-In')
    expect(results[1].theme).toBe('Successful Category Trial')
    expect(mockCallLlm).toHaveBeenCalledTimes(2)
  })

  it('EV-P3-09: classifyBatchWithRetries splits batch on JSON truncation error', async () => {
    const inputs: CuratedReview[] = [
      { source: 'reddit', text: 'Text 1', review_id: 'r1', exploration_relevant: true },
      { source: 'social', text: 'Text 2', review_id: 'r2', exploration_relevant: true },
    ]

    const config = {
      provider: 'groq' as const,
      apiKey: 'test-key',
    }

    // Call 1: returns truncated JSON (fails parsing)
    // Call 2 (left sub-batch): succeeds
    // Call 3 (right sub-batch): succeeds
    const mockCallLlm = vi.spyOn(clientModule, 'callLlm')
    mockCallLlm
      .mockResolvedValueOnce('{"reviews": [{"id": "r1", "theme": "Basket Ha...') // Truncated
      .mockResolvedValueOnce(JSON.stringify({
        reviews: [
          {
            id: 'r1',
            theme: 'Basket Habit Lock-In',
            barrier: 'Low Category Awareness',
            behavior: 'Reorder Previous Basket',
            emotion: 'Frustration',
            segment: 'Habitual Replenisher',
            root_cause: 'Reorder-Surface Dominance',
            unmet_need: 'Trial-Sized First Purchase',
            confidence: 0.9,
            classification_reasons: [],
          }
        ]
      }))
      .mockResolvedValueOnce(JSON.stringify({
        reviews: [
          {
            id: 'r2',
            theme: 'Successful Category Trial',
            barrier: 'Unclear Exploration Struggle',
            behavior: 'Browse Category Aisles',
            emotion: 'Neutral',
            root_cause: 'Unclear Repeat-Purchase Cause',
            unmet_need: 'General Discovery Improvement',
            confidence: 0.95,
            classification_reasons: [],
          }
        ]
      }))

    const results = await classifyBatchWithRetries(inputs, config, 10)
    expect(results.length).toBe(2)
    expect(results[0].theme).toBe('Basket Habit Lock-In')
    expect(results[1].theme).toBe('Successful Category Trial')
    // 1 original call + 2 split batch calls = 3 calls
    expect(mockCallLlm).toHaveBeenCalledTimes(3)
  })
})
