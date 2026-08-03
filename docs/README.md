# ReviewLens — AI-Powered Category Discovery Engine for Blinkit

> Turns messy, unstructured public review chatter into **auditable, evidence-backed product research** — at corpus scale, with every number traceable to a quote.

Built for the Blinkit Growth Team to answer one question with evidence instead of intuition:
**why do quick-commerce customers keep buying the same categories, and what would make them try a new one?**

| Document | Purpose |
|---|---|
| `README.md` (this file) | What the engine does, why each decision was made, how to use it |
| [`architecture.md`](architecture.md) | How it is built — components, contracts, control flow, invariants |
| [`implementation-plan.md`](implementation-plan.md) | In what order to build it — work breakdown, acceptance criteria, estimates |
| [`edge-cases.md`](edge-cases.md) | What goes wrong, phase by phase — and the required behaviour when it does |
| [`eval.md`](eval.md) | How quality is measured — gold set, metrics, thresholds, gates |

> **Shipped vs. specified.** These documents describe the engine as it is being built for Blinkit. Most of what follows exists in the reference implementation. A small set of behaviours are **hardening we specify but the reference build does not yet have** — they are listed explicitly in [§23](#23-shipped-vs-specified) so nobody mistakes a requirement for a feature.

---

## Table of contents

1. [Why this exists](#1-why-this-exists)
2. [What the engine does](#2-what-the-engine-does)
3. [Design principles](#3-design-principles-read-this-first)
4. [Architecture](#4-architecture)
5. [Data sources & collectors](#5-data-sources--collectors)
6. [Stage 1 — Ingest](#stage-1--ingest)
7. [Stage 2 — Preprocess & Curate](#stage-2--preprocess--curate)
8. [Stage 3 — Classify](#stage-3--classify)
9. [The closed taxonomy](#9-the-closed-taxonomy)
10. [Stage 4 — Aggregate](#stage-4--aggregate)
11. [Stage 5 — Research findings](#stage-5--research-findings)
12. [Stage 6 — Executive synthesis](#stage-6--executive-synthesis)
13. [Stage 7 — Persist & explore](#stage-7--persist--explore)
14. [API reference](#14-api-reference)
15. [Data model](#15-data-model)
16. [Insight quality & validation](#16-insight-quality--validation)
17. [Configuration](#17-configuration)
18. [Running locally](#18-running-locally)
19. [Cost, throughput & capacity planning](#19-cost-throughput--capacity-planning)
20. [Retargeting the engine to another domain](#20-retargeting-the-engine-to-another-domain)
21. [Repository layout](#21-repository-layout)
22. [Limitations, failure modes & ethics](#22-limitations-failure-modes--ethics)
23. [Shipped vs. specified](#23-shipped-vs-specified)
24. [Appendix A — Pilot validation run](#appendix-a--pilot-validation-run)
25. [Appendix B — Glossary](#appendix-b--glossary)

---

## 1. Why this exists

Quick commerce has won the habit. That is exactly the problem.

Blinkit customers have folded 10-minute delivery into their weekly routine — and in doing so, most of them have converged on a **fixed basket**. Milk, bread, eggs, atta, onions, a snack, a beverage. Ordered again. And again. The platform stocks pet supplies, baby care, personal care, home essentials, electronics accessories, and cosmetics; the average customer behaves as though it stocks groceries.

The strategic goal is precise:

> **Increase the percentage of Monthly Active Customers who purchase from at least one *new* category every month.**

Examples of the behaviour change we want:
- A user who buys groceries starts buying **pet supplies**.
- A user who buys snacks starts buying **personal care**.
- A user who buys household essentials starts buying **baby products**.

**Analytics cannot answer why this doesn't happen on its own.** Event data tells you *that* 78% of a user's orders come from three categories. It does not tell you whether the user doesn't know the category exists, doesn't trust Blinkit for it, can't find it, was never prompted at the right moment, or tried once and got a bad tomato.

That evidence *does* exist. It is sitting in Play Store reviews, App Store reviews, Reddit threads, consumer forums, and social posts — written by real customers, unprompted, at a scale no user-research panel can match. It is also unstructured, contradictory, and buried under complaints about delivery charges, app crashes, and surge pricing.

**ReviewLens is the research instrument that closes that gap.** It ingests public review corpora at scale, strips the noise, classifies every surviving review against a closed product taxonomy, aggregates full-corpus frequencies, and synthesizes mechanism-level findings that a director can act on — with each claim expandable into the exact reviews that produced it.

> **Provenance note.** The pipeline was first built and validated end-to-end on a music-discovery corpus (Spotify), because that domain has the same structural shape — habit loops, algorithmic discovery surfaces, repeat consumption — and enough public discussion volume to stress the whole funnel. That validation run is documented in [Appendix A](#appendix-a--pilot-validation-run). Everything else in this README describes the **Blinkit configuration**; the engine itself is domain-agnostic by design ([§20](#20-retargeting-the-engine-to-another-domain)).

### The research questions the engine is built to answer

| # | Question ID | Research question |
|---|---|---|
| 1 | `why_exploration_fails` | What prevents users from exploring new categories? |
| 2 | `top_frustrations` | What frustrations emerge repeatedly? |
| 3 | `shopping_behaviors` | How do users discover products today? |
| 4 | `repeat_purchase_causes` | Why do users repeatedly buy from the same categories? What role do habits play? |
| 5 | `segment_challenges` | Which user segments are more likely to experiment? |
| 6 | `unmet_needs` | What information do users need before trying a new category? What unmet needs emerge consistently? |

These six IDs are first-class constants in the codebase (`RESEARCH_QUESTION_IDS`). Every classified review is mapped to the questions it can answer, every aggregate rolls up to a question, and every finding on the dashboard is addressed to exactly one of them. **The taxonomy is derived from the research questions — not the other way around.** That is what keeps the output research and not a word cloud.

### Coverage of the eight brief questions

The brief poses eight questions; the engine implements six IDs, because two pairs are the same question asked from different angles and must share a denominator to be countable.

| # | Brief question | Question ID | Where it is answered |
|---|---|---|---|
| 1 | Why do users repeatedly buy from the same categories? | `repeat_purchase_causes` | Root-cause diagnosis — mechanism + product implication per cause |
| 2 | What prevents users from exploring new categories? | `why_exploration_fails` | Ranked, severity-graded barrier list |
| 3 | How do users discover products today? | `shopping_behaviors` | Behaviour distribution + narrative per behaviour |
| 4 | What role do habits play in shopping behavior? | `repeat_purchase_causes` | Same denominator as #1 — habit *is* the repeat-purchase mechanism, and splitting them would halve the evidence for both |
| 5 | What information do users need before trying a new category? | `unmet_needs` | Unmet-need distribution → mapped interventions |
| 6 | What frustrations emerge repeatedly? | `top_frustrations` | Theme distribution + emotional tone |
| 7 | Which user segments are more likely to experiment? | `segment_challenges` | Segment × theme cross-tab |
| 8 | What unmet needs emerge consistently across discussions? | `unmet_needs` | Same denominator as #5 — "information needed" is a subset of unmet needs, reported together |

Questions 4 and 8 are deliberately **not** separate IDs. A review saying *"I just hit reorder every week"* answers #1 and #4 simultaneously; giving them separate fields would force the classifier to split one signal across two labels and halve the evidence behind both.

---

### How the brief's four demonstrables are satisfied

| Demonstrable | Where it is shown |
|---|---|
| **How the workflow gathers and analyzes data** | [§4 Architecture](#4-architecture) — the seven-stage pipeline · [§5 Sources](#5-data-sources--collectors) — seven collectors and their biases · [Stages 1–3](#stage-1--ingest) — ingest, curate, classify, with the two-filter funnel and the cost model |
| **How themes are identified** | [§3.2](#32-a-closed-taxonomy-never-free-form-tagging) — why the taxonomy is closed · [§9](#9-the-closed-taxonomy) — every enum with meaning strings, detection signals, and fallbacks · [Stage 3.2](#32-prompt-construction) — how the prompt is generated from those arrays |
| **How insights are generated** | [Stage 4](#stage-4--aggregate) — deterministic frequencies and cross-tabs · [Stage 5](#stage-5--research-findings) — the narrative grammar · [Stage 6](#stage-6--executive-synthesis) — domain routing, mechanism clustering, severity, opportunity scoring, validation gate |
| **How insight quality was validated** | [§16](#16-insight-quality--validation) — eight layered mechanisms: five automated (structural guarantees, confidence, source diversity, evidence strength, readiness score) and three procedural (opportunity gate, cross-run stability, human spot-check with per-field agreement thresholds) |

---

## 2. What the engine does

```
Public review chatter  →  ReviewLens  →  Director-ready research
─────────────────────     ──────────     ────────────────────────
App Store reviews                        6 answered research questions
Play Store reviews                       Ranked exploration-barrier list
Reddit discussions                       Theme / segment cross-tabs
Community forums                         Mechanism-level root causes
Social media conversations               Category trust + mention map
Product reviews                          Scored product opportunities
Quick-commerce discussions               Evidence-linked quote clusters
CSV uploads                              Executive summary + slide deck
                                         7 exports: PDF / MD / JSON / CSV
```

Concretely, ReviewLens will:

1. **Ingest** reviews via live fetch, CSV/JSON upload, or a saved corpus.
2. **Curate** — normalize, dedupe, categorize noise, and keep only exploration-relevant evidence, while preserving every dropped record for audit.
3. **Classify** each surviving review with an LLM against a **closed taxonomy** (theme, barrier, shopping behavior, emotion, segment, root cause, unmet need) plus a per-field confidence and a free-text `classification_reasons` trace.
4. **Aggregate** full-corpus frequencies, percentages, cross-tabs, source distributions, and confidence-weighted quote clusters — **deterministically, in code, with no LLM involved.**
5. **Answer** the six research questions with narrative findings whose every number comes from step 4.
6. **Synthesize** executive output: mechanism narratives, scored product opportunities, segment differences, actionable slides, and a *director-readiness score* that grades its own output.
7. **Persist** each analysis as an immutable **run** in a Turso/libSQL repository, then let you explore it: filter by source and confidence, drill into any statistic's supporting quotes, search the quote index, chat over the corpus, compare runs month over month, and export.

---

## 3. Design principles (read this first)

These five decisions explain almost every implementation detail below. If you fork this engine, keep them.

### 3.1 Two filters, not one

Noise removal happens **twice**, at different levels of intelligence, because the two filters have different jobs.

| | Filter 1 — keyword prefilter | Filter 2 — PM relevance cleanup |
|---|---|---|
| **Where** | At fetch, inside the collector | After ingest, before classification |
| **How** | Deterministic keyword/regex match | LLM judgment with structured output |
| **Job** | Cut scrape volume ~85–95% cheaply | Remove reviews that *mention* shopping but carry no research signal |
| **Cost** | Free | ~1 cheap LLM pass |
| **Typical yield** | ~5–15% of raw app-store scrape survives | ~25–80% of the remainder survives |

Quick-commerce app stores are dominated by delivery-charge complaints, late-order rants, and one-line praise. The keyword filter is dumb on purpose — it must never be the thing that decides what is *insightful*, only what is *plausibly about shopping behaviour*. The LLM filter decides research relevance. Running the expensive filter on unfiltered scrape output would burn the entire token budget on "delivery boy was rude".

### 3.2 A closed taxonomy, never free-form tagging

The LLM is **never** asked "what themes do you see?" It is handed an explicit allowed-value list per field and instructed:

> Choose **EXACTLY ONE** value per field from the allowed lists below.
> If none fit perfectly, choose the **CLOSEST** valid value. **Never invent labels.**

Open-ended tagging produces 400 near-duplicate themes ("can't find stuff", "hard to find things", "discoverability issues") that cannot be counted, compared across runs, or cross-tabbed. A closed taxonomy makes frequencies **real numbers** and makes two runs **comparable** — which is what turns this from a one-off study into a monthly tracking instrument for the new-category-adoption metric.

### 3.3 Deterministic math, generative narrative — strictly separated

- **Every number** on the dashboard (counts, percentages, cross-tabs, distributions, opportunity scores, readiness score) is computed in TypeScript from the classified rows. No LLM produces a statistic.
- **Every narrative** (mechanism explanations, executive summary, opportunity text) is templated from taxonomy labels or LLM-synthesized *from the already-computed aggregates*.

The LLM never sees a blank page and never invents a count. This is why the output survives a director asking "where does 32% come from?"

### 3.4 Everything is traceable to a quote

Every theme, barrier, root cause, unmet need, opportunity, and slide carries a `representative_quotes[]` array of real review excerpts with `review_id`, `source`, `segment`, and `confidence`. The UI exposes "View evidence breakdown" / "Read full review" on every card. A finding with no quote cannot be rendered.

### 3.5 The system grades its own output

The engine ships explicit quality gates: opportunity validators that reject generic recommendations, an evidence-strength classifier, and a **director-readiness score** that reports its own gaps ("Fewer than 3 executive findings; Insufficient mechanism-level findings"). A run that produces weak research says so on the dashboard rather than dressing it up. See [Section 16](#16-insight-quality--validation).

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  1. INGEST                                                      │
│     Live fetch │ CSV/JSON upload │ Saved corpus                 │
│     Keyword prefilter · dedupe · normalize                      │
│     → RawReview[] { source, text, ...metadata }                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. PREPROCESS & CURATE   POST /api/curate-reviews              │
│     Normalize → categorize noise → exploration relevance        │
│     → outcome + user_goal + metadata                            │
│     included[] = exploration_relevant                           │
│     records[]  = all unique reviews (audit trail)               │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. CLASSIFY   POST /api/classify   (batched, throttled)        │
│     Research relevance → question mapping → evidence            │
│     → user goal → closed-taxonomy tags → confidence             │
│     → ClassifiedReview[]                        [cached]        │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. AGGREGATE   POST /api/aggregate                             │
│     Frequencies · percentages · cross-tabs · quote clusters     │
│     (exploration-relevant only — deterministic, no LLM)         │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. FINDINGS   POST /api/findings                               │
│     Six research answers + evidence-backed quotes               │
│     + executive synthesis (mechanisms, opportunities, slides)   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. PERSIST   POST /api/runs → Turso/libSQL                     │
│     Redirect to /runs/{id}                                      │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. EXPLORE                                                     │
│     Dashboard │ Quotes │ Chat │ Repository │ Compare │ Export   │
└─────────────────────────────────────────────────────────────────┘
```

**Stack**

| Layer | Choice | Notes |
|---|---|---|
| App framework | Next.js (App Router) on Vercel | Route handlers under `/api/*`; client orchestrates the pipeline so long runs survive serverless timeouts |
| UI | React + Tailwind, Material Symbols icon set | Material 3 token naming; print stylesheet drives the PDF export |
| LLM | Groq Llama — `llama-3.3-70b-versatile` (mandatory) | Groq API (`https://api.groq.com/openai/v1/chat/completions`) |
| Persistence | Turso / libSQL | Runs, classified rows, aggregates, findings, curation stats |
| Classification cache | Content-hash keyed store (`/api/classify/cache`) | Re-analysis of a saved corpus skips already-classified reviews entirely |

**Why the client orchestrates the pipeline.** Classification of a 500-review corpus takes tens of minutes once rate-limit throttling is applied — far beyond any serverless function timeout. So the browser drives the loop: it batches reviews, calls `/api/classify` per batch, applies backoff, renders live progress, and can resume from cache after an interruption. Each API route stays short-lived and stateless.

---

## 5. Data sources & collectors

Blinkit customer discussion is spread across seven public surfaces, each with a different bias. The engine ships one collector per surface plus file upload.

| Source ID | Label | What it collects | Signal characteristics |
|---|---|---|---|
| `appstore` | App Store | Apple App Store reviews (IN storefront primary) | Lower volume, longer and denser |
| `playstore` | Play Store | Google Play reviews for the Blinkit app | Highest volume, shortest text, most noise |
| `reddit` | Reddit | Posts **and** comments from Indian city/consumer subreddits | Highest-value: reasoning, comparison, mechanism speculation |
| `forums` | Community forums | Consumer complaint portals, community threads, Q&A | Structured, specific, often category-named |
| `social` | Social media | X/Twitter and public social posts | Unprompted, opinionated, noisiest |
| `product_reviews` | Product reviews | **SKU-level** reviews on platform PDPs and marketplace listings for the same products | The only source that speaks about a *category* directly |
| `quickcommerce` | Quick-commerce discussions | Category-level discourse: industry threads, comparison-article comments, newsletter and video comment sections | Cross-platform mental models; where switching is discussed |

### 5.1 Collector characteristics

**Play Store.** The volume source. Reviews are short, star-driven, and dominated by delivery charges, surge pricing, late orders, and app bugs. Supports `sort` (newest / highest rating / most helpful), region, and minimum-star filters. Expect **~5–15%** of a raw scrape to survive the keyword prefilter — and of the survivors, many are still "I only order groceries" one-liners, which Filter 2 will *keep*, because that single sentence **is** the habit-lock-in signal.

**App Store.** Apple exposes far less through public endpoints, so the collector reads **server-side-rendered review pages** and merges across storefronts where relevant. Lower volume than Play Store, but reviews run longer and carry more explicit reasoning about what the user does and doesn't buy.

**Reddit.** The highest-value source by a wide margin. City subreddits (`r/india`, `r/bangalore`, `r/mumbai`, `r/delhi`, `r/hyderabad`, `r/pune`) and personal-finance/consumer subreddits carry multi-paragraph threads comparing Blinkit against Zepto and Instamart, arguing about whether the platform is trustworthy for non-grocery categories, and describing shopping routines in detail. This is where mechanism-level evidence lives — *"I only ever open it when I need something specific, so I never see anything else"* is a root cause stated in the user's own words.

**Consumer & community forums.** Structured and specific. Frequently name a category and a failure ("ordered dog food, got a near-expiry pack"), which makes them disproportionately useful for the **trust and quality** domains. Prone to template boilerplate that the curation stage strips.

**Social media.** Unprompted, unmoderated opinion with no store-review incentive distortion and no support-ticket framing. Highest rate of spontaneous category commentary ("didn't even know Blinkit sells makeup"), and the highest noise rate.

**Product reviews.** SKU-level reviews on the platforms' own product pages and on marketplace listings for the same items. **Structurally different from every other source: this is the only place users talk about a specific product in a specific category**, rather than about the app. It is therefore the densest evidence for `Quality Uncertainty`, `Information Gap Blocks Trust`, and the category trust map — a customer describing a near-expiry pack of dog food is giving you the pet-supplies trust barrier in one sentence. Lower volume per category, so collect breadth-first across categories rather than depth-first on bestsellers.

**Quick-commerce discussions.** Category-level discourse rather than platform-level: industry threads, comparison-article comment sections, newsletter and video comments. Users here reason about the *sector* — when 10-minute delivery is worth it, what they will and won't order this way, how they split baskets across apps. This is where switching behaviour and cross-platform mental models surface, which makes it disproportionately useful for the trust and habit domains.

### 5.2 Source diversity is a quality requirement, not a nice-to-have

Evidence strength is scored on **distinct source count**, not just review count ([16.4](#164-evidence-strength)). A finding backed by 40 Play Store reviews is graded *Weak*; the same finding backed by 20 reviews across Reddit + forums + social is graded *Strong*.

This is deliberate, and it matters more in quick commerce than almost anywhere else. App stores over-represent angry users with a delivery grievance. Reddit over-represents metro power users running three apps. Forums over-represent people with a specific unresolved complaint. Social over-represents the loud. **Only the intersection is trustworthy** — a "finding" visible in only one of these is usually an artifact of that surface's bias, not a fact about Blinkit customers.

### 5.3 Collector implementation notes

- **Rate limiting & politeness** — per-source concurrency caps and inter-request delays; identify the client honestly in `User-Agent`.
- **Pagination** — collectors page until the requested `amount` is met *post-filter*, with a hard page ceiling to prevent runaway scraping.
- **Deduplication** — normalized-text hashing across sources; the same complaint cross-posted to Reddit and a forum counts once.
- **Normalization** — every collector emits the same `RawReview` shape, so downstream stages are source-agnostic.
- **Failure isolation** — one dead collector degrades the run (fewer sources, lower evidence strength) rather than failing it.
- **Language** — Indian review corpora are heavily code-mixed (Hinglish, Romanized Hindi/Tamil/Telugu). See [§22](#22-limitations-failure-modes--ethics) — this is the single most important known limitation for this domain.
- **Terms of service** — collectors read *public* pages only, at low rates, and store only what is needed for research.

---

## Stage 1 — Ingest

**Endpoint:** `POST /api/fetch-reviews` · **Alternative:** file upload (≤ 25 MB, headers parsed automatically) · **Alternative:** `GET /api/corpus` for saved datasets.

> **Upload formats.** The file picker accepts **`.csv`**. The parser also handles JSON, but JSON is not currently exposed in the picker — resolve this before documenting JSON upload to users. Tracked as [`edge-cases.md` EC-P1-12](edge-cases.md).

### Fetch parameters

| Parameter | Values | Notes |
|---|---|---|
| `sources[]` | `appstore`, `playstore`, `reddit`, `forums`, `social`, `product_reviews`, `quickcommerce` | Max 7; multi-select |
| `amount` | 10 – 1000 per source | **Raw scrape volume, pre-filter** |
| `region` | All India, Delhi NCR, Mumbai, Bengaluru, Hyderabad, Pune, Kolkata | City signal is inferred from review text and subreddit for non-store sources |
| `sort` | Newest / Highest rating / Most helpful | Play Store |
| `minRating` | Any, 1+, 2+, 3+, 4+, 5★ | Store collectors only |

### The exploration keyword prefilter (Filter 1)

Applied inside the collector, immediately after scrape, before anything is returned. A review is kept if it mentions a category-exploration signal:

```
only order · only buy · same items · every week · reorder · buy again
never tried · didn't know · never knew · never seen · couldn't find
category · aisle · section · browse · search · home page · homepage
variety · assortment · range · options · selection
pet · dog · cat · baby · diaper · personal care · skincare · makeup
cosmetics · household · cleaning · stationery · electronics · pharmacy
quality · fresh · expiry · expired · trust · recommend · suggestion
out of stock · price · cheaper · compare · zepto · instamart · bigbasket
```

Generic delivery complaints ("late again", "delivery charge is robbery") and one-line praise are dropped here. This is the single biggest cost lever in the system: it typically removes **85–95%** of an app-store scrape for free.

> **Sizing guidance:** fetch or upload **150–500 reviews total**. Cleanup usually keeps **25–200 exploration-relevant reviews**. Too few leaves nothing to analyze; too many burns the LLM budget (~400 tokens per *kept* review at curation, ~2,400 tokens per review end-to-end).

**Design note on competitor mentions.** `zepto`, `instamart`, `bigbasket` are in the prefilter deliberately. Comparison reviews are among the richest evidence in this corpus — a user explaining why they buy groceries on Blinkit but pet food elsewhere is describing a category-level trust gap more precisely than any survey question would extract.

### Output

```ts
type RawReview = {
  source: 'appstore' | 'playstore' | 'reddit' | 'forums' | 'social'
        | 'product_reviews' | 'quickcommerce' | string
  text: string
  // optional, source-dependent:
  review_id?: string
  rating?: number
  date?: string
  city?: string
  url?: string
  author_hash?: string   // hashed, never raw usernames
}
```

---

## Stage 2 — Preprocess & Curate

**Endpoint:** `POST /api/curate-reviews`

This is the **PM relevance cleanup** — Filter 2. Its job is to answer one question per review: *would a product manager researching category exploration consider this review evidence?*

### What happens

1. **Normalize** — whitespace collapse, boilerplate stripping (forum templates, order-ID blocks, signature lines), emoji/markup handling, truncation of pathological lengths.
2. **Deduplicate** — exact and near-duplicate detection across sources.
3. **Drop below the length floor** — `too_short`. A deterministic character/token minimum applied *before* the LLM sees anything. "Good app 👍" cannot carry exploration evidence at any length of reasoning, and paying an LLM call to establish that is pure waste. This is typically the second-largest exclusion bucket.
4. **Categorize noise** — reviews that fail relevance are labeled with *why* rather than silently dropped: `not_exploration_related`, `too_short`, `generic_praise`, `delivery`, `pricing_fees`, `app_bug`, `payment`, `customer_support`, `off_topic`.
5. **Judge exploration relevance** — `exploration_relevant: boolean`.
6. **Extract lightweight context** — `outcome` (did a category trial succeed or fail?) and `user_goal` (what were they trying to buy or do?).

**The judgment call that defines this stage.** A review saying *"delivery is fast, I order groceries every week"* is not a delivery complaint — it is a habit-lock-in data point, and it must be kept. A review saying *"delivery was late and the app crashed"* has no exploration signal and must go. The distinction is not keyword-detectable, which is exactly why Filter 2 is an LLM and Filter 1 is not.

### Output contract

```ts
type CurationResult = {
  included: CuratedReview[]   // exploration_relevant === true → proceed to classification
  records:  CuratedReview[]   // EVERY unique review, including excluded ones → audit trail
  stats: {
    total: number
    unique: number
    duplicatesRemoved: number
    included: number
    excluded: number
    excludedByCategory: Record<string, number>
  }
}
```

**`records[]` is the audit trail and it matters.** When a stakeholder asks "did you just cherry-pick the reviews that support your conclusion?", the answer is a table of every review the engine saw and the stated reason each one was excluded. The dashboard header reports both numbers permanently: *"N analyzed · M exploration-related"*.

### The curation review screen

Curation is not a silent internal step — it is a surface the operator must approve before spending any classification budget. It shows:

**The funnel, as one sentence:**

> *2,140 loaded · 6 duplicates removed → 184 exploration-relevant sent to LLM classification · 1,950 excluded before analysis*

**The exclusion breakdown, ranked with counts:**

> *Excluded: Not exploration-related 1,612 · Too short 187 · Generic praise only 88 · Delivery / fees 63*

**A preview table of the reviews that will be analysed** — source badge and truncated text, five at a time, expandable to the full kept set (*"Showing 5 of 184"*).

This screen is where a bad run gets caught for free. An exclusion breakdown dominated by `too_short`, or a preview table full of delivery complaints, tells you the prefilter or the relevance judgment has drifted — *before* you spend 40% of a day's token budget finding out.

### The empty-curation guard

If cleanup leaves zero exploration-relevant reviews, the pipeline halts in a dedicated `curation_empty` state rather than producing an empty dashboard, and surfaces actionable remediation:

> *No category-exploration reviews remained after cleanup.*
> • Try a saved corpus or a source-specific file
> • When live-fetching, include Reddit or forums, and broaden terms toward categories and assortment

---

## Stage 3 — Classify

**Endpoint:** `POST /api/classify` · **Config:** `GET /api/classify/config` · **Cache:** `POST /api/classify/cache`

The heart of the engine. Every curated review is sent to the LLM and returned as a fully-typed row.

### 3.1 What the model produces, per review

| Field | Type | Purpose |
|---|---|---|
| `research_relevant` | boolean | Second-pass relevance check inside classification |
| `research_questions[]` | question IDs | Which of the six questions this review can answer |
| `evidence` | string | The specific span of the review carrying the signal |
| `user_goal` | string | What the user was trying to buy or accomplish |
| `exploration_outcome` | `successful` \| `failed` \| `unclear` | Drives positive/negative routing |
| `theme` | closed enum | Primary theme (positive or negative set) |
| `barrier` | closed enum | Why exploration failed (Q1) |
| `behavior` | closed enum | How the user shops today (Q3) |
| `emotion` | closed enum | Emotional tone (Q2) |
| `segment` | closed enum | Customer segment (Q5) |
| `root_cause` | closed enum | Repeat-purchase mechanism (Q4) |
| `unmet_need` | closed enum | What the user needs before trying a new category (Q6) |
| `mentioned_categories[]` | free text, normalized | Which Blinkit categories the review names |
| `confidence` | 0.0 – 1.0 | Self-reported classification confidence |
| `classification_reasons[]` | string[] | Why these labels — the reasoning trace |

Note the shape: **one field per research question.** The taxonomy is not a generic sentiment schema; it is a direct instrument for the six questions.

`mentioned_categories[]` is the one open field, and it exists for a specific reason: the taxonomy tells you *why* exploration fails, but the PM also needs to know *which categories* customers name when they talk about trying something new. It is normalized against a category list post-hoc, never used as a classification label, and never counted in taxonomy frequencies.

### 3.2 Prompt construction

The prompt is assembled from two generated blocks, so prompt and code can never drift out of sync:

- `formatResearchQuestionsForPrompt()` — emits the six `id: question` lines from `RESEARCH_QUESTION_LABELS`.
- `formatTaxonomyForPrompt()` — emits the allowed-value lists **directly from the same arrays the aggregator validates against**.

Key instruction blocks:

**Scope fence**
```
Research scope: Blinkit category exploration and product discovery ONLY.
Do NOT label delivery speed, delivery charges, surge/handling fees, app crashes,
payment failures, refunds-in-progress, or generic app praise — UNLESS the review
ALSO says something about what the user buys, browses, or won't try.

Choose EXACTLY ONE value per field from the allowed lists below.
If none fit perfectly, choose the CLOSEST valid value. Never invent labels.
```

The "unless" clause is load-bearing. In quick commerce the most valuable reviews are *mixed* — they open with a delivery complaint and then reveal the shopping pattern. A hard exclusion on delivery keywords would discard them.

**Positive/negative separation** — separate lists with an explicit guard, because "the model labels praise as a complaint" is the most common silent failure in review classification:
```
POSITIVE THEMES — successful exploration (use when the user praises finding or trying something new)
NEGATIVE THEMES — exploration friction (never use for praise)
THEME FALLBACK (negative unclear only — NEVER for positive reviews): Other Exploration Frustration
```

**Anti-lazy-label pressure on root cause** — without this, models default to "unclear" for a third of the corpus and the mechanism analysis collapses:
```
Use "Unclear Repeat-Purchase Cause" in fewer than 5% of research reviews — only when
no repeat-purchase or discovery mechanism is inferable at all.

MANDATORY: Every repeat-purchase-related review (Basket Habit Lock-In, Reorder Tunnel
Vision, Search-Only Shopping, or clear "I only buy X" signals) MUST receive a root cause.
If confidence is below 70%, assign the closest mechanism and note low confidence in
classification_reasons — never default to Unclear.
```

**Detection signals per mechanism** — each root cause ships with the surface phrases that indicate it, which converts an abstract label into a matchable pattern:
```
1. Reorder-Surface Dominance — "Buy again"/reorder rails occupy the primary surface,
   so the user never encounters other categories.
   Signals: "just reorder", "same cart every time", "one tap and done", "never scroll past".
2. Search-First Interaction Loop — The user only uses search, so they can only find
   what they already intended to buy.
   Signals: "I search for what I need", "type it in", "never browse", "straight to search".
3. Recommendation Similarity Reinforcement — Recommendations mirror the existing basket.
   Signals: "shows me the same things", "always suggests milk", "recommendations are useless".
4. Information Gap Blocks Trust — Trust requires information the app doesn't show.
   Signals: "can't tell if it's fresh", "no expiry date", "don't know the brand",
   "wouldn't risk it", "no reviews on the product".
5. No Low-Risk Trial Mechanism — First purchase in a new category feels too risky.
   Signals: "not worth trying", "what if it's bad", "can't return", "only sells big packs".
6. Buried Category Entry Points — Category tiles sit below the fold or behind menus.
   Signals: "didn't know they had", "never seen that section", "had to dig", "hidden".
7. Basket-Completion Optimization Bias — Ranking optimizes for fast basket completion.
   Signals: "only shows popular stuff", "same top items", "no variety on the home page".
8. Promo-Led Ranking Bias — Discount merchandising crowds out category introduction.
   Signals: "only offers", "all discounts, no new stuff", "banner spam".
9. Delivery-Speed Framing — The 10-minute promise frames the app as an errand tool.
   Signals: "only for emergencies", "when I run out", "quick top-up", "not for shopping".
```

**Segment tie-breaking** — ambiguity rules are specified so the model does not silently over-use the unknown bucket:
```
Choose ONE primary segment (1–5) using behavioral evidence. Copy label exactly.
If segments 1–5 are ambiguous but the review describes a shopping pattern,
default to "Habitual Replenisher".
Use "Unspecified Segment" ONLY when the review contains zero behavioral signals
about what or how the user buys.
```

**Unmet-need specificity pressure**
```
Prefer specific needs. Use General Discovery Improvement only as last resort.
```

### 3.3 Non-research fallback

If a review slips past curation but the model judges it non-research, it is stamped with a fixed fallback row rather than being force-fit into a real label:

```ts
NON_RESEARCH_FALLBACK = {
  theme:       'Other Exploration Frustration',
  barrier:     'Unclear Exploration Struggle',
  behavior:    'Search for a Known Item',
  emotion:     'Neutral',
  segment:     'Unspecified Segment',
  root_cause:  'Unclear Repeat-Purchase Cause',
  unmet_need:  'General Discovery Improvement',
}
```

These five labels are registered as `OTHER_UNKNOWN_LABELS` and are **excluded from "top N" rollups** downstream — so "Unclear" can never win a ranking and masquerade as an insight.

### 3.4 Batching, throttling & token math

Classification is the rate-limited, expensive stage. The engine models its own cost before spending anything.

**Provider limits (built-in defaults)**

| Provider | RPM | RPD | TPM | TPD |
|---|---|---|---|---|
| `groq` (mandatory) | 30 | 14,400 | 30,000 | 500,000 |

**Batch sizing**
```
batchSize = min(10, floor((LLM_MAX_OUTPUT_TOKENS - 1000) / 1050))
// default LLM_MAX_OUTPUT_TOKENS = 16384 → floor(15384/1050) = 14 → capped at 10
// override: LLM_CLASSIFY_BATCH_SIZE (hard-capped by the output-token headroom)
```

**Token estimation**
```
estimatedInputTokens  = batches × (1800 + 400  × batchSize)
estimatedOutputTokens = batches × (1000 + 1050 × batchSize)
```

**Throttle**
```
requestCooldownMs = ceil(60000 / RPM) + 500               // Groq Llama default
batchDelayMs      = max( ceil((inTok + outTok) / TPM × 60000),
                         requestCooldownMs,
                         2000 )
```

Live values (`GET /api/classify/config`, batchSize 3):

```json
{
  "provider": "Groq Llama",
  "model": "llama-3.3-70b-versatile",
  "limits": { "requestsPerMinute": 30, "requestsPerDay": 14400,
              "tokensPerMinute": 30000, "tokensPerDay": 500000 },
  "batchSize": 3,
  "batchDelayMs": 2500,
  "sampleEstimate": {
    "reviewCount": 100, "batches": 34,
    "estimatedTokens": 243100, "tokensPerReview": 2431,
    "estimatedMinutes": 3, "maxReviewsPerDay": 417,
    "dailyTokenBudgetPct": 48.6
  }
}
```

### 3.5 The pre-flight panel

Nothing is spent until the operator has seen what it will cost. Immediately below the curation review screen sits the estimate panel:

```
⚡  Groq Llama classification estimate          Model: llama-3.3-70b-versatile

    THIS RUN                                PROVIDER LIMITS
    184 reviews · ~62 requests · batch 3     30 RPM · 14,400 RPD
    ~443,900 tokens (~2,412/review)          30,000 TPM · 500,000 TPD
    input ~186,000 · output ~257,900

    This run ≈ 88.8% of daily token budget

    Live LLM run: ~62 requests, ~3 min (~2,412 tokens/review, throttled for 30,000 TPM).
```

If the estimate exceeds the daily quota the panel **blocks the run** and offers three ways out: split into repository batches, reduce review count, or run in mock mode.

### 3.6 Analysis options

Three actions, always visible, because the right one depends on remaining quota:

| Action | When to use |
|---|---|
| **Analyze & Save to Repository** | Normal path — classify now, persist, open the dashboard |
| **Save for later** | Quota is tight. Persists the *curated* corpus as a queued run; classify when quota resets |
| **Build dashboard from cache (N)** | A previous run was interrupted, or this corpus is being re-analysed. Skips the API entirely for anything already classified |

The panel states the cache position explicitly before you choose — *"184 of 184 reviews already classified in cache"* — which is what makes re-analysis after an aggregation or synthesis change effectively free.

### 3.7 Resilience

**Retry classifier.** Up to 4 attempts per batch, with the failure taxonomy split into *recoverable* and *fatal*:

| Recoverable → retry with backoff | Fatal → stop and report |
|---|---|
| HTTP 429, 500, 503, 504 | Daily quota exhausted (`per day`, `daily`, `TPD`, `RPD`) |
| `rate limit`, `too many requests`, `resource exhausted` | `billing`, `insufficient`, `credits` |
| Per-minute/per-hour limits (`TPM`, `RPM`, `TPH`, `RPH`) | Auth failures |

Retrying a per-minute limit is correct; retrying a per-day limit just burns 4× the time to fail identically.

**`LlmOutputTruncatedError`.** If the model's JSON is cut off mid-object, the batch is retried with a smaller batch size rather than being parsed leniently. Salvaging truncated JSON silently corrupts the corpus.

**Classification cache.** Every classified review is cached by content hash. Re-running a saved corpus skips the API for anything already classified. This makes iteration on the aggregation/synthesis layers effectively free.

**Partial dashboards.** If a run is interrupted mid-classification, you can proceed from cache — provided **at least 10** classified reviews exist. Below that threshold the engine refuses.

**Batch splitting.** For corpora too large for one day's quota, the engine computes 2–5 way splits, shows the per-part estimates, and persists each part as its own queued run (`/api/runs/queue`).

**Mock mode.** `mockEnabled: true` runs the entire pipeline with synthetic classifications — no API calls, no quota. Essential for UI work and for demoing without a key.

---

## 9. The closed taxonomy

This is the contract between the LLM, the aggregator, and the dashboard. All arrays live in one module and are consumed by both the prompt builder and the validators.

### 9.1 Themes — positive (5)

Used **only** when the user describes exploration working. `isPositiveTheme()` routes these away from barrier/root-cause analysis entirely.

| Theme | Meaning |
|---|---|
| Successful Category Trial | the user tried an unfamiliar category and the purchase met expectations |
| Strong Cross-Category Discovery | home feed, search, or recommendations successfully introduced a category the user hadn't bought |
| Assortment Delight | the user was surprised by the breadth of catalog available |
| Reliable First-Time Purchase | a first order in a new category arrived at expected quality and built confidence |
| Useful Bundling | occasion or use-case bundles pulled the user into a multi-category basket |

### 9.2 Themes — negative (11 + 1 fallback)

| Theme | Meaning |
|---|---|
| Basket Habit Lock-In | users reorder a fixed basket and never encounter other categories |
| Poor Category Discoverability | categories exist on the platform but users never see them in their journey |
| Search-Only Shopping | users interact only through search, so they can only find what they already intended to buy |
| Irrelevant Recommendations | recommended items mirror the existing basket instead of expanding it |
| Trust Gap on Non-Grocery | users doubt the platform for pet, baby, personal care, or electronics categories |
| Quality Uncertainty | fresh and perishable quality is unknowable before purchase, so users don't risk it |
| Price Comparison Friction | users leave to compare prices elsewhere and complete the basket on another app |
| Assortment Blind Spots | users are unaware the platform stocks a category at all |
| Reorder Tunnel Vision | reorder and "buy again" shortcuts dominate the interface and bypass discovery |
| Category Navigation Overload | aisle structure and information architecture defeat browsing |
| Promo Noise | discount and offer clutter drowns out category signals |
| *Other Exploration Frustration* (fallback) | exploration pain points remain diffuse without a clear product surface to address |

### 9.3 Barriers — Q1 (8)

Rendered on the dashboard as a **ranked, severity-graded friction list**.

| Barrier | Meaning |
|---|---|
| Low Category Awareness | users do not know the category is available on the platform |
| No Trigger to Explore | nothing in the shopping journey prompts a visit to an unfamiliar category |
| Trust Deficit on New Category | users do not yet trust the platform to deliver this category well |
| Price or Quality Uncertainty | users lack the information needed to risk a first purchase |
| Reorder Shortcut Dominance | the fastest path through the app bypasses discovery entirely |
| Buried Category Entry Points | category tiles and aisles sit below the fold or behind secondary menus |
| Cold Start for New Users | new or low-tenure users cannot escape a generic home feed quickly enough |
| *Unclear Exploration Struggle* | users express exploration frustration without naming a specific product failure mode |

### 9.4 Shopping behaviors — Q3 (7)

| Behavior | Narrative used on the dashboard |
|---|---|
| Reorder Previous Basket | Users rebuild the same basket each week, which makes the reorder surface the single highest-leverage place to introduce a new category |
| Search for a Known Item | Users arrive with intent and type it in — discovery never enters the session unless search results carry it |
| Browse Category Aisles | Users who browse are the platform's most exploratory cohort, but report that aisle structure works against them |
| Respond to Home-Feed Recommendations | Users treat the home feed as the platform's suggestion surface and judge assortment by what appears there |
| Shop a Use-Case or Occasion | Users shopping an occasion naturally cross categories — the strongest existing bridge into unfamiliar aisles |
| Compare Prices Across Apps | Users price-check against competing apps mid-basket, and often complete the order wherever the comparison lands |
| Impulse Add-On at Checkout | Users accept last-moment additions when they are cheap and contextually relevant, making checkout a low-risk trial surface |

### 9.5 Emotions — Q2 (6)

`Frustration` · `Disappointment` · `Distrust` · `Hesitation` · `Curiosity` · `Neutral`

`Hesitation` replaces the generic "boredom" you would use in a media domain. In commerce the emotion that blocks a first purchase is not boredom — it is *hesitation at the point of risk*, and it is worth being able to count separately.

### 9.6 Segments — Q5 (5 + unspecified)

| Segment | Definition given to the model | UI summary |
|---|---|---|
| Habitual Replenisher | Orders a near-identical staples basket on a regular cadence; treats the app as restocking infrastructure | Fixed weekly basket; the core repeat-purchase cohort |
| Occasion Shopper | Orders around events, guests, festivals, or specific needs; basket composition varies widely | Event-driven; naturally crosses categories |
| Deal Seeker | Price-led; compares across apps; responds to offers and thresholds | Price-first; cross-app comparer |
| Household Manager | Buys for multiple people including children, pets, or elders; broadest natural category need | Multi-person basket; widest latent demand |
| New or Low-Tenure User | Recently onboarded; habits not yet formed; still evaluating the platform | Habits still forming; most malleable |
| *Unspecified Segment* | Zero behavioral signals present | No shopping-behavior signals in the review |

**Why these five.** They are separable from review text alone (no account data required), and they differ meaningfully in *experimentation propensity* — which is precisely what research question 5 asks. Household Managers and Occasion Shoppers carry the widest latent cross-category demand; Habitual Replenishers are the largest and most locked-in; New Users are the cheapest to influence because no habit has hardened yet.

### 9.7 Root causes — Q4 (10)

Each root cause carries a **mechanism** (why it happens) and a **product implication** (what to build). This pairing is what elevates the output from "users are annoyed" to "here is the system behavior to change".

| Root cause | Mechanism | Product implication |
|---|---|---|
| Reorder-Surface Dominance | "Buy again" and past-order rails occupy the primary surface, so a returning user completes a basket without ever encountering an unfamiliar category | Reserve guaranteed slots in the reorder flow for one contextually relevant new-category item, measured on trial rate rather than basket value |
| Search-First Interaction Loop | Users interact almost exclusively through search, so the catalog is only as discoverable as the user's existing vocabulary | Introduce category bridges in search results and zero-result states; surface adjacent aisles on every query |
| Recommendation Similarity Reinforcement | The recommender is trained on basket history, so it converges on the categories the user already buys and shrinks the exposure set over time | Add explicit new-category exposure targets to ranking, decoupled from basket-similarity scoring |
| Buried Category Entry Points | Category tiles sit below the fold or behind secondary navigation, so users never encounter them at browsing speed | Rebuild home-feed information architecture around rotating category entry points with placement guarantees |
| Information Gap Blocks Trust | Users will not risk a first purchase in an unfamiliar category without sourcing, freshness, expiry, or rating information the app does not display | Ship category-specific trust panels — expiry windows, sourcing, brand context, and product ratings on every non-grocery PDP |
| No Low-Risk Trial Mechanism | The smallest available pack and an unclear returns path make a first purchase feel disproportionately risky | Introduce trial packs, sample sizes, and a visible first-purchase guarantee for new-to-user categories |
| Basket-Completion Optimization Bias | Ranking optimizes for fast basket completion and conversion, so it serves high-confidence familiar SKUs rather than introducing anything new | Establish a category-breadth objective separate from conversion rate and optimize the home feed against it |
| Promo-Led Ranking Bias | Discount-driven merchandising occupies the surfaces that would otherwise introduce categories | Cap promotional density on discovery surfaces and reserve inventory for category introduction |
| Delivery-Speed Framing | The 10-minute promise frames the app as an errand tool for known needs, not a destination for browsing | Create a distinct browsing mode with its own entry point and expectations, separate from the express-restock flow |
| *Unclear Repeat-Purchase Cause* | Users perceive their own repetition but cannot attribute it to a product behavior, suggesting several mechanisms compound invisibly | Instrument category-exposure and repeat-basket telemetry so teams can identify which loop dominates per cohort |

### 9.8 Unmet needs — Q6 (9)

Each maps to a concrete product intervention, which becomes the seed of a scored opportunity.

| Unmet need | Mapped intervention |
|---|---|
| Trial-Sized First Purchase | Introduce trial packs and sample sizes priced for a zero-regret first purchase in new-to-user categories |
| Category Explainers and Trust Signals | Add category landing experiences with sourcing, brand, and quality context before the user commits |
| Occasion-Based Bundles | Build occasion and use-case bundles that span categories, using events as the natural cross-category bridge |
| Transparent Quality Information | Display expiry windows, freshness guarantees, and sourcing detail on perishable and non-grocery SKUs |
| Cross-Category Nudges at the Right Moment | Place contextual new-category prompts at cart, checkout, and post-order — the lowest-friction moments in the journey |
| Return and Refund Confidence | Make first-purchase returns visibly effortless for new-to-user categories to remove the downside risk |
| Personalized New-Category Suggestions | Ship category-level personalization with explicit novelty targets, not SKU-level similarity |
| Better Category Navigation | Rebuild aisle information architecture around shopper mental models rather than internal merchandising structure |
| *General Discovery Improvement* | Establish a category-breadth quality metric distinct from conversion and optimize discovery surfaces against it |

### 9.9 The unknown-label registry

```ts
OTHER_UNKNOWN_LABELS = new Set([
  'Other Exploration Frustration',
  'Unclear Exploration Struggle',
  'Unspecified Segment',
  'Unclear Repeat-Purchase Cause',
  'General Discovery Improvement',
])
```

Filtered out of every "top N" computation. Without this, the most common outcome of any corpus is *"the top theme is Unclear"* — technically true, operationally worthless.

---

## Stage 4 — Aggregate

**Endpoint:** `POST /api/aggregate` · **No LLM involved.**

Operates on `classified.filter(r => r.research_relevant !== false && r.exploration_relevant)`.

### Computed outputs

| Output | Description |
|---|---|
| **Distributions** | Count + percentage for every taxonomy field (theme, barrier, behavior, emotion, segment, root cause, unmet need) |
| **Cross-tabs** | `buildCrossTab(reviews, rowField, colField)` — row-normalized percentages, both axes sorted by frequency. Powers *Segment-specific exploration challenges* |
| **Quote clusters** | Per label: top 5 reviews by descending confidence, carrying `review_id`, `source`, `text`, `segment`, `theme`, `confidence`, `barrier`, `root_cause`, `unmet_need` |
| **Category mentions** | Normalized frequency over `mentioned_categories[]` — which categories customers actually name |
| **Source distribution** | Per finding and per label — feeds the evidence-strength grade |
| **Confidence** | `averageConfidence()` over rows, `averageQuoteConfidence()` over a quote set |
| **Top segments** | `buildTopSegments(reviews, 5)` |
| **Counters** | `totalReviews`, `explorationRelevantCount`, `excludedCount` |

### Repeat-purchase scope filtering

Root-cause percentages are reported as *"% of repeat-purchase-related reviews"*, not *% of corpus*. The scope is defined by an explicit signal list plus the positive-theme exclusion:

```ts
REPEAT_PURCHASE_SIGNALS = ['only order','only buy','same items','same cart','every week',
                           'reorder','buy again','never tried','always order','routine']
isRootCauseEligibleReview = (r) => !isPositiveTheme(r.theme)
```

This is why the dashboard can say *"Reorder-Surface Dominance — 34% of repeat-purchase-related reviews"* and have it mean something. Dividing by the whole corpus would dilute it to single digits and bury the mechanism.

---

## Stage 5 — Research findings

**Endpoint:** `POST /api/findings`

Produces one narrative answer per research question, assembled from aggregates + templated mechanism language + evidence.

### Narrative assembly

Findings text is built from the taxonomy's own *meaning strings* (§9), composed by a small grammar that adapts to which fields are populated:

```ts
root_cause && barrier  → `Users experience ${barrier} because ${root_cause}.`
root_cause && theme    → `Because ${root_cause}, users experience that ${theme}.`
root_cause only        → `Discovery surfaces ${root_cause}, reducing meaningful category exploration.`
barrier && theme       → `Users report that ${barrier}, causing ${theme}.`
barrier only           → `Users struggle to explore new categories because ${barrier}.`
theme only             → `Users experience exploration friction: ${theme}.`
fallback               → `Users articulate exploration challenges that converge on habit over experimentation.`
```

The engine then injects the computed numbers from Stage 4 — *"Across N exploration-related reviews, Basket Habit Lock-In leads at X%, with Poor Category Discoverability at Y%."* Every percentage in that sentence came from Stage 4. The grammar only supplies connective tissue.

**Why a grammar rather than an LLM summary:** determinism (the same aggregates always produce the same sentence, so two months are diffable), zero hallucination surface, and free retargeting (swap the meaning maps and the narratives follow). The cost is a house style that repeats — an acceptable trade for a research instrument.

### Per-finding metadata

Each finding carries: `supporting_reviews`, `supporting_segments`, `supporting_sources`, `representative_quotes` (top 3–5 by confidence), `confidence_score`, `confidence` band, `evidence_strength`, `source_count`, and `business_impact` tags.

**Confidence bands:** `High ≥ 0.70` · `Medium ≥ 0.55` · `Low < 0.55`. The dashboard exposes a global confidence filter (`All / High ≥0.5 / Low <0.5`) so a reader can instantly see how much of a finding survives at high confidence.

---

## Stage 6 — Executive synthesis

This is the layer that turns evidence into a strategy artifact. It runs entirely on top of the aggregates.

### 6.1 Domain routing

Every classified review is routed into one of seven **research domains** by a deterministic decision tree over `theme → root_cause → barrier → unmet_need`, first match wins:

| Order | Domain | Triggered by (examples) |
|---|---|---|
| 1 | `positive_exploration` | any positive theme, or `exploration_outcome === 'successful'` |
| 2 | `habit_lock_in` | Basket Habit Lock-In, Reorder Tunnel Vision, Reorder-Surface Dominance, Reorder Shortcut Dominance, Delivery-Speed Framing |
| 3 | `discoverability` | Poor Category Discoverability, Assortment Blind Spots, Buried Category Entry Points, Low Category Awareness, No Trigger to Explore |
| 4 | `trust_and_quality` | Trust Gap on Non-Grocery, Quality Uncertainty, Trust Deficit on New Category, Information Gap Blocks Trust, No Low-Risk Trial Mechanism |
| 5 | `recommendation_relevance` | Irrelevant Recommendations, Recommendation Similarity Reinforcement, Basket-Completion Optimization Bias, Personalized New-Category Suggestions |
| 6 | `navigation_and_ia` | Category Navigation Overload, Search-Only Shopping, Search-First Interaction Loop, Better Category Navigation |
| 7 | `price_and_value` | Price Comparison Friction, Promo Noise, Promo-Led Ranking Bias, Price or Quality Uncertainty |
| — | late rules | `Cold Start for New Users → discoverability`; default `discoverability` |

**Positive-first ordering is load-bearing.** Checking `positive_exploration` first prevents a review praising a successful pet-food order from being counted as a trust failure because it mentions pet food.

### 6.2 Mechanism clustering

Reviews are grouped by a composite **mechanism key**:

```
mechanismKey = `${domain}::${root_cause}::${barrier}::${theme}`   // unknown labels → "_"
```

Each cluster becomes a candidate insight carrying: `insight`, `supporting_reviews`, `supporting_segments`, `supporting_sources`, top themes/barriers/root causes/unmet needs, `representative_quotes` (top 5 by confidence), `confidence`, `severity`, `opportunity_size`, and the mechanism narrative quartet (`symptom`, `mechanism`, `product_implication`, `opportunity`).

Clustering on the *mechanism* rather than the theme is what prevents four dashboard cards that all say "users don't explore" for four different underlying reasons.

### 6.3 Severity model

```
severity = 2
  + 1 if domain === 'habit_lock_in'
  + 1 if domain === 'trust_and_quality'
  + 1 if theme === 'Basket Habit Lock-In'
  + 1 if root_cause === 'Reorder-Surface Dominance'
  + 1 if root_cause === 'Basket-Completion Optimization Bias'
  + 1 if barrier === 'Reorder Shortcut Dominance'
  + 1 if cluster.reviews.length >= 30
  → clamped to max 5;  positive_exploration clusters clamped to min 2, −1
```

These weights encode a product thesis: **structural mechanisms outrank surface ones.** A ranking objective that optimizes for basket completion is a deeper problem than a badly placed tile, and the scoring should say so. They are tunable, and they are the first thing a new team should argue about.

### 6.4 Opportunity scoring

```
impact     = clamp(severity, 1..5)
             + 0.5  if mechanism-backed
             − 1.5  if the insight is vague
             − 3 × vaguenessPenalty
             → clamp 1..5

frequency  = max(1, round( supporting_reviews / maxSupportingReviews × 50 ) / 10)   // 0–5

confidence = max(1, round( 5 × avgConfidence × 10 ) / 10)                           // 0–5

opportunity_score = round( impact × frequency × confidence × 10 ) / 10              // 0–125

size = score ≥ 60 ? 'Large' : score ≥ 25 ? 'Medium' : 'Small'
```

Multiplicative rather than additive: an opportunity must be **severe *and* frequent *and* confidently classified** to rank. A single vivid Reddit rant cannot outrank a pattern seen 40 times, and a high-frequency pattern with 0.3 confidence gets pulled back down.

### 6.5 Opportunity validation gate

Before an opportunity is allowed onto the dashboard it must pass every check. Failures are captured with reasons in a `rejected[]` list.

| Check | Rule | Rejection reason |
|---|---|---|
| Substantive problem | `problem.length ≥ 30` | *Missing substantive user problem* |
| Concrete intervention | `blinkit_opportunity.length ≥ 30` | *Missing product intervention* |
| Behavioral context | `current_user_behavior.length ≥ 20` | *Missing expected user behavior / outcome context* |
| Not generic | must not match the generic-phrase blocklist | *Opportunity too generic: "…"* |
| Buildable | must contain a build-noun **or** be ≥ 8 words | *Opportunity is not product-buildable (no concrete intervention)* |

```ts
GENERIC_BLOCKLIST = [
  /^improve discovery\.?$/i,              /^better recommendations?\.?$/i,
  /^add more categories\.?$/i,            /^improve the app\.?$/i,
  /^fix search\.?$/i,                     /^better ux\.?$/i,
  /^increase (category )?awareness\.?$/i,  /^improve navigation\.?$/i,
  /^show more products\.?$/i,             /^market it better\.?$/i,
]

BUILDABLE = /\b(bundle|trial|sample|pack|badge|explainer|rail|tile|aisle|carousel|
              nudge|reminder|filter|sort|return|refund|guarantee|cart|checkout|
              feed|banner|category|landing|price|rating|review|onboarding|quiz|
              coupon|threshold|widget|slot|placement|telemetry)\b/i
```

This gate is the difference between a research tool and a summarizer. *"Improve discovery"* and *"add more categories"* are the LLM's favorite answers and they are worthless to a PM; the engine refuses to render them.

### 6.6 What the executive layer emits

- **Executive summary** — 3–4 sentences: dominant pattern → secondary pattern → highest-impact opportunity, with a *Positive signal* line inserted when positive-exploration clusters exist.
- **Root cause diagnosis** — per mechanism: label, % of repeat-purchase-related reviews, mechanism, product implication, 2–5 evidence quotes with source/segment/confidence.
- **Product opportunities** — sortable by *review frequency* or *business impact*; each with driving unmet need, affected segments, retention signal, review count, confidence, source distribution, and quotes.
- **Shopping behaviors** — top 6 behaviors with narrative + evidence count + representative quote.
- **Segment differences** — per segment: primary challenge, shopping behavior, primary unmet need, representative quote.
- **Category mention map** — which categories customers name, and in what context (aspiration, failed trial, unawareness).
- **Strategic opportunities** — Problem / Behavior / Root cause / Opportunity, with score, size, review count, affected segments.
- **Actionable findings** — presentation-ready slides: headline, review count, verbatim quote, *Implication*, *Action*.
- **Confidence assessment** — `Evidence base: N reviews across M executive findings. Evidence strength: X Strong, Y Medium, Z Weak. …`
- **Director readiness** — self-graded score with explicit gaps ([16.5](#165-director-readiness-score)).

---

## Stage 7 — Persist & explore

### 7.1 Runs repository

`POST /api/runs` writes an immutable run to Turso and redirects to `/runs/{uuid}`. Each run stores the dataset name, all classified rows, aggregates, findings, curation stats, and status (`Completed` / `Queued` / `Failed`).

`/history` lists every run. Dataset names are auto-generated and self-describing: `live-{sources}-{amount}each`, or the uploaded filename. This matters more than it sounds — six months later, run provenance is the only thing that makes an old finding re-checkable, and it is what makes the **monthly cadence** work: run the same source mix each month and compare.

### 7.2 Application shell

A persistent left sidebar carries the four surfaces — **Dashboard · Repository · Compare runs · Quote explorer** — plus a primary **New analysis** action and the **demo-mode** control ([7.9](#79-demo-mode)). During an analysis the main pane shows a three-step progress stepper: **Fetch → Cleanup → Analyze**.

### 7.3 Dashboard

Persistent header (`{N} analyzed · {M} exploration-related`) with four actions — **Export · Evidence · Assistant · New** — plus KPI tiles (active themes, exploration barriers) that jump to their breakdown sections, global **source** and **confidence** filters, and expandable evidence on every card. `data-dashboard-no-print` attributes strip UI chrome from the print/PDF export. Scroll-to-top / scroll-to-bottom controls float over the long report.

**Per-label deep links.** Every label in every distribution carries an *"Open all reviews for {label}"* action that opens the quote explorer pre-filtered to it, and every root cause carries an *open detail view* action expanding its full quote set beyond the two shown inline (`+3 more in detail view`). These are what make the ≤2-click traceability claim in [§16](#16-insight-quality--validation) literally true.

### 7.4 Evidence drawer

The header's **Evidence** action opens *Matched evidence reviews* — a slide-over listing **every** classified review in the run, not just the representative quotes. It reports the review count, the corpus-level average confidence, and a source-distribution chip row, then lists each review with its text, source badge, segment, and confidence.

The distinction from the quote explorer matters: the explorer is for **finding** specific evidence by filtering; the drawer is for **auditing** the corpus as a whole — the answer to "show me everything you actually analysed."

### 7.5 Quote explorer — `/runs/{id}/quotes`

Full-corpus quote search combining a **free-text search** over review text with five dropdown filters — **theme × segment × root cause × unmet need × barrier**. This is the "prove it" surface: when a stakeholder challenges a number, you filter to the intersection and read the raw reviews.

Filter dropdowns are populated **only with labels present in this run**, not the full taxonomy. A reader is never offered a filter that returns nothing.

### 7.6 Assistant — `/api/chat`

The **Discovery Insight Assistant** is a slide-over grounded in the run's classified corpus, for follow-up questions the six fixed research questions don't cover — *"what do Household Managers say about baby products specifically?"*

Three properties make it safe to trust:
- It states its own scope on open: *"Ask about themes, barriers, segments, sources, or exploration problems from your analyzed reviews only. I cannot use outside data — if nothing in this dataset is relevant, I'll let you know."*
- It shows **how many reviews are in context**, so the reader knows the evidence base.
- It offers **suggested prompts** seeded from the taxonomy — e.g. *"What are the top exploration barriers?"*, *"Which segment reorders most?"*, *"How do Play Store reviews differ from Reddit?"* — which steer users toward questions the corpus can actually answer.

### 7.7 Compare — `/runs/compare`

Two run selectors and a diff across **themes, barriers, and segments**. Because the taxonomy is closed and stable, month-over-month comparison is meaningful — **this is how the engine becomes a tracking instrument for the new-category-adoption goal rather than a one-off study.** Ship an intervention, run the corpus again next month, and see whether *Low Category Awareness* actually fell.

### 7.8 Exports

Seven exports in three groups. The distinction between *Reports* and *PM research* is deliberate: the first group is the **analysis artifact**, the second is the **strategy document**.

| Group | Export | Contents |
|---|---|---|
| **Dashboard** | Dashboard PDF | Print-stylesheet render of the full dashboard |
| **Reports** | Markdown report | The dashboard's findings and evidence as prose |
| | JSON data | `{ generatedAt, totalReviews, explorationRelevantCount, excludedCount, evidence, findings, classified }` |
| | Classified CSV | `source, text, exploration_relevant, theme, barrier, behavior, emotion, segment, root_cause, unmet_need, mentioned_categories, confidence` |
| **PM research** | PM report (Markdown) | `# Executive Product Research — {dataset}` — see below |
| | PM report (JSON) | `{ evidence, findings, report, executive, opportunities }` |
| | PM report (PDF) | Print render of the Markdown variant |

**The PM research report is a separate deliverable.** Where the dashboard exports answer *"what does the corpus say?"*, the PM report answers *"what should we do?"* It contains only the synthesis layer, in presentation order:

```
# Executive Product Research — {dataset}
## Executive Summary
## Shopping Behaviors        (behavior · evidence count · narrative · quote)
## Segment Differences       (challenge · behavior · unmet need · quote)
## Unmet Needs               (need · evidence count · narrative)
## Strategic Opportunities   (size · score · problem · behavior · root cause · opportunity)
## Key Quotes                (top 8, with source and segment)
## Confidence Assessment
## Actionable Findings       (slide-ready: headline · quote · implication · action)
```

This is the artifact that goes into a review meeting. The Classified CSV is the one that goes to an analyst who wants to disagree with it.

### 7.9 Demo mode

A sidebar toggle, **locked off for ordinary users**. When enabled it runs the full pipeline against synthetic classifications — no API calls, no quota — for UI work and for demoing without a key.

Because mock output is *shaped identically* to real output, every mock run must be stamped `mock: true` server-side, badged un-dismissably on the dashboard, and headed `⚠ SYNTHETIC DATA` in all seven exports. See [`edge-cases.md` EC-P0-01](edge-cases.md).

---

## 14. API reference

All routes are Next.js App Router handlers under `/api`. Bodies and responses are JSON.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/corpus` | List saved corpora with review counts |
| `POST` | `/api/fetch-reviews` | Live scrape with source/amount/region/sort/rating filters + keyword prefilter |
| `POST` | `/api/curate-reviews` | Normalize, dedupe, noise-categorize, judge exploration relevance |
| `GET` | `/api/classify/config` | Provider, model, rate limits, batch size, batch delay, token estimate, mock flag |
| `POST` | `/api/classify` | Classify a batch of reviews against the closed taxonomy |
| `POST` | `/api/classify/cache` | Look up already-classified reviews by content hash |
| `POST` | `/api/aggregate` | Frequencies, cross-tabs, quote clusters (deterministic) |
| `POST` | `/api/findings` | Six research answers + executive synthesis |
| `POST` | `/api/runs` | Persist a completed run → returns `{ id }` |
| `POST` | `/api/runs/queue` | Persist split/queued batches for later analysis |
| `GET` | `/api/runs/{id}` | Load a persisted run |
| `GET` | `/api/runs/compare` | Compare two runs |
| `GET` | `/api/quotes` | Quote search within a run — `runId`, `search`, `theme`, `segment`, `root_cause`, `unmet_need`, `barrier` |
| `POST` | `/api/chat` | Conversational Q&A grounded in a run's corpus |

### Example — classify

```http
POST /api/classify
Content-Type: application/json

{ "reviews": [ { "source": "reddit", "text": "I've used Blinkit for two years and…" } ] }
```

```jsonc
{
  "classified": [{
    "review_id": "reddit-8f31c2",
    "source": "reddit",
    "text": "I've used Blinkit for two years and I genuinely only ever order the same 15 things…",
    "research_relevant": true,
    "research_questions": ["why_exploration_fails", "repeat_purchase_causes"],
    "evidence": "only ever order the same 15 things, I just hit reorder",
    "user_goal": "restock weekly staples with minimum effort",
    "exploration_outcome": "failed",
    "theme": "Basket Habit Lock-In",
    "barrier": "Reorder Shortcut Dominance",
    "behavior": "Reorder Previous Basket",
    "emotion": "Neutral",
    "segment": "Habitual Replenisher",
    "root_cause": "Reorder-Surface Dominance",
    "unmet_need": "Cross-Category Nudges at the Right Moment",
    "mentioned_categories": ["groceries"],
    "confidence": 0.92,
    "classification_reasons": [
      "Explicit fixed-basket language with a stated count",
      "Names the reorder shortcut as the interaction path",
      "Two-year tenure with unchanged basket signals Habitual Replenisher"
    ]
  }]
}
```

---

## 15. Data model

```ts
// ── Stage 1 ───────────────────────────────────────────────
type RawReview = {
  source: SourceId
  text: string
  review_id?: string
  rating?: number
  date?: string
  city?: string
  url?: string
}

// ── Stage 2 ───────────────────────────────────────────────
type CuratedReview = RawReview & {
  exploration_relevant: boolean
  noise_category?: 'not_exploration_related' | 'too_short' | 'generic_praise'
                 | 'delivery' | 'pricing_fees' | 'app_bug' | 'payment'
                 | 'customer_support' | 'off_topic'
  outcome?: 'successful' | 'failed' | 'unclear'
  user_goal?: string
}

// ── Stage 3 ───────────────────────────────────────────────
type ClassifiedReview = CuratedReview & {
  research_relevant: boolean
  research_questions: ResearchQuestionId[]
  evidence: string
  exploration_outcome: 'successful' | 'failed' | 'unclear'
  theme: Theme
  barrier: Barrier
  behavior: ShoppingBehavior
  emotion: Emotion
  segment: Segment
  root_cause: RootCause
  unmet_need: UnmetNeed
  mentioned_categories: string[]
  confidence: number                    // 0..1
  classification_reasons: string[]
}

// ── Stage 4 ───────────────────────────────────────────────
type LabelStat  = { count: number; pct: number }
type CrossTab   = { rows: string[]; cols: string[]; cells: Record<string, Record<string, LabelStat>> }
type QuoteCluster = { label: string; count: number; pct: number; quotes: Quote[] }

type Aggregation = {
  totalReviews: number
  explorationRelevantCount: number
  excludedCount: number
  themes: Record<Theme, LabelStat>
  barriers: Record<Barrier, LabelStat>
  behaviors: Record<ShoppingBehavior, LabelStat>
  emotions: Record<Emotion, LabelStat>
  segments: Record<Segment, LabelStat>
  rootCauses: Record<RootCause, LabelStat>     // scoped to repeat-purchase-related reviews
  unmetNeeds: Record<UnmetNeed, LabelStat>
  categoryMentions: Record<string, LabelStat>
  segmentByTheme: CrossTab
  themeQuotes: QuoteCluster[]
  rootCauseQuotes: QuoteCluster[]
  unmetNeedQuotes: QuoteCluster[]
  sourceDistribution: Record<SourceId, number>
}

// ── Stage 5/6 ─────────────────────────────────────────────
type Insight = {
  id: string
  insight: string
  supporting_reviews: number
  supporting_segments: Segment[]
  supporting_sources: SourceId[]
  themes: Theme[]; barriers: Barrier[]; root_causes: RootCause[]; unmet_needs: UnmetNeed[]
  representative_quotes: Quote[]
  confidence: number
  severity: number                                  // 1..5
  opportunity_size: 'Large' | 'Medium' | 'Small'
  symptom?: string; mechanism?: string
  product_implication?: string; opportunity?: string
  research_domain: ResearchDomain
  is_positive: boolean
}

type Finding = {
  id: string
  title: string
  description: string
  evidence_count: number
  affected_segments: string[]
  representative_quotes: Quote[]
  confidence: 'High' | 'Medium' | 'Low'
  confidence_score: number
  evidence_strength: 'Strong' | 'Medium' | 'Weak'
  source_count: number
  business_impact: string[]
}

type Opportunity = {
  id: string
  problem: string
  current_user_behavior: string
  root_cause: string
  blinkit_opportunity: string
  size: 'Large' | 'Medium' | 'Small'
  opportunity_score: number
  impact_score: number; frequency_score: number; confidence_score: number
  supporting_reviews: number
  affected_segments: string[]
  representative_quotes: Quote[]
  related_finding_id: string
}
```

---

## 16. Insight quality & validation

*How do you know the insights are real?* This is the question that separates a demo from a research instrument. The engine answers it with **eight** layered mechanisms — five automated and in-product, three procedural.

### 16.1 Structural guarantees (validity by construction)

| Guarantee | Enforced by |
|---|---|
| No invented labels | Closed taxonomy + "Never invent labels" + post-hoc validation against the same arrays used to build the prompt |
| No hallucinated statistics | All numbers computed in TypeScript from classified rows; the LLM never emits a count |
| No orphan claims | Every finding/opportunity/root cause requires `representative_quotes[]` with real `review_id`s |
| No silent exclusions | `records[]` retains every unique review with its exclusion reason |
| No unknown-label rankings | `OTHER_UNKNOWN_LABELS` filtered from all top-N rollups |
| No praise mislabeled as pain | Positive/negative theme sets are disjoint; `isPositiveTheme()` routes positives out of barrier/root-cause analysis |
| No denominator inflation | Root-cause percentages scoped to repeat-purchase-related reviews, not the whole corpus |

### 16.2 Per-review confidence

Every classification carries a self-reported `confidence`. It is surfaced on every quote chip, averaged into finding-level confidence, folded into opportunity scores, and exposed as a global dashboard filter (`All / High ≥0.5 / Low <0.5`).

**Use it as a diagnostic.** If a finding evaporates when you switch to *High ≥0.5*, it was carried by low-confidence rows and should not be presented. The engine will report `0% confidence` on a question when segment or mechanism attribution is unreliable, rather than quietly printing a number. That honesty is the feature.

### 16.3 Source diversity

Findings report their source distribution (`Reddit · 20 · Forums · 19 · Social · 18 · Playstore · 4`). Single-source findings are visible at a glance and graded down. Given how differently the five surfaces bias in this domain ([§5.2](#52-source-diversity-is-a-quality-requirement-not-a-nice-to-have)), this is the check that most often catches a false conclusion.

### 16.4 Evidence strength

```ts
strength =
  supporting_reviews >= 20 && distinctSources >= 3 ? 'Strong'
: supporting_reviews >= 10 && distinctSources >= 2 ? 'Medium'
: 'Weak'
```

Aggregated into a corpus-level statement rendered at the bottom of every dashboard, e.g.:

> *Evidence base: N reviews across M executive findings. Evidence strength: 1 Strong, 0 Medium, 3 Weak. Top findings are suitable for director-level strategy review with cited user evidence.*

When zero findings reach Strong, the sentence changes to *"Findings are directionally sound but need broader multi-source evidence before executive presentation."*

### 16.5 Director-readiness score

The engine grades its own output on a 10-point scale and **names its gaps**:

```ts
score = 0
score += 2.0  if findings.length      >= 3   else gap('Fewer than 3 executive findings')
score += 2.0  if mechanismCount       >= 3   else gap('Insufficient mechanism-level findings')
score += 1.5  if opportunities.length >= 3   else gap('Fewer than 3 strategic opportunities')
score += 1.5  if researchCount        >= 100 else gap('Limited exploration corpus depth')
score += 1.0  if rejectedCount <= findings.length
// practical maximum: 8.0 / 10
```

The scale maxes at 8.0 out of a displayed 10. That headroom is intentional — the last 2 points are reserved for validation the engine cannot perform itself (human spot-check agreement, cross-run stability). **A machine should not be able to award itself full marks on research quality.**

### 16.6 Opportunity validation gate

See [6.5](#65-opportunity-validation-gate). Generic and non-buildable recommendations are rejected with reasons before rendering, and rejection count feeds back into the readiness score.

### 16.7 Cross-run stability (procedural)

Because the taxonomy is closed, the same corpus can be re-run and the distributions compared via `/runs/compare`. **Recommended protocol:**

1. Run the same corpus twice with the classification cache disabled.
2. Compare theme/barrier/segment distributions.
3. Labels that swing more than a few points between runs are unstable — either the taxonomy boundary is ambiguous, or the prompt needs a sharper detection signal. Fix the taxonomy, not the number.

Run this **before** the first monthly tracking cycle. If a label is unstable, month-over-month movement in that label is noise, and you will misread it as impact.

### 16.8 Human spot-check (procedural)

**Do this before presenting any run.** Budget 30 minutes.

1. Open `/runs/{id}/quotes`.
2. For each of the top 3 themes, filter and read **10 random supporting reviews**.
3. Score each: does the label match the review? Target **≥ 8/10 agreement** per theme.
4. Repeat for the top root cause and the top segment (segment is consistently the hardest field — expect lower agreement, and treat segment cross-tabs as directional).
5. Read the `classification_reasons` on any disagreement. The reasoning trace usually reveals whether the model was confused or the *taxonomy boundary* was.
6. Log agreement rates per run. Drift in agreement is your early warning that the source mix or the model changed under you.

**Interpretation rule of thumb:**

| Field | Expected agreement | Trust level |
|---|---|---|
| `exploration_relevant` | 90%+ | High — use freely |
| `theme` | 80–90% | High — safe to present as frequencies |
| `barrier`, `unmet_need` | 75–85% | Good — present with evidence |
| `root_cause` | 70–80% | Directional — always present with mechanism + quotes |
| `segment` | 60–75% | Directional only — never present segment splits without caveat |

> **Domain-specific caution.** Segment inference is harder in this corpus than in the pilot, because a grocery review rarely reveals household composition. Expect `segment` at the low end of the band, and weight the `Household Manager` / `Occasion Shopper` distinction especially carefully — those two segments carry the strategy's central claim about latent cross-category demand.

---

## 17. Configuration

```bash
# ── LLM provider ──────────────────────────────────────────
# Groq Llama is the mandatory LLM provider for this project.
LLM_PROVIDER=groq                     # groq (mandatory)
LLM_MODEL=llama-3.3-70b-versatile    # Groq Llama model
LLM_API_KEY=...                       # or GROQ_API_KEY=...

# ── Throughput / quota tuning ─────────────────────────────
LLM_MAX_OUTPUT_TOKENS=16384           # caps batch size: floor((n-1000)/1050)
LLM_CLASSIFY_BATCH_SIZE=3             # reviews per request (hard cap 10)
LLM_BATCH_DELAY_MS=                   # override computed inter-batch delay
LLM_REQUEST_COOLDOWN_MS=              # override computed per-request cooldown
LLM_REQUESTS_PER_DAY=                 # override provider default RPD
LLM_DAILY_TOKEN_BUDGET=               # override provider default TPD

# ── Persistence ───────────────────────────────────────────
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# ── Development ───────────────────────────────────────────
MOCK_LLM=true                         # full pipeline, synthetic classifications, zero quota
```

**Tuning guidance**

- **Lower `LLM_CLASSIFY_BATCH_SIZE`** if you see `LlmOutputTruncatedError` — the model is running out of output tokens before finishing the JSON array. 3 is a safe default; 10 needs a large output window.
- **Raise it** only after confirming completions are not truncating; larger batches amortize the ~1,800-token prompt overhead across more reviews and cut total cost meaningfully.
- **Leave the delays computed.** They are derived from TPM/RPM and are what keeps long runs from dying at 60% completion.

---

## 18. Running locally

```bash
git clone <repo> && cd review-discovery-engine
npm install
cp .env.example .env.local        # add LLM_API_KEY, TURSO_* (or set MOCK_LLM=true)
npm run dev                       # http://localhost:3000
```

**First run — recommended path (no quota required):**

```bash
MOCK_LLM=true npm run dev
```

Then: open `http://localhost:3000` → pick a saved corpus → **Analyze**. You get the full dashboard end-to-end without a single API call.

**First live run:**

1. Select 2–3 sources (**always include Reddit** — it carries the mechanism-level evidence).
2. Set amount to 150–300 per source.
3. Check the pre-flight estimate (`~N requests, ~M min, X% of daily budget`).
4. Fetch → review the cleanup summary → Analyze.
5. If quota is tight, use **Save for later** to park the corpus in the repository and analyze when quota resets. Cached classifications are reused.

**Production build**

```bash
npm run build && npm start
```

Deploy target is Vercel; any Node host works. Turso is the only external dependency beyond the LLM provider.

---

## 19. Cost, throughput & capacity planning

Using the reference configuration (Groq Llama `llama-3.3-70b-versatile`, batch size 3, 30k TPM / 500k TPD):

| Kept reviews | Batches | Est. tokens | Wall time | % of daily budget |
|---|---|---|---|---|
| 50 | 17 | ~122k | ~5 min | 12% |
| 100 | 34 | ~243k | ~9 min | 24% |
| 200 | 67 | ~486k | ~17 min | 49% |
| 400 | 134 | ~972k | ~33 min | 97% |
| **Max/day** | — | — | — | **~417 reviews** |

**Wall time is dominated by throttling, not inference.** At batch size 3 the engine waits 14.3 s between requests to stay under 30k TPM. Levers, in order of effectiveness:

1. **Tighten the keyword prefilter** — free, and it is the difference between classifying 400 and 4,000 reviews.
2. **Raise batch size** (if the output window allows) — amortizes the fixed prompt overhead.
3. **Use the cache** — re-analysis costs nothing.
4. **Split across days** via queued runs.
5. **Move to a higher-TPM tier** — the throttle is computed from limits, so it adapts automatically.

**Corpus-size guidance:** 150–500 fetched reviews yielding 25–200 exploration-relevant is the sweet spot. Below ~100 exploration-relevant reviews the readiness score docks you for *"Limited exploration corpus depth"* — and it is right to.

**Monthly cadence budget.** A tracking run at 200 kept reviews costs ~17 minutes and ~49% of a day's budget. A monthly cycle across the same seven sources is comfortably affordable; a weekly cycle is not, at this tier.

**Scrape-to-analysis ratio.** From the pilot funnel ([Appendix A](#appendix-a--pilot-validation-run)), end-to-end survival was ~4.5%. **Plan to scrape roughly 20–25× your target analysis volume.** For a 200-review monthly run, that means ~4,000–5,000 raw scraped across seven sources.

---

## 20. Retargeting the engine to another domain

Everything domain-specific lives in **two files**: the research-questions module and the taxonomy module. The collectors, curation logic, aggregator, synthesis engine, scoring, validators, and UI are domain-agnostic.

This is not theoretical — the engine was built and validated against a music-discovery taxonomy before being retargeted to Blinkit ([Appendix A](#appendix-a--pilot-validation-run)). That retarget touched only the files marked `⚙️ DOMAIN` in [§21](#21-repository-layout).

### Migration checklist

- [ ] Rewrite `RESEARCH_QUESTION_IDS` + `RESEARCH_QUESTION_LABELS` (keep six — the UI grid and findings panel assume it)
- [ ] Replace the taxonomy arrays: positive themes, negative themes, barriers, behaviors, emotions, segments, root causes, unmet needs
- [ ] Update the meaning-string maps (`THEME_MEANINGS`, `BARRIER_MEANINGS`, `ROOT_CAUSE_MEANINGS`, …) — these generate the finding narratives
- [ ] Update `ROOT_CAUSE_IMPLICATIONS` and `UNMET_NEED_INTERVENTIONS` — these generate the opportunity text
- [ ] Update `OTHER_UNKNOWN_LABELS` and `NON_RESEARCH_FALLBACK`
- [ ] Rewrite the domain-routing decision tree and the severity bonuses
- [ ] Swap the keyword prefilter list
- [ ] Point the collectors at the new app IDs / subreddits / forums / social queries
- [ ] Update `BUILDABLE` regex and `GENERIC_BLOCKLIST` for the new product vocabulary
- [ ] Rename the `blinkit_opportunity` field
- [ ] **Flush the classification cache** — see [`architecture.md`](architecture.md) ADR-009
- [ ] Re-run the [human spot-check](#168-human-spot-check-procedural) to calibrate the new taxonomy before trusting any number

### Adjacent targets

The same structure applies directly to **Zepto / Instamart competitive analysis** (identical taxonomy, different collectors — and `/runs/compare` then diffs Blinkit against a competitor), or to any platform with a habit-loop / exploration-gap problem: food delivery cuisine exploration, streaming catalog depth, marketplace category breadth.

---

## 21. Repository layout

```
.
├── app/
│   ├── page.tsx                     # Fetch / upload / corpus picker; pipeline orchestrator
│   ├── history/page.tsx             # Research repository (all runs)
│   ├── runs/
│   │   ├── [id]/page.tsx            # Dashboard
│   │   ├── [id]/quotes/page.tsx     # Quote explorer
│   │   └── compare/page.tsx         # Run comparison
│   └── api/
│       ├── corpus/route.ts
│       ├── fetch-reviews/route.ts
│       ├── curate-reviews/route.ts
│       ├── classify/route.ts
│       ├── classify/config/route.ts
│       ├── classify/cache/route.ts
│       ├── aggregate/route.ts
│       ├── findings/route.ts
│       ├── quotes/route.ts
│       ├── chat/route.ts
│       └── runs/{route.ts, queue/route.ts, [id]/route.ts, compare/route.ts}
│
├── lib/
│   ├── research-questions.ts        # ⚙️ DOMAIN — 6 question IDs + labels + prompt formatter
│   ├── taxonomy.ts                  # ⚙️ DOMAIN — all closed enums, meanings, guards, prompt formatter
│   ├── categories.ts                # ⚙️ DOMAIN — Blinkit category list for mention normalization
│   ├── llm/
│   │   ├── client.ts                # Groq Llama provider adapter (mandatory)
│   │   ├── limits.ts                # RPM/RPD/TPM/TPD, batch sizing, delay + token estimation
│   │   ├── classify.ts              # batching, retry taxonomy, truncation handling
│   │   └── prompts.ts               # prompt assembly from the two domain modules
│   ├── collectors/
│   │   ├── playstore.ts  appstore.ts  reddit.ts
│   │   ├── forums.ts     social.ts
│   │   └── keyword-filter.ts        # ⚙️ DOMAIN — Filter 1
│   ├── curate.ts                    # Filter 2 + normalization + dedupe + audit records
│   ├── aggregate.ts                 # distributions, cross-tabs, quote clusters (no LLM)
│   ├── findings.ts                  # six research answers + narrative grammar
│   ├── synthesis.ts                 # domain routing, mechanism clustering, severity,
│   │                                #   opportunity scoring, validation gate, readiness
│   ├── export.ts                    # PDF / Markdown / JSON / CSV
│   └── db/                          # Turso client, run persistence, classification cache
│
├── data/                            # saved corpora
└── components/                      # dashboard cards, filters, quote chips, charts
```

`⚙️ DOMAIN` marks the files you rewrite to retarget the engine.

---

## 22. Limitations, failure modes & ethics

### Known limitations

- **Code-mixed language is the biggest gap in this domain.** Indian quick-commerce reviews are heavily Hinglish and Romanized-vernacular. The classifier handles English and light code-mixing; heavy vernacular reviews are dropped at curation, which systematically under-represents non-metro and non-English-first customers. **Treat every distribution as English-skewed until a translation pass ships.** This is the first item on the roadmap for exactly that reason.
- **Public reviews are a biased sample.** They over-represent the angry and the highly engaged, and under-represent silent satisfied customers and churned users who never wrote anything. Treat frequencies as *relative* signal, never as population estimates. Pair with behavioral analytics and moderated research before betting a roadmap.
- **Reviews describe behaviour indirectly.** A customer saying "I only buy groceries" is self-reporting, not an event log. The engine is strongest on *why* and weakest on *how much* — pair it with actual category-adoption telemetry, which is where the target metric lives anyway.
- **Segment inference is the weakest field.** It is inferred from behavioral language in a single review, not from account data. Present segment cross-tabs as directional.
- **Small corpora produce unstable synthesis.** Below ~100 exploration-relevant reviews, mechanism clusters get thin and the readiness score correctly collapses. Do not present a 1.5/10 run.
- **Closed taxonomy trades recall for comparability.** A genuinely novel complaint gets mapped to its nearest neighbor. Mitigation: periodically read the `classification_reasons` of low-confidence rows — that is where new taxonomy entries announce themselves.
- **Collectors are scraping-based** and will break when source markup or endpoints change. Watch for silently *reduced* yields, not just hard failures.
- **Temporal drift is not modeled.** A 2023 review and a 2026 review count equally, despite the assortment having changed substantially in between. Use date filters and `/runs/compare` when recency matters — which, for a platform expanding categories quickly, is most of the time.
- **Competitor mentions are collected, not modelled.** The engine records that a customer compared Blinkit to Zepto; it does not build a competitive position from it. That would be a separate run against competitor corpora.

### Ethics & compliance

- **Public data only.** No authenticated scraping, no private groups, no DMs, no order data.
- **No personal data retained.** Usernames are hashed or dropped; the engine stores review *text* and derived labels. Do not add PII to the schema.
- **Respect ToS and robots directives.** Rate-limit conservatively and identify the client honestly. Some platforms prohibit scraping outright — use their official APIs or licensed data where required.
- **Quote responsibly.** Excerpts are truncated and shown for research purposes with source attribution. Do not republish full reviews or customer identities in external material, decks, or press.
- **Findings are inputs to judgment, not verdicts.** The director-readiness score grades *research quality*, not *strategic correctness*.

### Roadmap

1. **Hinglish / vernacular translation pass** — the highest-value fix for this domain
2. Temporal trend analysis (theme frequency over assortment-expansion windows)
3. Category-mention enrichment: link `mentioned_categories[]` to the live catalog to separate "doesn't exist" from "exists but invisible"
4. Automated inter-run stability reporting (currently a manual protocol)
5. Active-learning loop: feed human spot-check corrections back as few-shot examples
6. Taxonomy-gap detector that mines low-confidence rows for proposed new labels
7. Competitor corpora side-by-side in `/runs/compare`

---

## 23. Shipped vs. specified

Everything else in this README describes behaviour present in the reference implementation. The following are **requirements we add** — each closes a real failure mode, none of them exists yet. Treat them as build work, not as documentation of something that already works.

| Requirement | Why we add it | Where |
|---|---|---|
| `taxonomy_version` stamped on runs, and `/runs/compare` refusing mismatched versions | Comparing two label spaces reports incompatibility as a trend — the core risk of the monthly cadence | [EC-P7-01](edge-cases.md), [ADR-009](architecture.md) |
| Cache-flush script + startup taxonomy-hash mismatch warning | A mixed-taxonomy corpus aggregates cleanly and is silently wrong | [EC-P6-01](edge-cases.md) |
| Mock runs stamped, badged, and headed `⚠ SYNTHETIC DATA` in all seven exports | Mock output is shaped identically to real output | [EC-P0-01](edge-cases.md) |
| Thread-concentration tracking; evidence strength downgraded above 40% single-thread | Reddit comments in one thread are one conversation, not N independent observations | [EC-P9-03](edge-cases.md) |
| Minimum 3 supporting reviews from ≥2 sources before an opportunity renders | Scoring floors let a 3-review cluster reach Medium | [EC-P2c-02](edge-cases.md) |
| Percentages suppressed or annotated below n=5 | `1/1 = 100%` renders as a headline finding | [EC-P2b-03](edge-cases.md) |
| Deterministic tie-break in top-N ordering | Non-deterministic ordering makes two identical runs disagree | [EC-P2b-05](edge-cases.md) |
| CSV formula-injection escaping | Review text starting `=` executes in the analyst's spreadsheet | [EC-P7-04](edge-cases.md) |
| Readiness guarded so an empty run scores 0.0, not 1.0 | `rejectedCount 0 ≤ findings 0` currently awards a point for nothing | [EC-P2c-07](edge-cases.md) |
| Per-source yield alerting on a rolling baseline | Collector decay is HTTP 200 with zero reviews — silent by construction | [EC-P5-01](edge-cases.md) |

---

## Appendix A — Pilot validation run

**What this is.** Before the Blinkit taxonomy was written, the pipeline was built and validated end-to-end against a **Spotify music-discovery corpus**. That domain was chosen because it is structurally identical — habit loops, algorithmic discovery surfaces, repeat consumption, an explicit "users don't explore" business problem — and because public discussion volume is large enough to stress the whole funnel.

**Why it is still in this document.** These are the only *real* end-to-end numbers the engine has produced. They are included to demonstrate output shape, funnel behaviour, and the self-grading mechanism working on live data. **They are not Blinkit findings and must never be presented as such.** Blinkit numbers replace this appendix after the first production run.

### The validation run

Source: exported dashboard PDF from run `4cbd6738-…`, `live-playstore+appstore+reddit+community+social-1000each`.

**Funnel:** 5,000 raw scraped (1,000 × 5 sources) → **225 analyzed** after keyword prefilter and dedupe → **166 topic-relevant** after PM cleanup (59 excluded) → 11 active themes, 7 barriers.

The 4.5% end-to-end survival rate is the number that matters for Blinkit capacity planning: **assume you must scrape roughly 20–25× your target analysis volume.**

**Answers to the six questions (music-domain configuration)**

| Q | Evidence | Confidence |
|---|---|---|
| 1 — why discovery fails | 166 reviews | 89% |
| 2 — top frustrations | 61 reviews | 89% |
| 3 — behaviors | 155 reviews | 93% |
| 4 — repetition causes | 93 reviews | 92% |
| 5 — segment challenges | 75 reviews | **0%** ⚠️ |
| 6 — unmet needs | 104 reviews | 92% |

Note Q5: the engine reported **0% confidence** on segment challenges and still rendered the cross-tab. That is the system working as designed — the number is shown, and so is the reason not to lean on it. **Expect the same weakness on Blinkit segments**, for the same reason: single reviews rarely contain enough behavioural signal to place a customer confidently.

**Root causes with mechanisms** — 5 mechanisms identified, top two at 32% and 30% of repetition-related reviews, each with a stated product implication.

**Strategic opportunities (scored)** — 4 opportunities passed the validation gate, scored 58.7 / 15.8 / 12.1 / 11.3 on the 0–125 scale. All four named a concrete, buildable intervention; the gate rejected the generic ones.

**Self-assessment**

> **Director readiness: 8/10** — *Findings are mechanism-backed, diverse, and suitable for director-level strategy review.*
> *Evidence base: 39 reviews across 4 executive findings. Evidence strength: 1 Strong, 0 Medium, 3 Weak.*

Read that honestly: the run was presentable, but three of four executive findings were Weak on the evidence-strength scale. The correct next action was a larger, Reddit-weighted corpus — which is exactly what the score was saying.

### What transferred to Blinkit, and what didn't

| Component | Transferred? |
|---|---|
| Collectors, curation, aggregation, synthesis, scoring, validators, UI, persistence | ✅ Unchanged |
| Rate limiting, batching, token model, retry taxonomy, cache | ✅ Unchanged |
| Evidence strength, director readiness, opportunity scoring formulas | ✅ Unchanged |
| Research questions, taxonomy, meaning strings, domain routing, severity weights | ♻️ Rewritten |
| Keyword prefilter, collector targets, `BUILDABLE` vocabulary | ♻️ Rewritten |
| Corpus, findings, quotes, percentages | ❌ **Not transferable — Blinkit corpus required** |

---

## Appendix B — Glossary

| Term | Meaning |
|---|---|
| **Run** | One immutable analysis of one corpus, persisted with its classified rows, aggregates, and findings |
| **Corpus** | The set of reviews entering a run (fetched, uploaded, or saved) |
| **Curation** | Stage 2 — normalization, dedupe, noise categorization, exploration-relevance judgment |
| **Exploration-relevant** | A review that carries usable signal about category discovery or repeat-purchase behaviour |
| **Closed taxonomy** | Fixed allowed-value lists the LLM must choose from; never free-form |
| **Mechanism key** | `domain::root_cause::barrier::theme` — the clustering key for insights |
| **Research domain** | One of 7 buckets reviews are routed into for synthesis |
| **Evidence strength** | Strong / Medium / Weak, from review count × distinct source count |
| **Director readiness** | Self-graded 0–10 score of whether a run is fit for executive presentation |
| **Opportunity score** | `impact × frequency × confidence`, 0–125, sized Large/Medium/Small |
| **Buildable** | An opportunity naming a concrete product intervention, not a wish |
| **MAC** | Monthly Active Customer — the denominator of the target metric |

---

*Built as a PM research instrument: every number traceable to a quote, every quote traceable to a source, and every run honest about how much you should trust it.*
