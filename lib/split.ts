import { CuratedReview } from './types'

export interface CorpusSplitPlan {
  totalCount: number
  partsCount: number
  maxBatchSize: number
  parts: Array<{
    partIndex: number;
    reviews: CuratedReview[];
    count: number;
  }>
}

/**
 * Plans a 2-5 way split of a curated review corpus when it exceeds token quota budget limits.
 */
export function planCorpusSplit(
  reviews: CuratedReview[],
  maxBatchSize: number = 100,
): CorpusSplitPlan {
  const totalCount = reviews.length

  if (totalCount <= maxBatchSize) {
    return {
      totalCount,
      partsCount: 1,
      maxBatchSize,
      parts: [
        {
          partIndex: 1,
          reviews,
          count: totalCount,
        },
      ],
    }
  }

  // Calculate required split parts (clamped between 2 and 5 parts)
  const calculatedParts = Math.ceil(totalCount / maxBatchSize)
  const partsCount = Math.min(Math.max(calculatedParts, 2), 5)
  const chunkSize = Math.ceil(totalCount / partsCount)

  const parts: CorpusSplitPlan['parts'] = []
  for (let i = 0; i < partsCount; i++) {
    const chunk = reviews.slice(i * chunkSize, (i + 1) * chunkSize)
    if (chunk.length > 0) {
      parts.push({
        partIndex: i + 1,
        reviews: chunk,
        count: chunk.length,
      })
    }
  }

  return {
    totalCount,
    partsCount: parts.length,
    maxBatchSize,
    parts,
  }
}
