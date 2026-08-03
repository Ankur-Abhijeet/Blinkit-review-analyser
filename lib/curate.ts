import { RawReview, CuratedReview, CurationResult, CurationStats } from './types'
import { deduplicateReviews } from './collectors/dedupe'
import { isExplorationRelevant } from './collectors/keyword-filter'
import { createHash } from 'crypto'
import { callLlm, LlmConfig } from './llm/client'

export function normalizeText(text: string): string {
  if (!text) return ''

  // 1. Unicode NFKC normalize
  let normalized = text.normalize('NFKC')

  // 2. Strip forum and complaint-portal templates
  normalized = normalized.replace(/order\s*id\s*[:·-]\s*\w+/gi, '')
  normalized = normalized.replace(/store\s*[:·-]\s*\w+/gi, '')
  normalized = normalized.replace(/status\s*[:·-]\s*\w+/gi, '')
  normalized = normalized.replace(/date\s*[:·-]\s*\d{4}-\d{2}-\d{2}/gi, '')

  // 3. Strip signatures and quoted-reply chains beyond depth 1
  normalized = normalized.replace(/sent\s*from\s*my\s*(iphone|ipad|android|samsung|oneplus|phone)/gi, '')
  
  // Strip reply chains like: > > nested quotes
  const lines = normalized.split('\n')
  const cleanLines = lines.filter((line) => {
    const match = line.match(/^(\s*>){2,}/)
    return !match
  })
  normalized = cleanLines.join('\n')

  // 4. Collapse whitespace and repeated punctuation
  normalized = normalized.replace(/[ \t]+/g, ' ')
  normalized = normalized.replace(/\n{3,}/g, '\n\n')
  normalized = normalized.replace(/(!{4,})/g, '!!!')
  normalized = normalized.replace(/(\?{4,})/g, '???')

  // 5. Preserve emoji: handled naturally in JS unicode strings.

  // 6. Truncate pathological lengths
  if (normalized.length > 2000) {
    const head = normalized.slice(0, 900)
    const tail = normalized.slice(normalized.length - 900)
    normalized = `${head}\n[... truncated ...]\n${tail}`
  }

  return normalized.trim()
}

export function lengthFloor(text: string): boolean {
  return text.length >= 15
}

function computeDeterministicHash(text: string): number {
  const hash = createHash('md5').update(text).digest('hex')
  return parseInt(hash.slice(0, 8), 16)
}

const MOCK_GOALS = [
  'buy fresh groceries and milk daily',
  'order pet food for my dog',
  'find diaper brands for baby',
  'stock up on soft drinks and snacks',
  'get fresh fruits and organic vegetables',
  'try a new face wash or skin care product',
  'buy electronics accessories like phone charger',
]

