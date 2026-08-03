import { fetchFromAllSources } from '../lib/collectors/index'
import { COLLECTOR_REGISTRY } from '../lib/collectors/index'

async function runVerification() {
  console.log('=== STARTING COLLECTOR SCRAPER VERIFICATION ===\n')

  const testOptions = {
    amount: 5,
    region: 'All India',
    sort: 'recent',
    minRating: 1
  }

  // 1. Test individual collectors directly to pinpoint any specific failures
  for (const [id, collector] of Object.entries(COLLECTOR_REGISTRY)) {
    console.log(`Testing Collector: [${id}] - ${collector.label}...`)
    try {
      let count = 0
      const reviews = []
      for await (const review of collector.fetch(testOptions)) {
        reviews.push(review)
        count++
        if (count >= 3) break // just grab up to 3 to verify functional yield
      }
      
      if (count > 0) {
        console.log(`✅ [${id}] SUCCESS: Fetched ${count} reviews successfully.`)
        console.log(`   Sample text: "${reviews[0].text.substring(0, 80).replace(/\n/g, ' ')}..."`)
      } else {
        console.log(`⚠️ [${id}] WARNING: Run succeeded but fetched 0 reviews. Check filter matches.`)
      }
    } catch (err: any) {
      console.log(`❌ [${id}] FAILED: ${err.message || err}`)
    }
    console.log('--------------------------------------------------')
  }

  // 2. Test overall orchestrated fetch
  console.log('\nTesting central orchestrated fetch (fetchFromAllSources)...')
  try {
    const result = await fetchFromAllSources(
      Object.keys(COLLECTOR_REGISTRY),
      {
        amount: 5,
        region: 'All India',
        sort: 'recent',
        minRating: 1
      }
    )
    const allResults = result.reviews

    console.log(`✅ Orchestrated fetch SUCCESS: Total ${allResults.length} reviews collected and aggregated.`)
  } catch (err: any) {
    console.log(`❌ Orchestrated fetch FAILED: ${err.message || err}`)
  }
}

runVerification()
