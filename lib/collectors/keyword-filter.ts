/**
 * Review filter rule for scrapers:
 * A review is relevant for exploration analysis if it has >8 words OR >24 characters.
 * Filters out low-information micro-reviews (e.g., "good app", "nice", "ok").
 */
export function isExplorationRelevant(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  if (trimmed.length > 24) return true

  const words = trimmed.split(/\s+/).filter(Boolean)
  return words.length > 8
}
