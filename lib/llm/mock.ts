import { CuratedReview, ClassifiedReview } from '../types'
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
import { createHash } from 'crypto'

function computeDeterministicHash(text: string): number {
  const hash = createHash('md5').update(text).digest('hex')
  return parseInt(hash.slice(0, 8), 16)
}

export function mockClassifyReview(
  review: CuratedReview,
  skewMode = false,
): ClassifiedReview {
  const hashNum = computeDeterministicHash(review.text)

  // Extract mentioned categories from text
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

  // Handle Skew Mode (everything collapses to fallbacks for readiness check testing)
  if (skewMode) {
    return {
      ...review,
      research_relevant: true,
      research_questions: ['shopping_behaviors', 'segment_challenges'],
      evidence: review.text.slice(0, Math.min(50, review.text.length)),
      exploration_outcome: 'unclear',
      theme: NON_RESEARCH_FALLBACK.theme,
      barrier: NON_RESEARCH_FALLBACK.barrier,
      behavior: NON_RESEARCH_FALLBACK.behavior,
      emotion: NON_RESEARCH_FALLBACK.emotion,
      segment: NON_RESEARCH_FALLBACK.segment,
      root_cause: NON_RESEARCH_FALLBACK.root_cause,
      unmet_need: NON_RESEARCH_FALLBACK.unmet_need,
      mentioned_categories: Array.from(mentioned),
      confidence: 0.35,
      classification_reasons: ['Skew mode fallback assigned'],
    }
  }

  // Determine positive vs negative based on curated outcome/text
  const isPositive = review.outcome === 'successful' || lowercaseText.includes('great') || lowercaseText.includes('love')

  const theme: Theme = isPositive
    ? POSITIVE_THEMES[hashNum % POSITIVE_THEMES.length]
    : NEGATIVE_THEMES[hashNum % NEGATIVE_THEMES.length]

  const segment: Segment = SEGMENTS[hashNum % SEGMENTS.length]
  const behavior: ShoppingBehavior = SHOPPING_BEHAVIORS[hashNum % SHOPPING_BEHAVIORS.length]

  let barrier: Barrier
  let root_cause: RootCause
  let unmet_need: UnmetNeed
  let emotion: Emotion
  let outcome: 'successful' | 'failed' | 'unclear'

  if (isPositiveTheme(theme)) {
    barrier = 'Unclear Exploration Struggle'
    root_cause = 'Unclear Repeat-Purchase Cause'
    unmet_need = 'General Discovery Improvement'
    emotion = hashNum % 2 === 0 ? 'Curiosity' : 'Neutral'
    outcome = 'successful'
  } else {
    barrier = BARRIERS[hashNum % BARRIERS.length]
    root_cause = ROOT_CAUSES[hashNum % ROOT_CAUSES.length]
    unmet_need = UNMET_NEEDS[hashNum % UNMET_NEEDS.length]
    emotion = EMOTIONS[hashNum % (EMOTIONS.length - 2)] // pick Frustration, Disappointment, etc.
    outcome = review.outcome || (hashNum % 2 === 0 ? 'failed' : 'unclear')
  }

  // Populate research questions mapping
  const research_questions: ClassifiedReview['research_questions'] = [
    'shopping_behaviors',
    'segment_challenges',
  ]
  if (outcome !== 'successful') {
    research_questions.push('why_exploration_fails')
  }
  if (!isPositive) {
    research_questions.push('top_frustrations')
  }
  if (root_cause !== 'Unclear Repeat-Purchase Cause') {
    research_questions.push('repeat_purchase_causes')
  }
  if (unmet_need !== 'General Discovery Improvement') {
    research_questions.push('unmet_needs')
  }

  const confidence = Number((0.55 + (hashNum % 41) / 100).toFixed(2))

  return {
    ...review,
    research_relevant: true,
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
    classification_reasons: [
      'Seeded deterministic mock classification',
      `Theme matched: "${theme}"`,
      `Root cause: "${root_cause}"`,
    ],
  }
}
