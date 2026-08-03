import { Run, ClassifiedReview } from './types'
import { BROADER_THEME_MAP } from './taxonomy'

/**
 * Generates standardized provenance header for all export formats (P7-T07).
 */
export function buildProvenanceHeader(run: Run): string {
  const isMockBadge = run.mock ? ' ⚠️ SYNTHETIC DATA' : ''
  return [
    `# ReviewLens Provenance Header${isMockBadge}`,
    `- Dataset: ${run.dataset_name}`,
    `- Run ID: ${run.id}`,
    `- Sequence: #${run.seq}`,
    `- Taxonomy Version: ${run.taxonomy_version}`,
    `- Director Readiness Score: ${run.readiness_score}/100`,
    `- LLM Provider: ${run.provider} (${run.model})`,
    `- Environment: ${run.environment}`,
    `- Generated At: ${run.created_at}`,
    `- Total Reviews Analyzed: ${run.total_reviews} (${run.exploration_relevant_count} exploration relevant)`,
    `---`,
  ].join('\n')
}

/**
 * Prevents CSV formula injection vulnerabilities by prefixing dangerous characters with single quote.
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return ''
  let str = String(val)

  // Escaping formula injection characters (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  // Wrap in quotes if it contains commas, quotes, or newlines
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Serializes classified reviews to a formula-injection safe CSV string (P7-T05).
 */
export function exportToCsv(reviews: ClassifiedReview[], run?: Run): string {
  const headers = [
    'review_id',
    'source',
    'rating',
    'date',
    'city',
    'exploration_relevant',
    'noise_category',
    'outcome',
    'user_goal',
    'research_relevant',
    'exploration_outcome',
    'theme',
    'barrier',
    'behavior',
    'emotion',
    'segment',
    'root_cause',
    'unmet_need',
    'mentioned_categories',
    'confidence',
    'evidence',
    'text',
  ]

  const lines: string[] = []

  if (run) {
    lines.push(`# Dataset: ${run.dataset_name} | Run ID: ${run.id} | Taxonomy: ${run.taxonomy_version} | Readiness: ${run.readiness_score}${run.mock ? ' | ⚠️ SYNTHETIC DATA' : ''}`)
  }

  lines.push(headers.join(','))

  reviews.forEach((r) => {
    const row = [
      escapeCsvCell(r.review_id),
      escapeCsvCell(r.source),
      escapeCsvCell(r.rating ?? ''),
      escapeCsvCell(r.date ?? ''),
      escapeCsvCell(r.city ?? ''),
      escapeCsvCell(r.exploration_relevant ? 'TRUE' : 'FALSE'),
      escapeCsvCell(r.noise_category ?? ''),
      escapeCsvCell(r.outcome ?? ''),
      escapeCsvCell(r.user_goal ?? ''),
      escapeCsvCell(r.research_relevant ? 'TRUE' : 'FALSE'),
      escapeCsvCell(r.exploration_outcome ?? ''),
      escapeCsvCell(r.theme ?? ''),
      escapeCsvCell(r.barrier ?? ''),
      escapeCsvCell(r.behavior ?? ''),
      escapeCsvCell(r.emotion ?? ''),
      escapeCsvCell(r.segment ?? ''),
      escapeCsvCell(r.root_cause ?? ''),
      escapeCsvCell(r.unmet_need ?? ''),
      escapeCsvCell(r.mentioned_categories ? r.mentioned_categories.join(';') : ''),
      escapeCsvCell(r.confidence ?? ''),
      escapeCsvCell(r.evidence ?? ''),
      escapeCsvCell(r.text ?? ''),
    ]
    lines.push(row.join(','))
  })

  return lines.join('\n')
}

/**
 * Serializes run and review data to formatted JSON string.
 */
