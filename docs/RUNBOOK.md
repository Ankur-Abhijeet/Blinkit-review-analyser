# ReviewLens — Monthly Operational Runbook

This runbook documents the step-by-step protocol for executing repeatable monthly Blinkit review intelligence runs, performing pre-flight token cost reconciliation, conducting human spot-checks, exporting presentation decks, and tracking rolling drift alarms.

---

## 📅 Monthly Execution Cadence (7-Step Protocol)

### Step 1: Environment & Taxonomy Version Audit
Before launching a run, verify the deployed taxonomy version and ensure environment credentials are configured:
```bash
# Check current taxonomy hash and verify cache status
npx tsx scripts/flush-cache.ts
```
> ⚠️ **Rule:** If `lib/taxonomy.ts` was modified since the previous monthly run, you **must** flush the classification cache to prevent mixed-taxonomy aggregation errors.

---

### Step 2: Pre-Flight Budgeting & Token Cost Reconciliation
Estimate review volume and LLM token costs before starting classification:
- **Target Ingest Volume:** ~4,500 raw reviews across 7 sources (~900/source, weighted toward Reddit and Consumer Forums).
- **Survival Rate:** ~4.5% end-to-end survival (~200 curated exploration-relevant reviews).
- **Token Model:** ~300 tokens per review item.
- **Estimated Cost Formula:**
  $$\text{Cost (USD)} = \frac{\text{Curated Reviews} \times 300 \text{ tokens}}{1,000,000} \times \$0.20$$
  *Example:* 200 curated reviews $\approx$ 60,000 tokens $\approx$ **$0.012 USD**.

---

### Step 3: Launch Production Run
Execute the automated production pipeline runner:
```bash
# Launch live production fetch & classification
npx tsx scripts/production-run.ts
```
Verify that the run completes cleanly and outputs a **Director-Readiness Score $\ge 80/100$**.

---

### Step 4: 30-Minute Human Spot-Check Protocol
Run the spot-checking tool to audit classification quality and agreement rates across top labels:
```bash
npx tsx scripts/spot-check.ts
```
- **Sampling:** Audit 5 random reviews per top theme, top barrier, and top segment.
- **Agreement Target:** Target $\ge 80\%$ agreement per field.
- **Action on Low Agreement:** If agreement falls below 70% for a specific label, log the mismatch as taxonomy feedback and update detection signals in `lib/taxonomy.ts` for the next cycle.

---

### Step 5: Stability Baseline Verification
Run the cross-run stability harness to confirm label variance remains within acceptable noise bounds:
```bash
npx tsx scripts/stability.ts
```
Confirm that theme and barrier deltas between identical passes do not swing by more than 3 percentage points.

---

### Step 6: Deck & Portable Report Export
After the run is persisted:
1. Open the run dashboard at `/runs/{id}`.
2. Click **Export PM Research Report (MD / JSON / PDF)**.
3. Review the **Actionable Findings Slide Deck** view (`components/Slides.tsx`) for presentation to leadership.
4. Export the formula-injection-safe CSV for record-keeping in Google Sheets / Excel.

---

### Step 7: Drift Alarm & Rolling Baseline Registration
Inspect the observability log outputs for drift alarms:
- **Curation Keep-Rate Alarm:** Fires if curation keep-rate falls below 5% (signals collector HTML/API markup drift or noise surge).
- **Mean Confidence Alarm:** Fires if mean classification confidence falls below 75% (signals model/prompt drift).

Record the run ID, total reviews, readiness score, and keep-rate in the monthly tracking log.