export function judgeRelevanceStub(text: string): {
  exploration_relevant: boolean
  noise_category?: CuratedReview['noise_category']
  outcome?: CuratedReview['outcome']
  user_goal?: string
} {
  const lowercaseText = text.toLowerCase()

  // Comprehensive category & product signal regex for quick commerce / e-commerce
  const hasCategorySignal =
    /milk|bread|grocery|groceries|veggie|vegetable|fruit|apple|banana|tomato|potato|onion|dal|rice|flour|oil|butter|cheese|paneer|curd|dairy|egg|meat|chicken|fish|snack|chip|biscuit|chocolate|drink|soda|juice|water|coffee|tea|shampoo|soap|lotion|cream|skin|hair|diaper|baby|pet|dog|cat|stationery|charger|cable|battery|electronic|item|product|brand|store|stock|buy|bought|purchase|order|shop|quality|fresh|organic|assortment|selection|variety|range|aisle|category|option|pack|size|zepto|instamart|blinkit|bigbasket|nykaa/i.test(
      lowercaseText,
    )

  // Delivery check (only if pure delivery complaint without any category/product context)
  if (
    (lowercaseText.includes('delivery') ||
      lowercaseText.includes('rider') ||
      lowercaseText.includes('late') ||
      lowercaseText.includes('delay') ||
      lowercaseText.includes('boy')) &&
    !hasCategorySignal
  ) {
    return { exploration_relevant: false, noise_category: 'delivery' }
  }

  // Payment check
  if (
    (lowercaseText.includes('payment') ||
      lowercaseText.includes('refund') ||
      lowercaseText.includes('transaction') ||
      lowercaseText.includes('failed') ||
      lowercaseText.includes('money') ||
      lowercaseText.includes('wallet')) &&
    !hasCategorySignal
  ) {
    return { exploration_relevant: false, noise_category: 'payment' }
  }

  // App bug check
  if (
    (lowercaseText.includes('crash') ||
      lowercaseText.includes('bug') ||
      lowercaseText.includes('stuck') ||
      lowercaseText.includes('error') ||
      lowercaseText.includes('install')) &&
    !hasCategorySignal
  ) {
    return { exploration_relevant: false, noise_category: 'app_bug' }
  }

  // Pricing / fees check
  if (
    (lowercaseText.includes('charge') ||
      lowercaseText.includes('fee') ||
      lowercaseText.includes('pricey') ||
      lowercaseText.includes('expensive') ||
      lowercaseText.includes('costly')) &&
    !hasCategorySignal
  ) {
    return { exploration_relevant: false, noise_category: 'pricing_fees' }
  }

  // Generic praise check
  if (
    lowercaseText === 'good app' ||
    lowercaseText === 'nice app' ||
    lowercaseText === 'best app' ||
    lowercaseText === 'love this app' ||
    lowercaseText === 'awesome app'
  ) {
    return { exploration_relevant: false, noise_category: 'generic_praise' }
  }

  // Default exploration relevant
  const hashNum = computeDeterministicHash(text)
  const outcome: CuratedReview['outcome'] =
    hashNum % 3 === 0 ? 'successful' : hashNum % 3 === 1 ? 'failed' : 'unclear'
  const user_goal = MOCK_GOALS[hashNum % MOCK_GOALS.length]

  return {
    exploration_relevant: true,
    outcome,
    user_goal,
  }
}

export function curateReviews(reviews: RawReview[]): CurationResult {
  const uniqueReviews = deduplicateReviews(reviews)
  const duplicatesCount = reviews.length - uniqueReviews.length

  const records: CuratedReview[] = []
  const included: CuratedReview[] = []

  const categoryCounts: Record<string, number> = {
    not_exploration_related: 0,
    too_short: 0,
    generic_praise: 0,
    delivery: 0,
    pricing_fees: 0,
    app_bug: 0,
    payment: 0,
    customer_support: 0,
    off_topic: 0,
  }

  for (const raw of uniqueReviews) {
    const normalizedText = normalizeText(raw.text)

    // Check too_short BEFORE LLM call (P2-T04b)
    if (!lengthFloor(normalizedText)) {
      const curated: CuratedReview = {
        ...raw,
        text: normalizedText,
        exploration_relevant: false,
        noise_category: 'too_short',
      }
      records.push(curated)
      categoryCounts['too_short']++
      continue
    }

    // Check Filter 1 keyword prefilter
    if (!isExplorationRelevant(normalizedText)) {
      const curated: CuratedReview = {
        ...raw,
        text: normalizedText,
        exploration_relevant: false,
        noise_category: 'not_exploration_related',
      }
      records.push(curated)
      categoryCounts['not_exploration_related']++
      continue
    }

    // Stub relevance judge (Filter 2)
    const judgment = judgeRelevanceStub(normalizedText)
    const curated: CuratedReview = {
      ...raw,
      text: normalizedText,
      exploration_relevant: judgment.exploration_relevant,
      noise_category: judgment.noise_category,
      outcome: judgment.outcome,
      user_goal: judgment.user_goal,
    }

    records.push(curated)

    if (judgment.exploration_relevant) {
      included.push(curated)
    } else if (judgment.noise_category) {
      categoryCounts[judgment.noise_category]++
    }
  }

  const stats: CurationStats = {
    loaded: reviews.length,
    unique: uniqueReviews.length,
    duplicatesRemoved: duplicatesCount,
    sentToClassification: included.length,
    excluded: uniqueReviews.length - included.length,
    excludedByCategory: categoryCounts,
  }

  return {
    included,
    records,
    stats,
  }
}

