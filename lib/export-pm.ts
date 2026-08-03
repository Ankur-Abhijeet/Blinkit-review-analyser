import { Run } from './types'
import { buildProvenanceHeader } from './export'

/**
 * Serializes executive PM research synthesis report to presentation-ready Markdown (P7-T06).
 */
export function formatExecutiveReportMarkdown(run: Run): string {
  const provenance = buildProvenanceHeader(run)
  const exec = run.executive_report

  const headlines = `## Executive Summary
> **${exec.summary || 'Blinkit Category Discovery Research Summary'}**

### Curation & Behavioral Insights
- **Key Behaviors:** ${exec.behaviors}
- **Segment Differences:** ${exec.segmentDifferences}
- **Unmet Needs:** ${exec.unmetNeeds}
`

  const opportunitiesSection = (exec.opportunities || [])
    .map(
      (opp, i) => `### Opportunity ${opp.id || i + 1}: ${opp.blinkit_opportunity}
- **Opportunity Score:** ${opp.opportunity_score}/100
- **Size:** ${opp.size}
- **Target Segments:** ${opp.affected_segments.join(', ')}
- **Observed Barrier:** ${opp.root_cause}
- **Product Opportunity:** ${opp.blinkit_opportunity}

**Supporting Quotes:**
${opp.representative_quotes.map((q) => `> "${q.text}" — *${q.source}* [ID: \`${q.review_id}\`]`).join('\n')}
`,
    )
    .join('\n\n')

  const actionableFindingsSection = (run.findings || [])
    .map(
      (f, i) => `### Actionable Finding #${i + 1}: ${f.title}
- **Business Implication:** ${f.business_impact.join(', ')}
- **Recommended Action:** ${f.description}

> "${f.representative_quotes[0]?.text || ''}" [Review ID: \`${f.representative_quotes[0]?.review_id || ''}\`]
`,
    )
    .join('\n\n')

  const readinessSection = `## Research Quality & Director Readiness
- **Readiness Score:** ${run.readiness_score}/100
- **Identified Quality Gaps:**
${(run.readiness_gaps || []).map((g) => `- ${g}`).join('\n')}
`

  return `${provenance}

# ReviewLens — Executive PM Research Synthesis

${headlines}

## Strategic Product Opportunities
${opportunitiesSection}

## Actionable Research Findings
${actionableFindingsSection}

${readinessSection}
`
}

/**
 * Exports PM Research report to JSON format.
 */
export function exportPmReportJson(run: Run): string {
  return JSON.stringify(
    {
      provenance: {
        dataset: run.dataset_name,
        run_id: run.id,
        taxonomy_version: run.taxonomy_version,
        readiness_score: run.readiness_score,
        mock: run.mock,
      },
      executive_report: run.executive_report,
      readiness_gaps: run.readiness_gaps,
    },
    null,
    2,
  )
}
