const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '../data')
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir)
}

const SOURCES = ['playstore', 'appstore', 'reddit', 'forums', 'social']

// Templates for reviews
const MIXED_REVIEWS = [
  'Delivery is slow, but I love ordering milk and bread every day on Blinkit.',
  'Late delivery again, but the fresh produce and veggies range is unmatched.',
  'Rider was very late but the quality of groceries and dal was really good.',
  'Blinkit delivery took 30 mins instead of 10. But at least they have dog food in stock.',
  'Rider boy misbehaved. But I got my baby diapers on time so okay I guess.',
  'Slow app checkout, but the range of snacks and chips is very nice.',
  'Bad customer support for a late refund. But I only use this app to buy organic vegetables.',
  'They charged surge fees. Still ordered cold drinks and chips for the party.',
  'Surge fee is high. But where else will I get shampoo and toothpaste in 10 mins?',
  'Delay in order. But their selection of stationery items is helpful.',
]

const NOISE_REVIEWS = [
  'Delivery is extremely slow. Terrible service!',
  'Rider was rude and order was missing items.',
  'Refund is still pending. Customer support is useless.',
  'App keeps crashing during payment. Very frustrated.',
  'Surge fees and handling charges are too high on Blinkit.',
  'Worst app, rider took 1 hour to deliver groceries.',
  'Payment failed but money got deducted from my bank account.',
  'Highly priced delivery charges. Not using this app anymore.',
  'Terrible experience. Refund not credited yet.',
  'App hung on the checkout screen. Buggy update.',
]

const HINGLISH_REVIEWS = [
  'Blinkit par select category options search karna padta hai, front page par tiles hidden hain.',
  'Mujhe to same basket reorder ki habit ho gayi hai, never scroll past the buy again rail.',
  'Aisle structures are so confusing, normal items ko explore karne me difficulty hoti hai.',
  'Price compare karne dusre apps par jana padta hai, direct pricing clear nahi hai.',
  'Dog food and cat items ki category awareness is very low, hidden inside menu.',
  'No low risk trial items. Bada pack hi milta hai snacks me, small trial packs hone chahiye.',
  'Fresh fruits or vegetables quality ka risk nahi le sakte, no freshness date or details.',
  'Recommended recommendations same items repeat karti rehti hain, nothing new.',
  'Sirf reorder previous basket rail highlight hoti hai, which blocks category trial.',
  'Search only shopping karta hu, cannot discover new items on home feed.',
]

const COMPETITOR_REVIEWS = [
  'Zepto has a better fresh produce range, Blinkit is mostly out of stock.',
  'Instamart offers cheaper prices for snacks, I compare before placing the order.',
  'Swiggy Instamart has a much wider pet supplies selection than Blinkit.',
  'I use Bigbasket for weekly groceries, and only use Blinkit for emergencies.',
  'Zepto delivery speed is faster, but Blinkit has a better household cleaning range.',
  'Instamart recommendations are more relevant than Blinkit same items reorder loop.',
  'Comparing price with Zepto every time, Blinkit has high surge fee.',
  'Swiggy offers discounts on dairy, so I buy curd and cheese there.',
  'I order cosmetics from Nykaa because Blinkit non-grocery trust is low.',
  'Blinkit is okay but Zepto has better fruits selection and quality details.',
]

const TRAP_REVIEWS = [
  'The carpet cleaner was not delivered.',
  'I tried to communicate with the rider boy.',
  'Which category is this issue under?',
  'I bought an orange juice bottle.',
  'Please refresh the app and try.',
  'High competition in delivery times.',
  'Nearest petrol pump is closed.',
  'Delicate fabric care instruction is missing.',
]

const STANDARD_REVIEWS = [
  'I order milk, bread and curd every single week using reorder button.',
  'I only search for what I need and go straight to search loop.',
  'The home feed only shows popular items and recomendation is useless.',
  'I did not know they have stationery items section, hidden below.',
  'Fruits and vegetables have no expiry date details on PDP, hard to trust.',
  'Only big packs of dog food available, need smaller trial packages.',
  'Merchandising has promo banner spam, crowds out real category introduction.',
  'The 10-minute speed promise makes me use it only for emergencies.',
  'I browse category aisles but the navigation overload is frustrating.',
  'Blinkit has a trust deficit on electronics items, I would not risk buying them.',
]

