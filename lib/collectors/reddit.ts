import { RawReview } from '../types'
import { Collector, FetchOptions, getRandomDelay } from './types'
import fs from 'fs'
import path from 'path'
import { parseReviews } from '../ingest/parse'

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(str: string): string {
  return str
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class RedditCollector implements Collector {
  id = 'reddit'
  label = 'Reddit'
  supports = { region: false, sort: false, minRating: false }

  /**
   * Attempts to get a Reddit API access token using client credentials.
   */
  private async getAccessToken(clientId: string, clientSecret: string, userAgent: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal,
      })

      if (!response.ok) {
        console.error(`[RedditCollector] OAuth token retrieval failed with status ${response.status}`)
        return null
      }

      const data = (await response.json()) as { access_token?: string }
      return data.access_token || null
    } catch (err) {
      console.error('[RedditCollector] OAuth authentication error:', err)
      return null
    }
  }

  async *fetch(opts: FetchOptions, signal?: AbortSignal): AsyncIterable<RawReview> {
    const amount = opts.amount
    let count = 0
    let fetchedAny = false

    const userAgent = 'MyUniqueBlinkitMonitor/1.0.0 (by /u/anonymous_operator)'
    const clientId = process.env.REDDIT_CLIENT_ID || ''
    const clientSecret = process.env.REDDIT_CLIENT_SECRET || ''

    let children: any[] = []
    let accessToken: string | null = null

    // 1. Try authenticated search if credentials are provided
    if (clientId && clientSecret) {
      console.log('[RedditCollector] Authenticating with Reddit API via client credentials...')
      accessToken = await this.getAccessToken(clientId, clientSecret, userAgent, signal)
    }

    if (accessToken) {
      try {
        console.log('[RedditCollector] Fetching authenticated search results from oauth.reddit.com...')
        const searchUrl = `https://oauth.reddit.com/search.json?q=Blinkit&sort=new&limit=100`
        const response = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': userAgent,
          },
          signal,
        })

        if (response.ok) {
          const data = await response.json()
          children = data.data?.children || []
        } else {
          console.error(`[RedditCollector] Authenticated fetch failed with status: ${response.status}`)
        }
      } catch (err) {
        console.error('[RedditCollector] Authenticated fetch error:', err)
      }

      // Process matched JSON search results
      if (children && children.length > 0) {
        for (const child of children) {
          if (count >= amount) break

          const p = child.data
          if (!p) continue

          const text = `${p.title}\n\n${p.selftext || ''}`.trim()
          if (!text) continue

          const review: RawReview = {
            source: this.id,
            text,
            review_id: p.id,
            date: p.created_utc ? new Date(p.created_utc * 1000).toISOString().split('T')[0] : undefined,
            url: `https://www.reddit.com${p.permalink}`,
          }

          yield review
          fetchedAny = true
          count++

          // Fetch comments for this post if we still have amount headroom
          if (count < amount && p.num_comments > 0) {
            await new Promise((resolve) => setTimeout(resolve, getRandomDelay())) // Politeness delay
            
            try {
              const commentsUrl = `https://oauth.reddit.com${p.permalink}.json?limit=20`
              const commentsResponse = await fetch(commentsUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'User-Agent': userAgent,
                },
                signal,
              })

              if (commentsResponse.ok) {
                const commentsData = await commentsResponse.json()
                const commentList = commentsData[1]?.data?.children

                if (commentList && Array.isArray(commentList)) {
                  for (const comm of commentList) {
                    if (count >= amount) break
                    const c = comm.data
                    if (!c || !c.body || c.body === '[deleted]' || c.body === '[removed]') continue

                    const commentReview: RawReview = {
                      source: this.id,
                      text: c.body,
                      review_id: c.id,
                      date: c.created_utc ? new Date(c.created_utc * 1000).toISOString().split('T')[0] : undefined,
                      url: `https://www.reddit.com${p.permalink}${c.id}`,
                    }

                    yield commentReview
                    fetchedAny = true
                    count++
                  }
                }
              }
            } catch (commErr) {
              console.error(`[RedditCollector] Comment fetch error:`, commErr)
            }
          }
        }
      }
    } else {
      // 2. Fall back to unauthenticated public RSS feed (more permissive than JSON endpoint)
      try {
        console.log('[RedditCollector] No API credentials. Fetching from public search RSS feed...')
        const rssUrl = `https://www.reddit.com/search.rss?q=Blinkit&sort=new`
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': userAgent,
          },
          signal,
        })

        if (response.ok) {
          const xmlText = await response.text()
          const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
          let match

          while ((match = entryRegex.exec(xmlText)) !== null) {
            if (count >= amount) break
            const entryBlock = match[1]

            const titleMatch = entryBlock.match(/<title>([\s\S]*?)<\/title>/)
            const title = titleMatch ? stripHtml(decodeHtmlEntities(titleMatch[1])) : ''

            const contentMatch = entryBlock.match(/<content[^>]*>([\s\S]*?)<\/content>/)
            let content = ''
            if (contentMatch) {
              const decodedHtml = decodeHtmlEntities(contentMatch[1])
              content = stripHtml(decodedHtml)
            }

            const idMatch = entryBlock.match(/<id>([\s\S]*?)<\/id>/)
            const id = idMatch ? idMatch[1] : ''

            const publishedMatch = entryBlock.match(/<published>([\s\S]*?)<\/published>/)
            const dateStr = publishedMatch ? publishedMatch[1].split('T')[0] : undefined

            const linkMatch = entryBlock.match(/<link href="([^"]*)"/)
            const linkStr = linkMatch ? linkMatch[1] : undefined

            const text = `${title}\n\n${content}`.trim()
            if (!text) continue

            const review: RawReview = {
              source: this.id,
              text,
              review_id: id,
              date: dateStr,
              url: linkStr,
            }

            yield review
            fetchedAny = true
            count++

            // Politeness delay after yielding each item to mimic human reading pacing
            await new Promise((resolve) => setTimeout(resolve, getRandomDelay()))
          }
        } else {
          console.warn(`[RedditCollector] Public search RSS returned status: ${response.status}`)
        }
      } catch (err) {
        console.error('[RedditCollector] Public RSS fetch error:', err)
      }
    }

    // 3. Fallback to seed corpus if live fetch returned no data (due to blocks or offline status)
    if (!fetchedAny && !signal?.aborted) {
      console.log(`[RedditCollector] Live search empty or blocked. Falling back to local seed data.`)
      try {
        const csvPath = path.join(process.cwd(), 'data', 'seed-corpus.csv')
        if (fs.existsSync(csvPath)) {
          const content = fs.readFileSync(csvPath, 'utf-8')
          const allReviews = parseReviews(content)
          const filtered = allReviews.filter((r) => r.source === this.id)
          for (const review of filtered) {
            if (signal?.aborted) break
            if (count >= amount) break
            yield review
            count++
          }
        }
      } catch (err) {
        console.error(`[RedditCollector] Fallback parsing failed:`, err)
      }
    }
  }
}



