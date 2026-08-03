import { RawReview } from '../types'

export function parseCsv(csvText: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let inQuotes = false
  let curVal = ''

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          curVal += '"'
          i++ // skip double quote
        } else {
          inQuotes = false // close quote
        }
      } else {
        curVal += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(curVal)
        curVal = ''
      } else if (char === '\r' || char === '\n') {
        row.push(curVal)
        curVal = ''
        if (row.some((val) => val !== '')) {
          result.push(row)
        }
        row = []
        if (char === '\r' && nextChar === '\n') {
          i++
        }
      } else {
        curVal += char
      }
    }
  }
  if (curVal !== '' || row.length > 0) {
    row.push(curVal)
    if (row.some((val) => val !== '')) {
      result.push(row)
    }
  }
  return result
}

export function autoDetectHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  const textSynonyms = ['text', 'body', 'review', 'content', 'comment', 'description']
  const sourceSynonyms = ['source', 'platform', 'site', 'channel']
  const idSynonyms = ['review_id', 'id', 'key']
  const ratingSynonyms = ['rating', 'stars', 'score', 'rating_score']
  const dateSynonyms = ['date', 'timestamp', 'created_at', 'time']
  const citySynonyms = ['city', 'location', 'region']
  const urlSynonyms = ['url', 'link']

  headers.forEach((h, idx) => {
    const clean = h.trim().toLowerCase().replace(/['"_\-\s]/g, '')
    
    // Check match for text
    if (textSynonyms.some(s => s.replace(/['"_\-\s]/g, '') === clean)) {
      if (map['text'] === undefined) map['text'] = idx
    }
    // Check match for source
    else if (sourceSynonyms.some(s => s.replace(/['"_\-\s]/g, '') === clean)) {
      if (map['source'] === undefined) map['source'] = idx
    }
    // Check match for review_id
    else if (idSynonyms.some(s => s.replace(/['"_\-\s]/g, '') === clean)) {
      if (map['review_id'] === undefined) map['review_id'] = idx
    }
    // Check match for rating
    else if (ratingSynonyms.some(s => s.replace(/['"_\-\s]/g, '') === clean)) {
      if (map['rating'] === undefined) map['rating'] = idx
    }
    // Check match for date
    else if (dateSynonyms.some(s => s.replace(/['"_\-\s]/g, '') === clean)) {
      if (map['date'] === undefined) map['date'] = idx
    }
    // Check match for city
    else if (citySynonyms.some(s => s.replace(/['"_\-\s]/g, '') === clean)) {
      if (map['city'] === undefined) map['city'] = idx
    }
    // Check match for url
    else if (urlSynonyms.some(s => s.replace(/['"_\-\s]/g, '') === clean)) {
      if (map['url'] === undefined) map['url'] = idx
    }
  })

  return map
}

export function parseReviews(content: string): RawReview[] {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Upload is empty')
  }

  // Auto-detect JSON or CSV
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      return arr.map((val, idx) => {
        const item = val as Record<string, unknown>
        const text = item.text || item.body || item.review || item.content || item.comment
        const source = item.source || item.platform || item.site || 'unknown'
        if (!text) {
          throw new Error(`Record at index ${idx} is missing required 'text' or equivalent field`)
        }
        return {
          source: String(source),
          text: String(text),
          review_id: item.review_id || item.id ? String(item.review_id || item.id) : undefined,
          rating: item.rating !== undefined ? Number(item.rating) : undefined,
          date: item.date || item.timestamp || item.created_at ? String(item.date || item.timestamp || item.created_at) : undefined,
          city: item.city || item.location || item.region ? String(item.city || item.location || item.region) : undefined,
          url: item.url || item.link ? String(item.url || item.link) : undefined,
        }
      })
    } catch (err: unknown) {
      throw new Error(`Failed to parse upload as JSON: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Parse as CSV
  const rows = parseCsv(content)
  if (rows.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row')
  }

  const headers = rows[0]
  const headerMap = autoDetectHeaders(headers)

  if (headerMap['text'] === undefined) {
    throw new Error(`CSV is missing required text/body column. Found columns: ${headers.join(', ')}`)
  }

  const reviews: RawReview[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    // Skip empty lines
    if (row.length === 0 || (row.length === 1 && row[0] === '')) {
      continue
    }

    const textIdx = headerMap['text']
    const textVal = row[textIdx]
    if (!textVal) {
      continue // Skip rows with missing text
    }

    const sourceIdx = headerMap['source']
    const sourceVal = sourceIdx !== undefined ? row[sourceIdx] : 'unknown'

    const review: RawReview = {
      source: sourceVal || 'unknown',
      text: textVal,
    }

    if (headerMap['review_id'] !== undefined && row[headerMap['review_id']]) {
      review.review_id = row[headerMap['review_id']]
    }
    if (headerMap['rating'] !== undefined && row[headerMap['rating']]) {
      const parsedRating = Number(row[headerMap['rating']])
      if (!isNaN(parsedRating)) {
        review.rating = parsedRating
      }
    }
    if (headerMap['date'] !== undefined && row[headerMap['date']]) {
      review.date = row[headerMap['date']]
    }
    if (headerMap['city'] !== undefined && row[headerMap['city']]) {
      review.city = row[headerMap['city']]
    }
    if (headerMap['url'] !== undefined && row[headerMap['url']]) {
      review.url = row[headerMap['url']]
    }

    reviews.push(review)
  }

  return reviews
}
