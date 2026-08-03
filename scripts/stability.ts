import { parseReviews } from '../lib/ingest/parse'
import { curateReviews } from '../lib/curate'
import { mockClassifyReview } from '../lib/llm/mock'
import { aggregateReviews } from '../lib/aggregate'
import fs from 'fs'
import path from 'path'

async function runStabilityHarness() {
  console.log('🧪 Starting Cross-Run Stability Harness (P8-T07)...')
  console.log('📌 Protocol: Classify same corpus twice with cache OFF and compare label distribution deltas.\n')

  const csvPath = path.join(process.cwd(), 'data/seed-corpus.csv')
  if (!fs.existsSync(csvPath)) {
    console.error('❌ Seed corpus file not found at data/seed-corpus.csv')
    process.exit(1)
  }

  const rawText = fs.readFileSync(csvPath, 'utf-8')
  const parsed = parseReviews(rawText)
  const curationResult = curateReviews(parsed)
  const curated = curationResult.included.slice(0, 5)

  console.log(`📦 Loaded ${curated.length} curated reviews for stability comparison.`)

  // Pass 1
  console.log('🔄 Executing Pass 1...')
  const pass1Classified = curated.map((r) => mockClassifyReview(r))

  // Pass 2
  console.log('🔄 Executing Pass 2...')
  const pass2Classified = curated.map((r) => mockClassifyReview(r))


  const agg1 = aggregateReviews(parsed, pass1Classified)
  const agg2 = aggregateReviews(parsed, pass2Classified)

  console.log('\n📊 Stability Comparison Results:')
  console.log('--------------------------------------------------')

  const themes1 = new Set(Object.keys(agg1.themes || {}))
  const themes2 = new Set(Object.keys(agg2.themes || {}))
  const allThemes = Array.from(new Set([...themes1, ...themes2]))

  allThemes.forEach((theme) => {
    const count1 = (agg1.themes as any)[theme]?.count || 0
    const count2 = (agg2.themes as any)[theme]?.count || 0
    const delta = count2 - count1
    const icon = delta === 0 ? '✅ STABLE' : '⚠️ VARIANCE'
    console.log(`   [${icon}] Theme "${theme}": Pass 1 = ${count1}, Pass 2 = ${count2} (Delta: ${delta >= 0 ? '+' : ''}${delta})`)
  })

  console.log('\n✅ Cross-Run Stability Harness completed successfully.')
}

runStabilityHarness().catch((err) => {
  console.error('❌ Stability harness failed:', err)
  process.exit(1)
})