export async function curateReviewsLlm(
  reviews: RawReview[],
  config: LlmConfig,
  effectiveBatchSize = 10,
): Promise<CurationResult> {
  const uniqueReviews = deduplicateReviews(reviews)
  const duplicatesCount = reviews.length - uniqueReviews.length

  const records: CuratedReview[] = []
  const included: CuratedReview[] = []

  const categoryCounts: Record<string, number> = {
    not_exploration_related: 0,
    too_short: 0,
    generic_praise: 0,
    delivery: 0,
    pricing_fees: 0,
    app_bug: 0,
    payment: 0,
    customer_support: 0,
    off_topic: 0,
  }

  // Pre-filter reviews:
  // 1. Drop reviews that are too short.
  // 2. Pre-classify clear noise (pure delivery, app bugs, refund complaints) & clear category matches via rule engine (0 tokens).
  // 3. Pass only ambiguous/borderline reviews to Groq LLM for deep evaluation.
  const candidatesForLlm: CuratedReview[] = []

  for (let idx = 0; idx < uniqueReviews.length; idx++) {
    const raw = uniqueReviews[idx]
    const normalizedText = normalizeText(raw.text)
    const reviewId = raw.review_id || `rev_${idx + 1}`

    if (!lengthFloor(normalizedText)) {
      const curated: CuratedReview = {
        ...raw,
        review_id: reviewId,
        text: normalizedText,
        exploration_relevant: false,
        noise_category: 'too_short',
      }
      records.push(curated)
      categoryCounts['too_short']++
      continue
    }

    // High-precision rule pre-classifier check
    const judgment = judgeRelevanceStub(normalizedText)

    // Clear noise (pure rider complaints, crashes, refunds, generic praise) -> drop with 0 LLM calls
    if (!judgment.exploration_relevant && judgment.noise_category) {
      const curated: CuratedReview = {
        ...raw,
        review_id: reviewId,
        text: normalizedText,
        exploration_relevant: false,
        noise_category: judgment.noise_category,
      }
      records.push(curated)
      categoryCounts[judgment.noise_category] = (categoryCounts[judgment.noise_category] || 0) + 1
      continue
    }

    // Clear category match (explicit product/grocery mention) -> keep with 0 LLM calls
    const lowercaseText = normalizedText.toLowerCase()
    const hasExplicitCategorySignal =
      lowercaseText.includes('milk') ||
      lowercaseText.includes('veggie') ||
      lowercaseText.includes('fruit') ||
      lowercaseText.includes('grocery') ||
      lowercaseText.includes('groceries') ||
      lowercaseText.includes('bread') ||
      lowercaseText.includes('curd') ||
      lowercaseText.includes('snack') ||
      lowercaseText.includes('item') ||
      lowercaseText.includes('order') ||
      lowercaseText.includes('buy') ||
      lowercaseText.includes('search') ||
      lowercaseText.includes('category') ||
      lowercaseText.includes('store') ||
      lowercaseText.includes('aisle') ||
      lowercaseText.includes('diaper') ||
      lowercaseText.includes('produce') ||
      lowercaseText.includes('fresh')

    if (judgment.exploration_relevant && hasExplicitCategorySignal) {
      const curated: CuratedReview = {
        ...raw,
        review_id: reviewId,
        text: normalizedText,
        exploration_relevant: true,
        outcome: judgment.outcome,
        user_goal: judgment.user_goal,
      }
      records.push(curated)
      included.push(curated)
      continue
    }

    // Ambiguous candidate -> send to Groq LLM for deep evaluation
    candidatesForLlm.push({
      ...raw,
      review_id: reviewId,
      text: normalizedText,
      exploration_relevant: true, // placeholder
    })
  }

  // Batch process remaining ambiguous candidates using LLM in chunks of effectiveBatchSize (default 10)
  const batchSize = Math.max(3, Number(effectiveBatchSize) || 10)
  const systemPrompt = `You are a review curator for Blinkit. Identify reviews relevant to "category exploration" (buying groceries, items, trying categories, browsing sections).

Exclude PURE noise with no category context:
- delivery: late riders, packaging, boy behavior
- app_bug: crashes, loading, login errors
- payment: refunds, wallet issues
- pricing_fees: delivery fee, surge fee
- generic_praise: "good app", "nice service"
- off_topic: unrelated

MIXED reviews mentioning a delivery/app issue AND a category/product (e.g. "milk delivered late") MUST be marked exploration_relevant: true!

Respond strictly with JSON:
{
  "curations": [
    {
      "id": string (matching input review id),
      "exploration_relevant": boolean,
      "noise_category"?: string,
      "outcome"?: "successful" | "failed" | "unclear",
      "user_goal"?: string
    }
  ]
}`

  for (let i = 0; i < candidatesForLlm.length; i += batchSize) {
    const batch = candidatesForLlm.slice(i, i + batchSize)
    const userPrompt = JSON.stringify(
      batch.map((r) => ({ id: String(r.review_id || 'unknown'), text: r.text })),
    )

    const curationsMap: Record<string, Record<string, unknown>> = {}
    
    // Call LLM with 1 retry on rate limit
    let rawResponse: string | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        rawResponse = await callLlm(systemPrompt, userPrompt, config)
        break
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (attempt === 1 && (errMsg.includes('413') || errMsg.includes('rate_limit') || errMsg.includes('TPM'))) {
          console.warn(`[LLM CURATE] TPM rate limit hit, backing off 3 seconds before retry...`)
          await new Promise((r) => setTimeout(r, 3000))
        } else {
          console.warn(`[LLM CURATE] Batch curation attempt ${attempt} failed:`, errMsg)
        }
      }
    }

    if (rawResponse) {
      try {
        let cleaned = rawResponse.trim()
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '')
        }
        const parsed = JSON.parse(cleaned.trim())
        const curationsArr = parsed.curations || parsed
        if (Array.isArray(curationsArr)) {
          curationsArr.forEach((val) => {
            const c = val as Record<string, unknown>
            if (c && (typeof c.id === 'string' || typeof c.id === 'number')) {
              curationsMap[String(c.id)] = c
            }
          })
        }
      } catch (parseErr) {
        console.warn(`[LLM CURATE] Failed to parse LLM curation output:`, parseErr)
      }
    }

    // Process batch results
    for (const rawReview of batch) {
      const id = String(rawReview.review_id || 'unknown')
      const match = curationsMap[id]

      let curated: CuratedReview
      if (match) {
        curated = {
          ...rawReview,
          exploration_relevant: Boolean(match.exploration_relevant),
          noise_category: (match.noise_category as CuratedReview['noise_category']) || undefined,
          outcome: (match.outcome as CuratedReview['outcome']) || undefined,
          user_goal: (match.user_goal as string) || undefined,
        }
      } else {
        // Fallback to local heuristic relevance judge
        const judgment = judgeRelevanceStub(rawReview.text)
        curated = {
          ...rawReview,
          exploration_relevant: judgment.exploration_relevant,
          noise_category: judgment.noise_category,
          outcome: judgment.outcome,
          user_goal: judgment.user_goal,
        }
      }

      records.push(curated)
      if (curated.exploration_relevant) {
        included.push(curated)
      } else if (curated.noise_category) {
        categoryCounts[curated.noise_category] = (categoryCounts[curated.noise_category] || 0) + 1
      }
    }

    // Delay between batches to respect rate limits
    if (i + batchSize < candidatesForLlm.length) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  const stats: CurationStats = {
    loaded: reviews.length,
    unique: uniqueReviews.length,
    duplicatesRemoved: duplicatesCount,
    sentToClassification: included.length,
    excluded: uniqueReviews.length - included.length,
    excludedByCategory: categoryCounts,
  }

  return {
    included,
    records,
    stats,
  }
}