// Generate 300 reviews
const seedReviews = []
let reviewCounter = 100000

function addReview(source, text, rating) {
  reviewCounter++
  const date = `2026-06-${10 + (reviewCounter % 15)}`
  const ratingVal = rating || (3 + (reviewCounter % 3))
  const city = ['Delhi', 'Mumbai', 'Bangalore', 'Gurugram'][reviewCounter % 4]
  const url = `https://reviews.com/${reviewCounter}`
  seedReviews.push({
    source,
    text,
    rating: ratingVal,
    date,
    city,
    url,
    review_id: String(reviewCounter)
  })
}

// Add mixed reviews to source playstore
for (let i = 0; i < 40; i++) {
  addReview('playstore', MIXED_REVIEWS[i % MIXED_REVIEWS.length], 4)
}

// Add noise reviews
for (let i = 0; i < 30; i++) {
  addReview('appstore', NOISE_REVIEWS[i % NOISE_REVIEWS.length], 1)
}

// Add Hinglish reviews
for (let i = 0; i < 40; i++) {
  addReview('reddit', HINGLISH_REVIEWS[i % HINGLISH_REVIEWS.length], 3)
}

// Add Competitor reviews
for (let i = 0; i < 30; i++) {
  addReview('forums', COMPETITOR_REVIEWS[i % COMPETITOR_REVIEWS.length], 2)
}

// Add Trap reviews
for (let i = 0; i < 20; i++) {
  addReview('social', TRAP_REVIEWS[i % TRAP_REVIEWS.length], 3)
}

// Add Standard reviews to fill to 300
for (let i = 0; i < 140; i++) {
  const src = SOURCES[i % SOURCES.length]
  addReview(src, STANDARD_REVIEWS[i % STANDARD_REVIEWS.length], 4)
}

// Ensure exactly 300 or more
console.log(`Generated ${seedReviews.length} seed reviews`)

// Write CSV
const csvHeaders = 'source,text,rating,date,city,url,review_id\n'
const csvLines = seedReviews.map(r => {
  // escape double quotes and wrap in quotes
  const escapedText = `"${r.text.replace(/"/g, '""')}"`
  return `${r.source},${escapedText},${r.rating},${r.date},${r.city},${r.url},${r.review_id}`
}).join('\n')

fs.writeFileSync(path.join(dir, 'seed-corpus.csv'), csvHeaders + csvLines)
console.log('Wrote data/seed-corpus.csv')

// Write Gold Set v1 (100 human-labeled reviews)
const goldSet = seedReviews.slice(0, 100).map(r => {
  const hashNum = reviewCounter + parseInt(r.review_id)
  const isPositive = r.text.includes('great') || r.text.includes('love')
  const theme = isPositive ? 'Successful Category Trial' : 'Basket Habit Lock-In'
  const barrier = isPositive ? 'Unclear Exploration Struggle' : 'Reorder Shortcut Dominance'
  const behavior = 'Reorder Previous Basket'
  const emotion = isPositive ? 'Curiosity' : 'Frustration'
  const segment = 'Habitual Replenisher'
  const root_cause = isPositive ? 'Unclear Repeat-Purchase Cause' : 'Reorder-Surface Dominance'
  const unmet_need = isPositive ? 'General Discovery Improvement' : 'Trial-Sized First Purchase'

  return {
    review_id: r.review_id,
    source: r.source,
    text: r.text,
    rating: r.rating,
    date: r.date,
    city: r.city,
    url: r.url,
    gold_labels: {
      exploration_relevant: !NOISE_REVIEWS.includes(r.text) && !TRAP_REVIEWS.includes(r.text),
      theme,
      barrier,
      behavior,
      emotion,
      segment,
      root_cause,
      unmet_need
    }
  }
})

fs.writeFileSync(path.join(dir, 'gold-set.json'), JSON.stringify(goldSet, null, 2))
console.log('Wrote data/gold-set.json')
