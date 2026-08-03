import { RawReview } from '../types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NormalizedReview extends RawReview {
  /** Original text before normalization (preserved for audit) */
  _rawText: string
  /** Which normalizer was applied */
  _normalizer: string
}

type SourceNormalizerFn = (review: RawReview) => RawReview

// ─── Base Text Cleaning ─────────────────────────────────────────────────────

/**
 * Shared text normalization applied to ALL sources:
 * - Trim leading/trailing whitespace
 * - Strip zero-width Unicode characters (U+200B, U+200C, U+200D, U+FEFF)
 * - Collapse multiple whitespace/newlines into single space
 * - Decode common HTML entities (&amp; &lt; &gt; &quot; &#39;)
 * - Remove null bytes
 */
function normalizeBaseText(text: string): string {
  let t = text
  // Remove null bytes
  t = t.replace(/\0/g, '')
  // Strip zero-width chars
  t = t.replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
  // Decode HTML entities
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
  // Normalize smart quotes to plain quotes
  t = t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  // Collapse whitespace (preserve single newlines for readability, collapse doubles)
  t = t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ')
  // Trim
  t = t.trim()
  return t
}

/**
 * Normalize date string to YYYY-MM-DD format if possible.
 * Handles ISO strings, timestamps, and common date formats.
 */
function normalizeDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined
  const trimmed = dateStr.trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // ISO with time
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.split('T')[0]
  // Try Date parse as fallback
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return trimmed
}

/**
 * Clamp rating to 1-5 range, return undefined if invalid.
 */
function normalizeRating(rating?: number): number | undefined {
  if (rating === undefined || rating === null) return undefined
  const n = Number(rating)
  if (isNaN(n)) return undefined
  return Math.max(1, Math.min(5, Math.round(n)))
}

// ─── Source-Specific Normalizers ────────────────────────────────────────────

/**
 * Reddit: strip HTML tags, markdown formatting, cap length at 2000 chars.
 */
function normalizeReddit(review: RawReview): RawReview {
  let text = review.text
  // Strip HTML tags (Reddit API sometimes returns HTML in selftext_html)
  text = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
  // Strip common markdown formatting
  text = text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold/italic
    .replace(/~~([^~]+)~~/g, '$1')            // strikethrough
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/^\s*[-*+]\s+/gm, '')            // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')            // ordered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → text only
    .replace(/`{1,3}[^`]*`{1,3}/g, '')        // inline/block code
    .replace(/^>\s*/gm, '')                   // blockquotes
  // Remove [deleted] / [removed] entirely
  text = text.replace(/\[deleted\]/gi, '').replace(/\[removed\]/gi, '')
  // Cap at 2000 chars to prevent LLM context blowout from mega-posts
  if (text.length > 2000) {
    text = text.substring(0, 2000) + '…'
  }
  return { ...review, text }
}

/**
 * App Store: normalize smart quotes, strip Apple-specific Unicode artifacts.
 */
function normalizeAppStore(review: RawReview): RawReview {
  let text = review.text
  // Apple sometimes uses variation selectors (U+FE0E, U+FE0F) around emoji
  text = text.replace(/[\uFE0E\uFE0F]/g, '')
  return { ...review, text, rating: normalizeRating(review.rating) }
}

/**
 * Play Store: unescape CSV double-quotes, normalize.
 */
function normalizePlayStore(review: RawReview): RawReview {
  let text = review.text
  // Fix double-escaped quotes from CSV parsing
  text = text.replace(/""/g, '"')
  return { ...review, text, rating: normalizeRating(review.rating) }
}

/**
 * Forums: strip common complaint boilerplate, CSV artifacts.
 */
function normalizeForums(review: RawReview): RawReview {
  let text = review.text
  // Fix CSV double-quote artifacts
  text = text.replace(/""/g, '"')
  // Strip common boilerplate headers/footers from consumer forums
  text = text.replace(/^(complaint\s*#?\s*\d+[:\-\s]*)/gi, '')
  text = text.replace(/^(subject\s*:\s*)/gi, '')
  return { ...review, text, rating: normalizeRating(review.rating) }
}

/**
 * Social (Twitter/X): strip @mentions, #hashtags, and inline URLs while preserving surrounding text.
 */
function normalizeSocial(review: RawReview): RawReview {
  let text = review.text
  // Remove @mentions (keep only the text around them)
  text = text.replace(/@\w+/g, '')
  // Remove #hashtags but keep the word
  text = text.replace(/#(\w+)/g, '$1')
  // Remove inline URLs
  text = text.replace(/https?:\/\/\S+/g, '')
  // Remove t.co shortened URLs
  text = text.replace(/t\.co\/\S+/g, '')
  return { ...review, text, rating: normalizeRating(review.rating) }
}

/**
 * Product Reviews: base normalization + rating clamp.
 */
function normalizeProductReviews(review: RawReview): RawReview {
  return { ...review, rating: normalizeRating(review.rating) }
}

/**
 * Quick Commerce: base normalization + rating clamp.
 */
function normalizeQuickCommerce(review: RawReview): RawReview {
  return { ...review, rating: normalizeRating(review.rating) }
}

// ─── Registry ───────────────────────────────────────────────────────────────

// Optional value type: lookups are by arbitrary source id, so a miss is expected
// and the callers below branch on it.
const NORMALIZER_REGISTRY: Record<string, SourceNormalizerFn | undefined> = {
  reddit: normalizeReddit,
  appstore: normalizeAppStore,
  playstore: normalizePlayStore,
  forums: normalizeForums,
  social: normalizeSocial,
  product_reviews: normalizeProductReviews,
  quickcommerce: normalizeQuickCommerce,
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Normalize a single review through the source-specific normalizer pipeline.
 * Always applies base text cleaning first, then source-specific transforms.
 */
export function normalizeReview(review: RawReview): NormalizedReview {
  const rawText = review.text

  // 1. Base text normalization (shared across all sources)
  const baseNormalized: RawReview = {
    ...review,
    text: normalizeBaseText(review.text),
    date: normalizeDate(review.date),
  }

  // 2. Source-specific normalization
  const sourceNormalizer = NORMALIZER_REGISTRY[review.source]
  const normalized = sourceNormalizer
    ? sourceNormalizer(baseNormalized)
    : baseNormalized

  // 3. Final pass — re-trim and collapse whitespace after all transforms
  const finalText = normalized.text.replace(/\s+/g, ' ').trim()

  // 4. Skip empty reviews (all content was stripped)
  return {
    ...normalized,
    text: finalText || '[empty after normalization]',
    _rawText: rawText,
    _normalizer: sourceNormalizer ? review.source : 'base',
  }
}

/**
 * Normalize an array of reviews. Filters out reviews that are empty after normalization.
 */
export function normalizeReviews(reviews: RawReview[]): NormalizedReview[] {
  return reviews
    .map(normalizeReview)
    .filter((r) => r.text !== '[empty after normalization]')
}
