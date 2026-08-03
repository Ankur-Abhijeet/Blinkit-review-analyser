import { RawReview } from '../types'
import { createHash } from 'crypto'

export function computeCleanTextHash(text: string): string {
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s\d]/g, '') // remove punctuation
    .replace(/\s+/g, '')       // remove whitespace
  return createHash('sha1').update(clean).digest('hex')
}

export function deduplicateReviews<T extends RawReview>(reviews: T[]): T[] {
  const seenHashes = new Set<string>()
  const uniqueReviews: T[] = []

  for (const review of reviews) {
    const hash = computeCleanTextHash(review.text)
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash)
      uniqueReviews.push(review)
    }
  }

  return uniqueReviews
}
