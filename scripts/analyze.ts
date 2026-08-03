import fs from 'fs'
import path from 'path'
import { parseReviews } from '../lib/ingest/parse'
import { curateReviews } from '../lib/curate'
import { mockClassifyReview } from '../lib/llm/mock'
import { aggregateReviews } from '../lib/aggregate'
import { buildFindingsReport } from '../lib/findings'
import { synthesizeReport } from '../lib/synthesis'

function main() {
  const filePath = process.argv[2] || 'data/seed-corpus.csv'
  const absolutePath = path.resolve(filePath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n============================================================`)
  console.log(`🔍 ReviewLens Offline Analysis: ${path.basename(filePath)}`)
  console.log(`============================================================`)

  const content = fs.readFileSync(absolutePath, 'utf-8')

  try {
    // 1. Ingest
    const raw = parseReviews(content)

    // 2. Curate
    const curation = curateReviews(raw)

    // 3. Classify (Mock)
    // Check if skew mode is requested via env
    const skewMode = process.env.MOCK_SKEW_MODE === 'true'
    const classified = curation.included.map((r) => mockClassifyReview(r, skewMode))

    // 4. Aggregate
    const aggregation = aggregateReviews(raw, classified)

    // 5. Findings
    const findings = buildFindingsReport(classified)

    // 6. Synthesize
    const executive = synthesizeReport(classified, findings)

    // --- Render Curation Stats ---
    console.log(`\n--- 1. Preprocess & Curate Funnel ---`)
    console.log(`Loaded reviews:        ${curation.stats.loaded}`)
    console.log(`Unique reviews:        ${curation.stats.unique}`)
    console.log(`Duplicates removed:    ${curation.stats.duplicatesRemoved}`)
    console.log(`Sent to classification: ${curation.stats.sentToClassification}`)
    console.log(`Excluded reviews:      ${curation.stats.excluded}`)
    
    console.log(`\nExcluded by Category:`)
    Object.entries(curation.stats.excludedByCategory).forEach(([cat, count]) => {
      if (count > 0) {
        console.log(`- ${cat}: ${count}`)
      }
    })

    // --- Render Top Distributions ---
    console.log(`\n--- 2. Top Exploration Barriers (Q1) ---`)
    Object.entries(aggregation.barriers)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .forEach(([label, stat]) => {
        console.log(`- ${label}: ${stat.count} (${stat.pct}%)`)
      })

    console.log(`\n--- 3. Primary Shopping Behaviors (Q3) ---`)
    Object.entries(aggregation.behaviors)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .forEach(([label, stat]) => {
        console.log(`- ${label}: ${stat.count} (${stat.pct}%)`)
      })

    console.log(`\n--- 4. Executive Findings report (Q1-Q6) ---`)
    findings.forEach((finding) => {
      console.log(`\n[Finding: ${finding.id}] ${finding.title}`)
      console.log(`Description: ${finding.description}`)
      console.log(`Evidence count: ${finding.evidence_count} reviews from ${finding.source_count} sources`)
      console.log(`Affected segments: ${finding.affected_segments.join(', ')}`)
      console.log(`Confidence: ${finding.confidence} (${finding.confidence_score}) | Evidence strength: ${finding.evidence_strength}`)
      console.log(`Top quote: "${finding.representative_quotes[0]?.text || 'No quote'}"`)
    })

    // --- Render Scored Opportunities ---
    console.log(`\n--- 5. Scored Strategic Opportunities ---`)
    if (executive.opportunities.length === 0) {
      console.log(`(No opportunities cleared the validation gate)`)
    } else {
      executive.opportunities.slice(0, 3).forEach((opp, idx) => {
        console.log(`\n[Opportunity #${idx + 1}] Size: ${opp.size} | Score: ${opp.opportunity_score} (Impact: ${opp.impact_score}, Freq: ${opp.frequency_score}, Conf: ${opp.confidence_score})`)
        console.log(`Problem: ${opp.problem}`)
        console.log(`Intervention: ${opp.blinkit_opportunity}`)
        console.log(`User behavior context: ${opp.current_user_behavior}`)
      })
    }

    if (executive.rejectedOpportunities.length > 0) {
      console.log(`\nRejected Opportunities: ${executive.rejectedOpportunities.length}`)
    }

    // --- Render Actionable Slides ---
    console.log(`\n--- 6. Actionable Findings (Slide deck) ---`)
    executive.slides.forEach((slide, idx) => {
      console.log(`\n[Slide #${idx + 1}] ${slide.headline}`)
      console.log(`Supporting reviews: ${slide.review_count}`)
      console.log(`Quote: "${slide.quote}"`)
      console.log(`Implication: ${slide.implication}`)
      console.log(`Action: ${slide.action}`)
    })

    // --- Render Readiness Score ---
    console.log(`\n============================================================`)
    console.log(`⭐ Director-Readiness Score: ${executive.readinessScore}/10`)
    console.log(`============================================================`)
    if (executive.readinessGaps.length === 0) {
      console.log(`✅ All readiness checkpoints passed! Suitable for director-level presentation.`)
    } else {
      console.log(`Named gaps to address:`)
      executive.readinessGaps.forEach((gap) => console.log(`- ❌ ${gap}`))
    }

  } catch (err) {
    const error = err as Error
    console.error(`Analysis failed: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
