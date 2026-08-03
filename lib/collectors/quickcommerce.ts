import { RawReview } from '../types'
import { Collector, FetchOptions, getRandomDelay } from './types'

export class QuickCommerceCollector implements Collector {
  id = 'quickcommerce'
  label = 'Quick Commerce Discussions'
  supports = { region: true, sort: false, minRating: true }

  private mockReviews: RawReview[] = [
    {
      source: this.id,
      review_id: 'qc_201',
      rating: 3,
      text: 'Instamart has a much wider range of organic fruits and veggies. On Blinkit, the premium items are always out of stock.',
      city: 'Delhi',
      date: '2026-06-15',
    },
    {
      source: this.id,
      review_id: 'qc_202',
      rating: 2,
      text: 'Zepto UI is so clean. On Blinkit, the home page is completely dominated by previous buy again items, which blocks new category trial.',
      city: 'Mumbai',
      date: '2026-06-16',
    },
    {
      source: this.id,
      review_id: 'qc_203',
      rating: 3,
      text: 'Blinkit pricing is higher for personal care items like shampoo and makeup. I prefer Zepto or Nykaa.',
      city: 'Bengaluru',
      date: '2026-06-17',
    },
    {
      source: this.id,
      review_id: 'qc_204',
      rating: 2,
      text: 'I ordered pet supplies from Zepto because Blinkit pet category awareness is low, it is hidden deep inside menus.',
      city: 'Delhi',
      date: '2026-06-18',
    },
    {
      source: this.id,
      review_id: 'qc_205',
      rating: 4,
      text: 'Daily essentials are super fast on Blinkit. But for monthly grocery shopping, Bigbasket offers better bulk discounts and trust.',
      city: 'Gurugram',
      date: '2026-06-19',
    },
    {
      source: this.id,
      review_id: 'qc_206',
      rating: 2,
      text: 'Zepto has a neat aisle list. Blinkit search works, but you cannot browse and explore categories.',
      city: 'Mumbai',
      date: '2026-06-20',
    },
    {
      source: this.id,
      review_id: 'qc_207',
      rating: 3,
      text: 'Blinkit surge fee is very high. I compared prices with Instamart and decided to order from them instead.',
      city: 'Bengaluru',
      date: '2026-06-21',
    },
    {
      source: this.id,
      review_id: 'qc_208',
      rating: 1,
      text: 'Why does Blinkit force high volume diaper packs? I wanted a trial size pack but they only sell 50 count packs.',
      city: 'Pune',
      date: '2026-06-22',
    },
    {
      source: this.id,
      review_id: 'qc_209',
      rating: 4,
      text: 'Quick delivery speed is amazing. But I wish they had more variety of imported snacks on Blinkit.',
      city: 'Delhi',
      date: '2026-06-23',
    },
    {
      source: this.id,
      review_id: 'qc_210',
      rating: 2,
      text: 'I do not buy electronics from Blinkit because customer support for high value returns is very slow.',
      city: 'Kolkata',
      date: '2026-06-24',
    },
  ]

  async *fetch(opts: FetchOptions, signal?: AbortSignal): AsyncIterable<RawReview> {
    const amount = opts.amount
    let count = 0
    const fastDelay = amount > 100

    const filtered = this.mockReviews.filter((r) => {
      if (opts.minRating !== undefined && r.rating !== undefined && r.rating < opts.minRating) return false
      if (opts.region && opts.region !== 'All India') {
        const regLower = opts.region.toLowerCase().trim()
        const cityLower = (r.city || '').toLowerCase().trim()
        if (!cityLower.includes(regLower) && !regLower.includes(cityLower)) {
          return false
        }
      }
      return true
    })

    let index = 0
    while (count < amount && filtered.length > 0) {
      if (signal?.aborted) break

      const original = filtered[index % filtered.length]
      const cycleNum = Math.floor(index / filtered.length)
      const copy: RawReview = {
        ...original,
        review_id: cycleNum > 0 ? `${original.review_id}_${cycleNum}` : original.review_id,
        text: cycleNum > 0 ? `${original.text} (Ref #${index + 1})` : original.text,
      }

      yield copy
      count++
      index++

      await new Promise((resolve) => setTimeout(resolve, getRandomDelay(fastDelay)))
    }
  }
}