export function exportToJson(run: Run, reviews: ClassifiedReview[]): string {
  return JSON.stringify(
    {
      provenance: {
        dataset: run.dataset_name,
        run_id: run.id,
        taxonomy_version: run.taxonomy_version,
        readiness_score: run.readiness_score,
        provider: run.provider,
        model: run.model,
        mock: run.mock,
        created_at: run.created_at,
      },
      run,
      reviews,
    },
    null,
    2,
  )
}

/**
 * Serializes full analysis report to Markdown format.
 */
export function exportToFullMarkdown(run: Run, reviews: ClassifiedReview[]): string {
  const provenance = buildProvenanceHeader(run)

  const executiveSummary = run.executive_report.summary || 'No executive summary generated.'

  const findingsSection = (run.findings || [])
    .map(
      (f) => `### Finding ${f.id}: ${f.title}
**Description:** ${f.description}
**Evidence Strength:** ${f.evidence_strength}

**Representative Quotes:**
${f.representative_quotes.map((q) => `- "${q.text}" (${q.source}, Confidence: ${q.confidence ? Math.round(q.confidence * 100) + '%' : 'N/A'}, ID: \`${q.review_id}\`)`).join('\n')}
`,
    )
    .join('\n\n')

  return `${provenance}

# ReviewLens Full Analysis Report

## Executive Summary
${executiveSummary}

## Research Findings
${findingsSection}
`
}

/**
 * Opens a dedicated print window with full styled HTML report containing heatmaps, tables, findings & 8 Q&As.
 */
export function openPrintablePdfWindow(run: Run): void {
  if (typeof window === 'undefined') return

  const report = run.executive_report
  const agg = run.aggregation
  const answers = report?.researchAnswers
  const opportunities = report?.opportunities || []
  const findings = run.findings || []

  // Helper to sort distribution maps
  const sortMap = (map?: Record<string, { count: number; pct: number }>) => {
    if (!map) return []
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([, v]) => v.count > 0)
  }

  const sortedThemes = sortMap(agg?.themes as unknown as Record<string, { count: number; pct: number }>)
  const sortedBarriers = sortMap(agg?.barriers as unknown as Record<string, { count: number; pct: number }>)
  const sortedRootCauses = sortMap(agg?.rootCauses as unknown as Record<string, { count: number; pct: number }>)
  const sortedUnmetNeeds = sortMap(agg?.unmetNeeds as unknown as Record<string, { count: number; pct: number }>)

  // Heatmap calculation for PDF
  const broaderCols = [
    'Discoverability & Search Navigation',
    'Assortment, Quality & Trust',
    'Reorder & Habit Lock-In',
    'Trial & Category Delight',
    'Other Exploration Frustration',
  ]

  const cellCounts: Record<string, Record<string, number>> = {}
  const rowTotals: Record<string, number> = {}
  let maxCellCount = 0

  if (agg?.segmentByTheme?.rows && agg?.segmentByTheme?.cols) {
    agg.segmentByTheme.rows.forEach((row) => {
      if (!cellCounts[row]) cellCounts[row] = {}
      agg.segmentByTheme.cols.forEach((col) => {
        const cell = agg.segmentByTheme.cells[row]?.[col]
        const count = typeof cell === 'object' && cell !== null ? cell.count : Number(cell || 0)
        if (count > 0) {
          const group = BROADER_THEME_MAP[col] || col
          cellCounts[row][group] = (cellCounts[row][group] || 0) + count
          rowTotals[row] = (rowTotals[row] || 0) + count
          if (cellCounts[row][group] > maxCellCount) {
            maxCellCount = cellCounts[row][group]
          }
        }
      })
    })
  }

  const activeRows = agg?.segmentByTheme?.rows.filter((r) => (rowTotals[r] || 0) > 0) || []
  const colTotals: Record<string, number> = {}
  broaderCols.forEach((col) => {
    activeRows.forEach((row) => {
      colTotals[col] = (colTotals[col] || 0) + (cellCounts[row]?.[col] || 0)
    })
  })
  const activeCols = broaderCols.filter((col) => (colTotals[col] || 0) > 0)

  const getIntensityStyle = (count: number, max: number) => {
    if (count === 0) return 'background:#f4f4f5; color:#a1a1aa;'
    const ratio = max > 0 ? count / max : 0
    if (ratio > 0.75) return 'background:#006b5c; color:#ffffff; font-weight:900;'
    if (ratio > 0.5) return 'background:#26a69a; color:#ffffff; font-weight:800;'
    if (ratio > 0.25) return 'background:#80cbc4; color:#00372f; font-weight:700;'
    return 'background:#e0f2f1; color:#006b5c; font-weight:600;'
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Blinkit Executive PDF Report - ${run.dataset_name}</title>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; padding: 28px; background: #ffffff; line-height: 1.5; font-size: 12px; }
    h1 { font-size: 22px; font-weight: 900; margin: 4px 0 0 0; color: #09090b; }
    h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #006b5c; border-bottom: 2px solid #e4e4e7; padding-bottom: 4px; margin-top: 24px; }
    h3 { font-size: 11px; font-weight: 800; color: #18181b; margin: 0 0 4px 0; }
    p { margin: 0 0 6px 0; color: #3f3f46; }
    .header { border-bottom: 2px solid #18181b; padding-bottom: 12px; margin-bottom: 20px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid #e4e4e7; border-radius: 10px; padding: 12px; background: #ffffff; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }
    .quote-box { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 8px; font-style: italic; font-size: 10px; margin-top: 6px; color: #27272a; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 800; text-transform: uppercase; background: #18181b; color: #ffffff; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .bar-container { background: #e4e4e7; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 2px; }
    .bar-fill { background: #006b5c; height: 100%; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
    th, td { border: 1px solid #d4d4d8; padding: 6px; text-align: left; }
    th { background: #f4f4f5; font-weight: 800; color: #18181b; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .page-break { page-break-before: always; break-before: page; }
    @media print {
      body { padding: 0; font-size: 10pt; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <span style="font-size:9px; font-weight:800; text-transform:uppercase; color:#006b5c; letter-spacing:1px;">Blinkit PM Research Executive Report</span>
    <h1>${run.dataset_name}</h1>
    <p style="font-size:10px; color:#71717a; margin-top:4px;">
      Run ID: <strong>${run.id}</strong> | Taxonomy: <strong>v${run.taxonomy_version}</strong> | LLM Model: <strong>${run.provider} (${run.model})</strong> | Director Readiness: <strong>${run.readiness_score}/10</strong>
    </p>
  </div>

  <!-- SOURCE MIX PIE / DISTRIBUTION BAR VISUALIZER -->
  <div class="card" style="margin-bottom:16px;">
    <h3 style="color:#006b5c; text-transform:uppercase; font-size:10px;">📊 Source Mix & Review Distribution</h3>
    <div style="display:flex; height:10px; border-radius:5px; overflow:hidden; background:#e4e4e7; margin:6px 0;">
      ${Object.entries(agg?.sourceDistribution || {}).map(([src, cnt], idx) => {
        const pct = Math.round((cnt / (run.total_reviews || 1)) * 100)
        const colors = ['#006b5c', '#0284c7', '#7c3aed', '#db2777', '#f59e0b']
        return `<div style="width:${pct}%; background:${colors[idx % colors.length]};"></div>`
      }).join('')}
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:10px;">
      ${Object.entries(agg?.sourceDistribution || {}).map(([src, cnt], idx) => {
        const pct = Math.round((cnt / (run.total_reviews || 1)) * 100)
        const colors = ['#006b5c', '#0284c7', '#7c3aed', '#db2777', '#f59e0b']
        return `<span style="display:inline-flex; align-items:center; gap:4px;"><span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${colors[idx % colors.length]};"></span><strong>${src}</strong>: ${cnt} (${pct}%)</span>`
      }).join('')}
    </div>
  </div>

  <h2>📝 Executive Summary & Strategic Overview</h2>
  <div class="grid-2">
    <div class="card"><h3>Executive Summary</h3><p>${report?.summary || 'N/A'}</p></div>
    <div class="card"><h3>Shopping Behaviors</h3><p>${report?.behaviors || 'N/A'}</p></div>
    <div class="card"><h3>Segment Dynamics</h3><p>${report?.segmentDifferences || 'N/A'}</p></div>
    <div class="card"><h3>Key Unmet Customer Needs</h3><p>${report?.unmetNeeds || 'N/A'}</p></div>
  </div>

  <!-- CROSS-TABULATION HEATMAP MATRIX TABLE -->
  ${activeRows.length > 0 && activeCols.length > 0 ? `
  <h2 class="page-break">🔥 Cross-Tabulation Heatmap Matrix (Segments x Themes)</h2>
  <div style="display:flex; gap:6px; align-items:center; font-size:9px; margin-bottom:8px;">
    <strong>Heatmap Density Legend:</strong>
    <span style="background:#e0f2f1; color:#006b5c; padding:2px 6px; border-radius:4px; font-weight:700;">Low (1-25%)</span>
    <span style="background:#80cbc4; color:#00372f; padding:2px 6px; border-radius:4px; font-weight:700;">Med (26-50%)</span>
    <span style="background:#26a69a; color:#fff; padding:2px 6px; border-radius:4px; font-weight:700;">High (51-75%)</span>
    <span style="background:#006b5c; color:#fff; padding:2px 6px; border-radius:4px; font-weight:900;">Hotspot (>75%)</span>
  </div>
  <table style="margin-bottom:16px;">
    <thead>
      <tr>
        <th>User Segment</th>
        ${activeCols.map((c) => `<th class="text-center">${c}</th>`).join('')}
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${activeRows.map((r) => `
        <tr>
          <td style="font-weight:800;">${r}</td>
          ${activeCols.map((c) => {
            const count = cellCounts[r]?.[c] || 0
            const rowTot = rowTotals[r] || 1
            const pct = count > 0 ? Math.round((count / rowTot) * 100) : 0
            const style = getIntensityStyle(count, maxCellCount)
            return `<td class="text-center" style="${style}">${count > 0 ? `<strong>${count}</strong><br/><span style="font-size:8px; opacity:0.8;">(${pct}%)</span>` : '-'}</td>`
          }).join('')}
          <td class="text-right" style="font-weight:800;">${rowTotals[r] || 0}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${answers ? `
  <h2>📊 8 Core PM Research Questions & Customer Evidence</h2>
  <div class="grid-2">
    ${Object.entries(answers).map(([k, item]) => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3>${item.question}</h3>
          <span class="badge">${item.keyMetric}</span>
        </div>
        <p style="margin-top:4px;">${item.answer}</p>
        ${item.quote ? `<div class="quote-box">&quot;${item.quote.text}&quot;<br/><span style="font-style:normal; font-size:8px; color:#71717a;">Source: ${item.quote.source} | Segment: ${item.quote.segment}</span></div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${opportunities.length > 0 ? `
  <h2 class="page-break">💡 Top 5 Strategic Product Opportunities</h2>
  ${opportunities.slice(0, 5).map((opp, idx) => `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>#${idx + 1}. ${opp.problem}</h3>
        <span class="badge badge-green">Score: ${opp.opportunity_score} (${opp.size})</span>
      </div>
      <p style="margin-top:4px;"><strong>Blinkit Intervention:</strong> ${opp.blinkit_opportunity}</p>
      <p><strong>User Behavior:</strong> ${opp.current_user_behavior}</p>
      ${opp.representative_quotes?.[0] ? `<div class="quote-box">&quot;${opp.representative_quotes[0].text}&quot;</div>` : ''}
    </div>
  `).join('')}
  ` : ''}

  ${findings.length > 0 ? `
  <h2>🔍 Executive Research Findings</h2>
  <div class="grid-2">
    ${findings.map((f) => `
      <div class="card">
        <h3>${f.title}</h3>
        <p>${f.description}</p>
        ${f.representative_quotes?.[0] ? `<div class="quote-box">&quot;${f.representative_quotes[0].text}&quot;</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <h2 class="page-break">📈 Corpus Distribution & Breakdown Charts</h2>
  <div class="grid-2">
    <div class="card">
      <h3>Top Friction Themes</h3>
      ${sortedThemes.slice(0, 5).map(([l, s]) => `
        <div style="margin-top:6px;">
          <div style="display:flex; justify-content:space-between; font-size:10px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
          <div class="bar-container"><div class="bar-fill" style="width:${s.pct}%;"></div></div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h3>Exploration Barriers</h3>
      ${sortedBarriers.slice(0, 5).map(([l, s]) => `
        <div style="margin-top:6px;">
          <div style="display:flex; justify-content:space-between; font-size:10px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
          <div class="bar-container"><div class="bar-fill" style="width:${s.pct}%;"></div></div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h3>Root Cause Mechanisms</h3>
      ${sortedRootCauses.slice(0, 5).map(([l, s]) => `
        <div style="margin-top:6px;">
          <div style="display:flex; justify-content:space-between; font-size:10px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
          <div class="bar-container"><div class="bar-fill" style="width:${s.pct}%;"></div></div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h3>Unmet Customer Needs</h3>
      ${sortedUnmetNeeds.slice(0, 5).map(([l, s]) => `
        <div style="margin-top:6px;">
          <div style="display:flex; justify-content:space-between; font-size:10px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
          <div class="bar-container"><div class="bar-fill" style="width:${s.pct}%;"></div></div>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }
}

/**
 * Generates and directly downloads a clean PDF file (Blinkit_Research_Report.pdf) without opening print dialogs.
 */
export async function downloadPdfFile(run: Run): Promise<void> {
  if (typeof window === 'undefined') return

  // Load html2pdf bundle dynamically if not present
  if (!(window as unknown as { html2pdf?: unknown }).html2pdf) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load PDF generator library'))
      document.head.appendChild(script)
    })
  }

  const report = run.executive_report
  const agg = run.aggregation
  const answers = report?.researchAnswers
  const opportunities = report?.opportunities || []
  const findings = run.findings || []

  const sortMap = (map?: Record<string, { count: number; pct: number }>) => {
    if (!map) return []
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([, v]) => v.count > 0)
  }

  const sortedThemes = sortMap(agg?.themes as unknown as Record<string, { count: number; pct: number }>)
  const sortedBarriers = sortMap(agg?.barriers as unknown as Record<string, { count: number; pct: number }>)
  const sortedRootCauses = sortMap(agg?.rootCauses as unknown as Record<string, { count: number; pct: number }>)
  const sortedUnmetNeeds = sortMap(agg?.unmetNeeds as unknown as Record<string, { count: number; pct: number }>)

  // Heatmap calculation
  const broaderCols = [
    'Discoverability & Search Navigation',
    'Assortment, Quality & Trust',
    'Reorder & Habit Lock-In',
    'Trial & Category Delight',
    'Other Exploration Frustration',
  ]

  const cellCounts: Record<string, Record<string, number>> = {}
  const rowTotals: Record<string, number> = {}
  let maxCellCount = 0

  if (agg?.segmentByTheme?.rows && agg?.segmentByTheme?.cols) {
    agg.segmentByTheme.rows.forEach((row) => {
      if (!cellCounts[row]) cellCounts[row] = {}
      agg.segmentByTheme.cols.forEach((col) => {
        const cell = agg.segmentByTheme.cells[row]?.[col]
        const count = typeof cell === 'object' && cell !== null ? cell.count : Number(cell || 0)
        if (count > 0) {
          const group = BROADER_THEME_MAP[col] || col
          cellCounts[row][group] = (cellCounts[row][group] || 0) + count
          rowTotals[row] = (rowTotals[row] || 0) + count
          if (cellCounts[row][group] > maxCellCount) {
            maxCellCount = cellCounts[row][group]
          }
        }
      })
    })
  }

  const activeRows = agg?.segmentByTheme?.rows.filter((r) => (rowTotals[r] || 0) > 0) || []
  const colTotals: Record<string, number> = {}
  broaderCols.forEach((col) => {
    activeRows.forEach((row) => {
      colTotals[col] = (colTotals[col] || 0) + (cellCounts[row]?.[col] || 0)
    })
  })
  const activeCols = broaderCols.filter((col) => (colTotals[col] || 0) > 0)

  const getIntensityStyle = (count: number, max: number) => {
    if (count === 0) return 'background:#f4f4f5; color:#a1a1aa;'
    const ratio = max > 0 ? count / max : 0
    if (ratio > 0.75) return 'background:#006b5c; color:#ffffff; font-weight:900;'
    if (ratio > 0.5) return 'background:#26a69a; color:#ffffff; font-weight:800;'
    if (ratio > 0.25) return 'background:#80cbc4; color:#00372f; font-weight:700;'
    return 'background:#e0f2f1; color:#006b5c; font-weight:600;'
  }

  const container = document.createElement('div')
  container.style.padding = '24px'
  container.style.background = '#ffffff'
  container.style.color = '#18181b'
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
  container.style.fontSize = '12px'

  container.innerHTML = `
    <div style="border-bottom:2px solid #18181b; padding-bottom:12px; margin-bottom:16px;">
      <span style="font-size:10px; font-weight:800; text-transform:uppercase; color:#006b5c; letter-spacing:1px;">Blinkit PM Research Executive Report</span>
      <h1 style="font-size:20px; font-weight:900; margin:4px 0 0 0;">${run.dataset_name}</h1>
      <p style="font-size:10px; color:#71717a; margin-top:4px;">Run ID: ${run.id} | Taxonomy: v${run.taxonomy_version} | Readiness Score: ${run.readiness_score}/10</p>
    </div>

    <!-- SOURCE MIX PIE / DISTRIBUTION BAR VISUALIZER -->
    <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px; margin-bottom:16px;">
      <strong style="color:#006b5c; text-transform:uppercase; font-size:10px;">📊 Source Mix & Review Distribution</strong>
      <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; background:#e4e4e7; margin:6px 0;">
        ${Object.entries(agg?.sourceDistribution || {}).map(([src, cnt], idx) => {
          const pct = Math.round((cnt / (run.total_reviews || 1)) * 100)
          const colors = ['#006b5c', '#0284c7', '#7c3aed', '#db2777', '#f59e0b']
          return `<div style="width:${pct}%; background:${colors[idx % colors.length]};"></div>`
        }).join('')}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:10px;">
        ${Object.entries(agg?.sourceDistribution || {}).map(([src, cnt], idx) => {
          const pct = Math.round((cnt / (run.total_reviews || 1)) * 100)
          const colors = ['#006b5c', '#0284c7', '#7c3aed', '#db2777', '#f59e0b']
          return `<span style="display:inline-flex; align-items:center; gap:4px;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${colors[idx % colors.length]};"></span><strong>${src}</strong>: ${cnt} (${pct}%)</span>`
        }).join('')}
      </div>
    </div>

    <h2 style="font-size:12px; font-weight:800; text-transform:uppercase; color:#006b5c; border-bottom:1px solid #e4e4e7; padding-bottom:4px; margin-top:16px;">📝 Executive Summary & Strategic Overview</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;"><strong>Executive Summary:</strong><p style="margin-top:4px; color:#3f3f46;">${report?.summary || 'N/A'}</p></div>
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;"><strong>Shopping Behaviors:</strong><p style="margin-top:4px; color:#3f3f46;">${report?.behaviors || 'N/A'}</p></div>
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;"><strong>Segment Dynamics:</strong><p style="margin-top:4px; color:#3f3f46;">${report?.segmentDifferences || 'N/A'}</p></div>
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;"><strong>Key Unmet Needs:</strong><p style="margin-top:4px; color:#3f3f46;">${report?.unmetNeeds || 'N/A'}</p></div>
    </div>

    <!-- CROSS-TABULATION HEATMAP MATRIX TABLE -->
    ${activeRows.length > 0 && activeCols.length > 0 ? `
    <h2 style="font-size:12px; font-weight:800; text-transform:uppercase; color:#006b5c; border-bottom:1px solid #e4e4e7; padding-bottom:4px; margin-top:20px;">🔥 Cross-Tabulation Heatmap Matrix (Segments x Themes)</h2>
    <div style="display:flex; gap:6px; align-items:center; font-size:9px; margin-top:6px; margin-bottom:6px;">
      <strong>Heatmap Density Legend:</strong>
      <span style="background:#e0f2f1; color:#006b5c; padding:2px 6px; border-radius:4px; font-weight:700;">Low (1-25%)</span>
      <span style="background:#80cbc4; color:#00372f; padding:2px 6px; border-radius:4px; font-weight:700;">Med (26-50%)</span>
      <span style="background:#26a69a; color:#fff; padding:2px 6px; border-radius:4px; font-weight:700;">High (51-75%)</span>
      <span style="background:#006b5c; color:#fff; padding:2px 6px; border-radius:4px; font-weight:900;">Hotspot (>75%)</span>
    </div>
    <table style="width:100%; border-collapse:collapse; font-size:10px; margin-top:6px;">
      <thead>
        <tr style="background:#f4f4f5;">
          <th style="border:1px solid #ddd; padding:4px; text-align:left;">User Segment</th>
          ${activeCols.map((c) => `<th style="border:1px solid #ddd; padding:4px; text-align:center;">${c}</th>`).join('')}
          <th style="border:1px solid #ddd; padding:4px; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${activeRows.map((r) => `
          <tr>
            <td style="border:1px solid #ddd; padding:4px; font-weight:800;">${r}</td>
            ${activeCols.map((c) => {
              const count = cellCounts[r]?.[c] || 0
              const rowTot = rowTotals[r] || 1
              const pct = count > 0 ? Math.round((count / rowTot) * 100) : 0
              const style = getIntensityStyle(count, maxCellCount)
              return `<td style="border:1px solid #ddd; padding:4px; text-align:center; ${style}">${count > 0 ? `<strong>${count}</strong><br/><span style="font-size:8px; opacity:0.8;">(${pct}%)</span>` : '-'}</td>`
            }).join('')}
            <td style="border:1px solid #ddd; padding:4px; text-align:right; font-weight:800;">${rowTotals[r] || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${answers ? `
    <h2 style="font-size:12px; font-weight:800; text-transform:uppercase; color:#006b5c; border-bottom:1px solid #e4e4e7; padding-bottom:4px; margin-top:20px;">📊 8 Core PM Research Questions & Customer Evidence</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
      ${Object.entries(answers).map(([k, item]) => `
        <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px; background:#fafafa;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:11px;">${item.question}</strong>
            <span style="font-size:9px; font-weight:800; background:#18181b; color:#fff; padding:2px 6px; border-radius:10px;">${item.keyMetric}</span>
          </div>
          <p style="margin-top:4px; color:#3f3f46;">${item.answer}</p>
          ${item.quote ? `<div style="background:#f4f4f5; border:1px solid #e4e4e7; border-radius:6px; padding:6px; font-style:italic; font-size:10px; margin-top:6px;">&quot;${item.quote.text}&quot;<br/><span style="font-style:normal; font-size:8px; color:#71717a;">Source: ${item.quote.source} | Segment: ${item.quote.segment}</span></div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${opportunities.length > 0 ? `
    <h2 style="font-size:12px; font-weight:800; text-transform:uppercase; color:#006b5c; border-bottom:1px solid #e4e4e7; padding-bottom:4px; margin-top:20px;">💡 Top 5 Strategic Product Opportunities</h2>
    ${opportunities.slice(0, 5).map((opp, idx) => `
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px; margin-top:8px;">
        <strong style="font-size:11px;">#${idx + 1}. ${opp.problem}</strong> (Score: ${opp.opportunity_score} - ${opp.size})
        <p style="margin-top:4px; color:#3f3f46;"><strong>Intervention:</strong> ${opp.blinkit_opportunity}</p>
        ${opp.representative_quotes?.[0] ? `<div style="background:#f4f4f5; border:1px solid #e4e4e7; border-radius:6px; padding:6px; font-style:italic; font-size:10px; margin-top:4px;">&quot;${opp.representative_quotes[0].text}&quot;</div>` : ''}
      </div>
    `).join('')}
    ` : ''}

    <h2 style="font-size:12px; font-weight:800; text-transform:uppercase; color:#006b5c; border-bottom:1px solid #e4e4e7; padding-bottom:4px; margin-top:20px;">📈 Corpus Breakdown Charts & Progress Bars</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;">
        <strong style="font-size:10px; text-transform:uppercase;">Top Friction Themes</strong>
        ${sortedThemes.slice(0, 5).map(([l, s]) => `
          <div style="margin-top:4px;">
            <div style="display:flex; justify-content:space-between; font-size:9px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
            <div style="background:#e4e4e7; height:5px; border-radius:3px; overflow:hidden; margin-top:2px;"><div style="background:#006b5c; width:${s.pct}%; height:100%;"></div></div>
          </div>
        `).join('')}
      </div>
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;">
        <strong style="font-size:10px; text-transform:uppercase;">Exploration Barriers</strong>
        ${sortedBarriers.slice(0, 5).map(([l, s]) => `
          <div style="margin-top:4px;">
            <div style="display:flex; justify-content:space-between; font-size:9px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
            <div style="background:#e4e4e7; height:5px; border-radius:3px; overflow:hidden; margin-top:2px;"><div style="background:#006b5c; width:${s.pct}%; height:100%;"></div></div>
          </div>
        `).join('')}
      </div>
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;">
        <strong style="font-size:10px; text-transform:uppercase;">Root Cause Mechanisms</strong>
        ${sortedRootCauses.slice(0, 5).map(([l, s]) => `
          <div style="margin-top:4px;">
            <div style="display:flex; justify-content:space-between; font-size:9px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
            <div style="background:#e4e4e7; height:5px; border-radius:3px; overflow:hidden; margin-top:2px;"><div style="background:#006b5c; width:${s.pct}%; height:100%;"></div></div>
          </div>
        `).join('')}
      </div>
      <div style="border:1px solid #e4e4e7; border-radius:8px; padding:10px;">
        <strong style="font-size:10px; text-transform:uppercase;">Unmet Customer Needs</strong>
        ${sortedUnmetNeeds.slice(0, 5).map(([l, s]) => `
          <div style="margin-top:4px;">
            <div style="display:flex; justify-content:space-between; font-size:9px;"><span>${l}</span><strong>${s.count} (${s.pct}%)</strong></div>
            <div style="background:#e4e4e7; height:5px; border-radius:3px; overflow:hidden; margin-top:2px;"><div style="background:#006b5c; width:${s.pct}%; height:100%;"></div></div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  document.body.appendChild(container)

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Blinkit_Research_Report_${run.id.slice(0, 8)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  }

  const html2pdf = (window as unknown as { html2pdf: (element: HTMLElement, options: unknown) => { save: () => Promise<void> } }).html2pdf
  try {
    await html2pdf().set(opt).from(container).save()
  } finally {
    document.body.removeChild(container)
  }
}
