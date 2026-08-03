import { RawReview } from '../types'
import { Collector, FetchOptions, getRandomDelay } from './types'

export class ProductReviewsCollector implements Collector {
  id = 'product_reviews'
  label = 'Product Reviews (SKU PDP)'
  supports = { region: true, sort: false, minRating: true }

  private mockReviews: RawReview[] = [
    {
      source: this.id,
      review_id: 'prod_101',
      rating: 2,
      text: 'I bought organic tomatoes on Blinkit. The pack looked nice but half of them were squished inside. There is no freshness date or packaging detail on the app.',
      city: 'Delhi',
      date: '2026-06-15',
    },
    {
      source: this.id,
      review_id: 'prod_102',
      rating: 3,
      text: 'First time trying to buy cat litter and pet food from Blinkit. The selection is so narrow compared to Nykaa or Supertails. I could only find one generic brand.',
      city: 'Mumbai',
      date: '2026-06-16',
    },
    {
      source: this.id,
      review_id: 'prod_103',
      rating: 4,
      text: 'Blinkit baby diapers are super convenient, but the price is slightly higher than offline stores or Amazon. At least it arrived in 10 mins.',
      city: 'Bengaluru',
      date: '2026-06-17',
    },
    {
      source: this.id,
      review_id: 'prod_104',
      rating: 2,
      text: 'Ordered expensive gourmet cheese from Blinkit. The description says nothing about the flavor or shelf life. This information gap blocks trust.',
      city: 'Pune',
      date: '2026-06-18',
    },
    {
      source: this.id,
      review_id: 'prod_105',
      rating: 2,
      text: 'Bought a pack of premium avocados on Blinkit. Completely raw and hard as a rock. Very bad experience, won\'t order fresh veggies online again.',
      city: 'Kolkata',
      date: '2026-06-19',
    },
    {
      source: this.id,
      review_id: 'prod_106',
      rating: 5,
      text: 'Great milk and bread delivery. Always fresh, reorder loop makes it very easy to buy daily essentials.',
      city: 'Delhi',
      date: '2026-06-20',
    },
    {
      source: this.id,
      review_id: 'prod_107',
      rating: 1,
      text: 'Bought organic strawberries. They were completely moldy at the bottom. Disappointed with fresh produce quality control on quick commerce.',
      city: 'Mumbai',
      date: '2026-06-21',
    },
    {
      source: this.id,
      review_id: 'prod_108',
      rating: 3,
      text: 'Blinkit stationery is okay for quick emergency, but the range of sketchbooks is very limited. Only basic brands available.',
      city: 'Bengaluru',
      date: '2026-06-22',
      },
    {
      source: this.id,
      review_id: 'prod_109',
      rating: 2,
      text: 'Ordered cold cuts. Delivered warm, ice pack was completely melted. Huge health and safety risk for frozen foods.',
      city: 'Gurugram',
      date: '2026-06-23',
    },
    {
      source: this.id,
      review_id: 'prod_110',
      rating: 4,
      text: 'Useful bundling options on snacks and chips, but the trial pack size is missing. Need smaller trial options.',
      city: 'Delhi',
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

    // To handle amounts larger than the base mock size, we repeat elements
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

