import { listRuns, loadRun } from '../lib/db/runs'

async function runSpotCheck() {
  console.log('🔍 Starting Human Spot-Check Auditing Tool (P8-T08)...')

  const runs = await listRuns()
  if (runs.length === 0) {
    console.log('⚠️ No persisted runs found in database. Run an analysis first.')
    return
  }

  const latestRun = runs[0]
  console.log(`📌 Inspecting latest run: "${latestRun.dataset_name}" (ID: ${latestRun.id})`)

  const data = await loadRun(latestRun.id)
  if (!data || data.reviews.length === 0) {
    console.log('⚠️ No classified reviews found in this run.')
    return
  }

  const sampleSize = Math.min(5, data.reviews.length)
  const sampled = data.reviews.slice(0, sampleSize)

  console.log(`\n📋 Sampled ${sampleSize} classified reviews for human agreement audit:\n`)

  sampled.forEach((r, idx) => {
    console.log(`--- Sample #${idx + 1} [ID: ${r.review_id}] ---`)
    console.log(`Source:      ${r.source}`)
    console.log(`Text:        "${r.text}"`)
    console.log(`Theme:       ${r.theme}`)
    console.log(`Barrier:     ${r.barrier}`)
    console.log(`Segment:     ${r.segment}`)
    console.log(`Root Cause:  ${r.root_cause}`)
    console.log(`Unmet Need:  ${r.unmet_need}`)
    console.log(`Confidence:  ${(r.confidence * 100).toFixed(1)}%`)
    console.log(`Evidence:    "${r.evidence}"\n`)
  })

  console.log('✅ Spot-check sampling complete. Record agreement rate in eval log.')
}

runSpotCheck().catch((err) => {
  console.error('❌ Spot-check script failed:', err)
  process.exit(1)
})
