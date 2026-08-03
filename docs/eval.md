# ReviewLens — Evaluation

**Blinkit category-discovery engine.** Phase-by-phase: what becomes measurable when, how it is measured, and what must be true before the phase closes.

| Document | Purpose |
|---|---|
| [`README.md`](README.md) | What the engine does and why · §16 argues *why the output is trustworthy* |
| [`architecture.md`](architecture.md) | How it is built |
| [`implementation-plan.md`](implementation-plan.md) | In what order to build it · §22 lists *which test levels exist* |
| [`edge-cases.md`](edge-cases.md) | What goes wrong, and the required behaviour |
| `eval.md` (this file) | *How quality is measured* — per phase, with datasets, metrics, thresholds, gates |

Phases follow [`implementation-plan.md`](implementation-plan.md) (P0–P9). Each eval has a stable ID (`EV-P3-02`) for use in CI, commits, and scorecards.

---

## Table of contents

- [Why this is hard](#why-this-is-hard)
- [The five eval families](#the-five-eval-families)
- [Phase × family coverage](#phase--family-coverage)
- [The gold set](#the-gold-set)

**Per-phase evaluation**

- [P0 — Eval scaffolding](#p0--eval-scaffolding)
- [P1 — Taxonomy & the human ceiling](#p1--taxonomy--the-human-ceiling)
- [P2 — Deterministic layers & gold-set construction](#p2--deterministic-layers--gold-set-construction)
- [P3 — Classification accuracy](#p3--classification-accuracy)
- [P4 — Persistence & render fidelity](#p4--persistence--render-fidelity)
- [P5 — Collection quality](#p5--collection-quality)
- [P6 — Resilience & economics](#p6--resilience--economics)
- [P7 — Output fidelity & groundedness](#p7--output-fidelity--groundedness)
- [P8 — Stability & insight quality](#p8--stability--insight-quality)
- [P9 — Production validation](#p9--production-validation)

**Cross-phase**

- [Consolidated gates](#consolidated-gates)
- [Cadence — what re-runs when](#cadence--what-re-runs-when)
- [Interpreting a failure](#interpreting-a-failure)
- [Limitations of this evaluation](#limitations-of-this-evaluation)
- [Scorecard](#scorecard)

---

## Why this is hard

Most of this system has no natural ground truth.

A classifier that labels a review `Basket Habit Lock-In` cannot be checked against a database — there is no fact of the matter recorded anywhere, only a judgment a careful human would also make. And the layers above it are worse: there is no correct answer to *"is this a good product opportunity?"*

That produces three distinct measurement problems, and conflating them is the usual failure:

| Layer | Ground truth? | Approach | Phase |
|---|---|---|---|
| **Aggregation & scoring** | Yes, deterministically | Golden fixtures; the answer is arithmetic | P2 |
| **Curation & classification** | Yes, if you create it | Human-labeled gold set; agreement metrics | P3, P5 |
| **Findings & synthesis** | **No** | Rubric rating + discrimination against degraded output | P8 |

The third is where teams give up and substitute vibes. [P8](#p8--stability--insight-quality) is the answer to that, and it is the phase worth the most attention.

### What makes any of this measurable

The closed taxonomy. Because every field draws from a fixed array, classification is a **multi-class labelling problem** with a computable agreement score. Under open tagging there would be nothing to compute — two annotators would produce different label vocabularies and no metric would apply. Evaluation is a dividend of [ADR-001](architecture.md), the same as cross-run comparison is.

### The sequencing principle

**Measure each layer at the earliest phase where it becomes measurable, not at the end.**

The taxonomy's discriminability is testable at P1, before a single review is classified — and if two informed humans cannot agree on it, no model will. Aggregation is testable at P2 with a mock classifier. Deferring all evaluation to a "testing phase" means discovering at P8 that the taxonomy was ambiguous, which costs a full reclassification and a cache flush.

---

## The five eval families

Method vocabulary, referenced throughout the phase sections.

| ID | Family | Question it answers | Ground truth |
|---|---|---|---|
| **E1** | Classification accuracy | Does the classifier assign the labels a careful human would? | Gold set |
| **E2** | Curation quality | Are we keeping the right reviews — and what are we losing? | Labeled raw sample |
| **E3** | Stability | Does the same corpus produce the same answer twice? | Self-consistency |
| **E4** | Insight quality | Is the synthesis adding value over its inputs? | Human rubric + discrimination |
| **E5** | System & economics | Does it run predictably, within budget, and survive faults? | Instrumented runs |

E1/E2 gate the pipeline. E3 gates the monthly cadence. E4 gates presentation. E5 gates operability.

---

## Phase × family coverage

Where each family is first exercised (●) and where it is re-run in full (○).

| Phase | E1 | E2 | E3 | E4 | E5 |
|---|:--:|:--:|:--:|:--:|:--:|
| P0 — Eval scaffolding | | | | | ● |
| P1 — Taxonomy | ● *(human ceiling)* | ● *(prefilter fixture)* | | | |
| P2 — Deterministic layers | ● *(gold set built)* | | | | |
| P3 — Classification | ● **full** | ● *(Filter 2)* | | | ● |
| P4 — Persistence | | | | | ○ |
| P5 — Collectors | | ● **full** *(Filter 1)* | | | ○ |
| P6 — Resilience | | | | | ● **full** |
| P7 — Export & chat | | | | ● *(groundedness)* | ○ |
| P8 — Instrumentation | ○ | | ● **full** | ● **full** | |
| P9 — Production | ○ *(spot-check)* | ○ | | ○ | ○ |

Two things this makes visible: **E1 begins at P1**, not P3 — the human ceiling is measured before the model exists. And **E4 is not measurable until P8**, because it needs a full synthesis layer to degrade and compare against.

---

## The gold set

The most valuable test asset in the project, and the one most likely to be deferred into uselessness. Built in **P2**; used from **P3** onward.

### Composition — 100 reviews

Sampling quotas are not decoration. A gold set drawn from convenient reviews certifies a classifier that fails on inconvenient ones.

| Quota | Count | Why |
|---|---|---|
| Per source, proportional to expected corpus mix | ≥10 each across all seven | A gold set of Play Store reviews certifies nothing about Reddit, where the mechanism evidence lives |
| **Mixed reviews** (delivery complaint + shopping signal) | ≥15 | The highest-value and most-likely-discarded review type ([EC-P2a-04](edge-cases.md)) |
| **Code-mixed / Hinglish** | ≥15 | The known weakness. Agreement is reported **separately** for this slice |
| **Questions** ("does Blinkit sell X?") | ≥8 | Direct `Low Category Awareness` evidence that reads as a non-review ([EC-P2a-06](edge-cases.md)) |
| **Positive** (successful category trial) | ≥12 | Praise mislabeled as pain is the classic silent failure |
| **Pure noise** | ≥15 | Measures Filter 2 precision |
| Rare labels — ≥1 example of every theme, barrier, root cause | as needed | Macro-F1 is uncomputable for a label with zero gold examples |

### Labeling protocol

1. **Two annotators label independently.** One annotator produces a gold set that encodes one person's reading of the taxonomy.
2. Compute inter-annotator agreement (IAA) **before** looking at model output. This is the ceiling.
3. Adjudicate every disagreement in conversation.
4. **Record the reason for each disagreement.** This is the highest-value output of the whole exercise.

> **Disagreements are taxonomy feedback, not annotator error.** If two informed people cannot agree on whether a review is `Buried Category Entry Points` or `Low Category Awareness`, the boundary is wrong. Fix `lib/taxonomy.ts` — do not adjudicate by fiat and move on. Every such fix raises the ceiling for the model too.

### Versioning & refresh

- Versioned in-repo as `data/gold-set.json`, carrying a `taxonomy_version`.
- **A taxonomy change invalidates gold labels for the changed fields.** Re-adjudicate those fields; never silently re-map.
- Refresh ~20% annually against fresh corpus samples to catch language and platform drift.
- Never expand the gold set with reviews the model found easy. That inflates every metric.

---

# P0 — Eval scaffolding

**What becomes measurable.** Nothing about the model — no classifier exists. What is measurable is **whether the project can measure itself**, and the purpose of evaluating at P0 is to make eval a precondition rather than a retrofit.

### Evals

| ID | Eval | Method | Artifact |
|---|---|---|---|
| EV-P0-01 | CI runs build + typecheck + lint + test on a clean checkout | CI | green pipeline |
| EV-P0-02 | **Layering rules are enforced, not documented** | Commit a deliberate L4→L2 import; CI must fail | failing build |
| EV-P0-03 | Disable-comment on the restricted-paths rule fails the build | grep check in CI | failing build |
| EV-P0-04 | Mock mode runs end-to-end with **zero** env vars set | `MOCK_LLM=true` on empty env | pipeline completes |
| EV-P0-05 | **Scorecard emitter exists** with every row present and marked *not yet measured* | `npm run eval:all` | scorecard skeleton |

### EV-P0-05 in detail — the row that prevents drift

Create the full scorecard at P0, with every metric listed and every value blank. It costs an hour and it does one important thing: **an unmeasured metric is visible as a blank row rather than as an absence nobody notices.**

Retrofitted evaluation reliably omits whatever turned out to be inconvenient — usually calibration and Filter 1 recall, the two hardest. A skeleton scorecard makes those omissions loud from day one.

### Gate

- [ ] Illegal import fails CI
- [ ] Rule-disable comment fails CI
- [ ] Mock pipeline completes with no env
- [ ] `npm run eval:all` emits the complete scorecard skeleton

---

# P1 — Taxonomy & the human ceiling

**What becomes measurable.** The taxonomy itself — its internal consistency, and crucially **whether humans can apply it consistently.** No model is involved, and that is the point.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P1-01 | Array integrity — non-empty, no duplicates within an array | unit | pass |
| EV-P1-02 | Positive ∩ negative themes = ∅ | unit | pass |
| EV-P1-03 | Every theme / barrier / root cause has a meaning string | unit | 100% |
| EV-P1-04 | Every root cause has an implication; every unmet need an intervention | unit | 100% |
| EV-P1-05 | Every `OTHER_UNKNOWN_LABELS` member exists in exactly one array | unit | pass |
| EV-P1-06 | No label is a prefix of another within the same array | unit | pass |
| EV-P1-07 | `formatTaxonomyForPrompt()` output contains every label verbatim | unit | 100% |
| EV-P1-08 | Prompt block within input-token budget | token count | ≤ 1,800 |
| EV-P1-09 | **Prefilter positive fixture** — 20 hand-written relevant reviews | regex | 20/20 match |
| EV-P1-10 | **Prefilter negative fixture** — substring traps | regex | 0/20 match |
| EV-P1-11 | **Human ceiling (IAA)** — 2 annotators, 20 reviews, independent | Cohen's κ + agreement | see below |

### EV-P1-10 in detail — the substring fixture

The negative fixture is what catches [EC-P1-01](edge-cases.md). It must contain, at minimum:

```
"carpet cleaner"      → must NOT match on `pet`
"communicate"         → must NOT match on `cat`
"category"            → must NOT match on `cat`
"orange juice"        → must NOT match on `range`
"refresh the app"     → must NOT match on `fresh`
"competition"         → must NOT match on `pet`
"petrol bunk"         → must NOT match on `pet`
"delicate fabric"     → must NOT match on `cat`
```

Ten positives is table stakes. **The negative fixture is the one that catches the failure that silently disables the entire cost model.**

### EV-P1-11 in detail — measure the ceiling before you build the thing it caps

Two PMs label the same 20 reviews independently using only the taxonomy and its meaning strings. This is the **most under-used eval in LLM pipeline work**, and it is available before any model exists.

| Human agreement on `theme` | Reading | Action |
|---|---|---|
| ≥ 85% | Taxonomy is discriminable. A model target of 80% is realistic | Proceed |
| 70–85% | Boundaries are soft. Model will land below | Sharpen the two worst-confused meaning strings, re-test |
| < 70% | **The taxonomy is not usable.** No model will beat it | Rebuild the ambiguous labels before P2 |

**The consequence that matters:** a model can only be *held to* a threshold humans clear. If IAA on `theme` is 78%, then the 80% model gate at P3 is unreachable and will be quietly lowered under deadline pressure — which is how a taxonomy problem becomes a permanent accuracy problem.

Record the IAA figure. At P3 it becomes the reference point: **model agreement should approach it from below, never exceed it.** A model that beats its own gold set's inter-annotator agreement is a signal of contamination, not excellence.

### Gate

- [ ] EV-P1-01 … EV-P1-08 all pass
- [ ] Prefilter negative fixture: **0/20 false matches**
- [ ] **Human IAA on `theme` ≥ 85%**, recorded in the scorecard
- [ ] PM has signed off on the taxonomy ([P1-T10](implementation-plan.md))

---

# P2 — Deterministic layers & gold-set construction

**What becomes measurable.** Everything that does not involve the LLM: aggregation, cross-tabs, scoring, validators, readiness. These have real ground truth — the answer is arithmetic — so they are tested against hand-computed fixtures, not judgment.

This is also where the gold set is built, **before the real classifier exists**.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P2-01 | Distributions match hand-computed values on a 20-row corpus | golden fixture | exact |
| EV-P2-02 | Cross-tab row-normalization matches hand-computed | golden fixture | exact |
| EV-P2-03 | **All ten invariants** ([architecture §5.4](architecture.md)) | property test over seed corpus | 100% |
| EV-P2-04 | Opportunity scoring, incl. boundaries at 25 and 60 | table test | exact |
| EV-P2-05 | Readiness rubric — every check reachable, every gap string correct | table test | exact |
| EV-P2-06 | Empty run scores **0.0**, not 1.0 ([EC-P2c-07](edge-cases.md)) | unit | exact |
| EV-P2-07 | Every `GENERIC_BLOCKLIST` entry rejects; buildable/non-buildable pairs | table test | 100% |
| EV-P2-08 | Deterministic tie-break — 100 runs, identical top-N order | property test | 100% |
| EV-P2-09 | Mock classifier determinism — same input, same output | unit | exact |
| EV-P2-10 | **Gold set built; IAA measured on all 100** | annotation | see below |
| EV-P2-11 | Gold set composition meets every quota | unit assertion | 100% |

### EV-P2-03 in detail — invariants are the cheapest real eval

Ten property tests over the seed corpus, each mapping to a numbered invariant. They cost a day and they hold for the life of the project, because they test *structural* facts that no amount of model drift can change:

- I2 — no review vanishes without a recorded reason
- I5 — root-cause percentages use the repeat-purchase denominator
- I6 — no unknown-bucket label appears in a top-N
- I10 — single-select distributions sum to scope size

**Every invariant should be green at the end of P2**, before a single real API call. If one cannot be made to pass with a mock classifier, it will not pass with a real one.

### EV-P2-10 in detail — IAA on the full gold set

The P1 ceiling test used 20 reviews for speed. Here it is done properly, on all 100, per field:

```
FIELD                  IAA      MODEL TARGET (P3)
exploration_relevant   ——%      ≥ 90%
theme                  ——%      ≥ 80%
barrier                ——%      ≥ 75%
root_cause             ——%      ≥ 70%
segment                ——%      ≥ 60%
```

If any IAA figure sits below its model target, **the target is wrong, not aspirational.** Fix the taxonomy or lower the gate deliberately and in writing — do not carry an unreachable threshold into P3.

### Gate

- [ ] `npm run analyze -- data/seed-corpus.csv` produces a full six-question report offline
- [ ] All ten invariants asserted and passing
- [ ] Aggregation matches hand-computed fixtures exactly
- [ ] Gold set v1 complete, quota-compliant, with per-field IAA recorded
- [ ] Every model target at P3 is ≤ its measured IAA

---

# P3 — Classification accuracy

**What becomes measurable.** The classifier, against the gold set. This is the heaviest E1 phase and the one whose thresholds gate everything downstream.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P3-01 | Per-field **agreement** vs. gold | exact-match rate | see gates |
| EV-P3-02 | Per-field **Cohen's κ** | chance-corrected | `theme` ≥ 0.70 |
| EV-P3-03 | Per-field **macro-F1** | unweighted mean F1 | `theme` ≥ 0.65 |
| EV-P3-04 | **Confusion pairs** — top swapped labels | confusion matrix | reported |
| EV-P3-05 | **Coercion rate** | share not exact-matching pre-fallback | < 5% |
| EV-P3-06 | **Calibration (ECE)** | 10-bin reliability curve | ≤ 0.10 |
| EV-P3-07 | **Code-mixed slice**, all fields | same metrics, sliced | reported separately |
| EV-P3-08 | Filter 2 precision / recall | vs. gold noise quota | ≥ 85% / ≥ 90% |
| EV-P3-09 | **Cost-model accuracy** | estimate vs. instrumented spend | ±15% |
| EV-P3-10 | Parse robustness | adversarial fixtures | 100% correct routing |
| EV-P3-11 | Model agreement **≤ measured IAA** | compare to EV-P2-10 | see below |

### Why each metric, and not just accuracy

| Metric | What it catches that agreement misses |
|---|---|
| **Cohen's κ** | A skewed field scores 60% by always guessing the majority label |
| **Macro-F1** | A classifier that nails the top three themes and never predicts the tail looks fine on accuracy and is useless for the long tail |
| **Confusion pairs** | *Which* boundary is soft — this is taxonomy feedback, not model feedback |
| **Coercion rate** | Prompt/array drift, or a silent provider model upgrade ([EC-P3-04](edge-cases.md)) |
| **ECE** | Whether `confidence` means anything at all |

### EV-P3-06 in detail — calibration is not optional

`confidence` drives the dashboard filter, quote selection, finding-level confidence, and one of the three factors in opportunity scoring. **If confidence is uncorrelated with correctness, every one of those is noise wearing a number.**

Bin predictions by stated confidence; compare bin accuracy to bin confidence:

```
ECE = Σ (|bin| / N) × |accuracy(bin) − mean_confidence(bin)|
```

| Pattern | Reading |
|---|---|
| ECE ≤ 0.10 | Usable. Confidence gates mean something |
| ECE > 0.15 | Confidence is decorative — stop using it as a filter until fixed |
| Near-zero variance | Model has anchored (typically ~0.9 everywhere); all downstream gates inert ([EC-P3-14](edge-cases.md)) |
| Accuracy **falls** as confidence rises | Inverted calibration. Rare, catastrophic, invisible without this test |

### EV-P3-11 in detail — the ceiling check

Compare model agreement against the IAA recorded at P2.

| Result | Reading |
|---|---|
| Model within ~10pp below IAA | Healthy. The model has learned the taxonomy about as well as its authors apply it |
| Model far below IAA | Genuine model problem — sharpen detection signals, add few-shot from gold |
| **Model ≥ IAA** | **Suspicious.** Usually gold-set contamination (labels derived from model output), or annotators applying a rule the taxonomy does not state |

### Reporting format

Per field, always — never a blended accuracy number. The fields differ in difficulty and in downstream consequence, and averaging hides exactly the weakness you need to see.

```
FIELD                 AGREE    κ      MACRO-F1   IAA     TOP CONFUSION
exploration_relevant   ——%    ——      ——         ——%     —
theme                  ——%    ——      ——         ——%     —
barrier                ——%    ——      ——         ——%     —
behavior               ——%    ——      ——         ——%     —
emotion                ——%    ——      ——         ——%     —
segment                ——%    ——      ——         ——%     —
root_cause             ——%    ——      ——         ——%     —
unmet_need             ——%    ——      ——         ——%     —

SLICE: code-mixed      ——%   (reported separately, always)
Coercion rate          ——%    ECE  ——
```

### Gate

- [ ] `exploration_relevant` ≥ 90% · `theme` ≥ 80% · `barrier`/`unmet_need` ≥ 75% · `root_cause` ≥ 70%
- [ ] `theme` κ ≥ 0.70 · macro-F1 ≥ 0.65
- [ ] Coercion rate < 5%
- [ ] Cost model within ±15%
- [ ] No field exceeds its measured IAA
- [ ] Code-mixed slice reported (not required to pass)

---

# P4 — Persistence & render fidelity

**What becomes measurable.** Whether what a reader *sees* equals what the pipeline *computed*. No new model quality here — this phase evaluates the integrity of the path from stored run to rendered pixel.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P4-01 | Run round-trip — persist → load → deep-equal | unit | exact |
| EV-P4-02 | **No recomputation in the render path** | assert dashboard reads only persisted fields | 100% |
| EV-P4-03 | Every quote `review_id` resolves (invariant I8) | write-time check | 100% |
| EV-P4-04 | Filter projections — filtered view equals expected subset | unit | exact |
| EV-P4-05 | Reload fidelity — page reload renders identically | E2E | pixel-stable |
| EV-P4-06 | `taxonomy_version` present on every persisted run | unit | 100% |
| EV-P4-07 | Mock badge survives print CSS | visual | present |
| EV-P4-08 | Evidence drawer lists the **full** classified set | unit | count matches |

### EV-P4-02 in detail — the guarantee that makes the rest meaningful

The dashboard must render **only** from persisted fields, never recompute. If any number is derived at render time, then the screen and the stored run can disagree, and every downstream export inherits the ambiguity — which is [EC-P7-13](edge-cases.md) waiting to happen at P7.

Test it by loading a run whose persisted `aggregation` has been deliberately perturbed, and asserting the dashboard shows the perturbed value. If it shows the correct value, something is recomputing.

### Gate

- [ ] Round-trip deep-equal
- [ ] Perturbed-fixture test proves zero recomputation
- [ ] 100% quote resolution at write time
- [ ] `taxonomy_version` on every run

---

# P5 — Collection quality

**What becomes measurable.** The corpus itself — and specifically **what the pipeline is losing**, which nothing downstream can tell you.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P5-01 | **Filter 1 recall** via labeled rejected sample | 200 rejected reviews, hand-labeled | ≥ 90% |
| EV-P5-02 | Filter 1 keep-rate, per source | run stats | 5–20% (Play Store) |
| EV-P5-03 | **Yield-decay alarm fires** on changed-markup fixture | fault injection | alarm raised |
| EV-P5-04 | Cross-source dedupe on cross-post fixture | unit | collapses to 1 |
| EV-P5-05 | Spam-campaign collapse — 50 near-identical promos | unit | collapses to 1 |
| EV-P5-06 | Source-mix representativeness vs. intended mix | run stats | within 20% |
| EV-P5-07 | Per-collector field mapping vs. recorded fixtures | contract test | exact |
| EV-P5-08 | Wrong-app-ID detection | contract test | rejects |
| EV-P5-09 | ToS review completed and recorded per source | manual | 7/7 |

### EV-P5-01 in detail — the measurement most teams skip

To measure Filter 1 recall you must label reviews the prefilter **rejected**. Nothing downstream can tell you about them — they left the pipeline before anything saw them, and no dashboard metric will ever hint at their absence.

**Procedure:**
1. Sample 200 prefilter-rejected reviews at random from a real fetch.
2. Two annotators label each for exploration relevance.
3. Compute:

```
Filter 1 recall ≈ 1 − (relevant found in rejected sample ÷ estimated total relevant)
```

Run once per prefilter change and quarterly otherwise. This is the only instrument that detects a prefilter term quietly excluding a whole class of evidence — for example, a tightened word-boundary guard that stopped matching `categor*` entirely.

### EV-P5-03 in detail — alarm on yield, never on errors

A collector whose source changed markup returns **HTTP 200 with zero parseable reviews**. It raises no error. It is indistinguishable from "no matching reviews found" ([EC-P5-01](edge-cases.md)).

The eval is a fixture with deliberately altered markup: the collector must return zero, and the **yield alarm must fire**. A test that only asserts "returns zero without throwing" passes while the alarm is broken, which is the exact failure this guards against.

### Gate

- [ ] Filter 1 recall ≥ 90% on the rejected sample
- [ ] Per-source keep-rates inside band
- [ ] Yield alarm fires on the decay fixture
- [ ] One collector failing degrades the run rather than failing it
- [ ] ToS review recorded for all seven sources

---

# P6 — Resilience & economics

**What becomes measurable.** Behaviour under failure and under budget pressure. Pure E5.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P6-01 | **Fault routing** — every error family to the right handler | fault injection | 100% |
| EV-P6-02 | **Zero re-spend on resume** | interrupt at 50%, resume, count API requests | exact zero |
| EV-P6-03 | Truncation → halve batch → complete | fault injection | completes |
| EV-P6-04 | Per-day quota → **stops immediately**, no retries | fault injection | 1 attempt |
| EV-P6-05 | Per-minute limit → backs off and continues | fault injection | completes |
| EV-P6-06 | Cache-key stability across re-batching | unit | identical |
| EV-P6-07 | Taxonomy-hash mismatch raises the startup warning | unit | warning raised |
| EV-P6-08 | Split runs — each part completes independently | integration | pass |
| EV-P6-09 | `cached < 10` refuses partial dashboard | unit | refuses |
| EV-P6-10 | Wall-time estimate accuracy | instrumented | ±20% |

### EV-P6-02 in detail — measure requests, not elapsed time

"It felt faster" is not a measurement. Instrument the API request count directly: a resumed run over a fully-cached corpus must issue **zero** classification requests.

Timing-based checks pass when the cache is broken but the network happens to be fast, which is precisely when you most want the test to fail.

### EV-P6-04 in detail — the one-line bug that costs a day

The distinction between recoverable and fatal is the highest-leverage line in the retry logic. **A per-day quota error retried four times burns the remaining wall-clock to fail identically.** Inject each error string from the taxonomy and assert the attempt count:

| Injected | Expected attempts |
|---|---|
| `429`, `503`, `per minute`, `TPM` | up to 4 |
| `per day`, `daily`, `TPD`, `RPD` | **1** |
| `billing`, `insufficient`, `credits` | **1** |

### Gate

- [ ] 100% fault routing
- [ ] Zero re-spend verified by request count
- [ ] Per-day quota stops at one attempt
- [ ] Cache flush + hash-mismatch warning both work

---

# P7 — Output fidelity & groundedness

**What becomes measurable.** Whether every artifact that leaves the system says the same thing, and whether the assistant stays inside its evidence.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P7-01 | **Export equivalence** — dashboard = MD = JSON = CSV = PM report | figure-by-figure diff | exact |
| EV-P7-02 | CSV formula-injection neutralized | unit — `=`, `+`, `-`, `@` prefixes | 100% |
| EV-P7-03 | CSV round-trips through a real parser | unit | lossless |
| EV-P7-04 | **Traceability measured, not asserted** | sample 20 statistics, count clicks to evidence | ≤ 2 clicks, 20/20 |
| EV-P7-05 | **Chat groundedness** — out-of-scope question set | 20 unanswerable questions | ≥ 95% decline |
| EV-P7-06 | Chat citation resolution | every cited `review_id` exists | 100% |
| EV-P7-07 | Provenance header present in all seven exports | unit | 7/7 |
| EV-P7-08 | Mock run → `⚠ SYNTHETIC DATA` in all seven | unit | 7/7 |
| EV-P7-09 | Compare refuses mismatched `taxonomy_version` | unit | refuses |
| EV-P7-10 | Quote-explorer filter options ⊆ run-present labels | unit | 100% |

### EV-P7-01 in detail — two serializers, one truth

The PM report and the dashboard read the same persisted `ExecutiveReport` and neither recomputes ([EC-P7-13](edge-cases.md)). The eval extracts every numeral from each artifact and diffs them.

A PM report saying 34% while the dashboard says 31% destroys trust in both, and it is the most likely divergence in the system because the two serializers are separate modules by design.

### EV-P7-05 in detail — the groundedness set

Twenty questions the corpus provably cannot answer, e.g.:

```
"What is Blinkit's market share?"
"How many orders were placed last month?"
"What does Zepto's internal roadmap say?"
"Will Blinkit launch in Nagpur?"
"What percentage of users churned?"
```

The assistant must **decline**, not confabulate. A confabulated answer is indistinguishable in form from a grounded one, which is exactly why this needs a scored eval rather than a spot-check.

### Gate

- [ ] Export equivalence exact across all artifacts
- [ ] Formula injection neutralized
- [ ] Traceability ≤ 2 clicks on 20/20 sampled statistics
- [ ] Chat declines ≥ 95% of unanswerable questions; 100% citation resolution

---

# P8 — Stability & insight quality

**What becomes measurable.** The two hardest things: whether the engine repeats itself (E3), and whether its synthesis is worth anything (E4).

## E3 — Stability

The engine is sold as a **monthly tracking instrument**. That claim is only as good as run-to-run stability: if a label moves 6pp between two identical runs, a 6pp move next month is noise.

```bash
npm run eval:stability -- data/seed-corpus.csv --runs 3 --no-cache
```

**The harness must hard-refuse to run with the cache enabled.** With the cache on, run 2 reads run 1's answers, every delta is zero, and every label is certified stable — a false result worse than no result ([EC-P8-01](edge-cases.md)).

| ID | Eval | Threshold |
|---|---|---|
| EV-P8-01 | Max label drift across runs | ≤ 3pp |
| EV-P8-02 | Mean absolute deviation | ≤ 1.5pp |
| EV-P8-03 | Rank stability — Spearman on top-10 themes | ≥ 0.85 |
| EV-P8-04 | Curation stability — variance in kept count | ≤ 2% |
| EV-P8-05 | Harness refuses to run with cache on | must refuse |

### The output that matters: the trackable-label list

```
LABEL                            DRIFT    VERDICT
Basket Habit Lock-In             1.2pp    trackable
Poor Category Discoverability    2.1pp    trackable
Quality Uncertainty              4.8pp    NOT TRACKABLE — do not read movement
```

An untrackable label is not broken — it may be perfectly usable *within* a run. It simply cannot carry a trend. **Publish this list alongside every monthly comparison.**

## E4 — Insight quality

No ground truth exists, so quality is triangulated from three angles.

### EV-P8-06 — Rubric rating

Each executive finding scored 0–2 on four dimensions:

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| **Supported** | Quotes don't support the claim | Partially | Every element traceable to a quote |
| **Mechanism-level** | Restates a symptom | Names a cause vaguely | Names a specific product behaviour producing the symptom |
| **Actionable** | No implied action | Directional | A team could start work Monday |
| **Non-obvious** | Known before the study | Adds nuance | Genuinely changes a prior |

Max 8. **A finding scoring ≤ 3 must not be presented**, regardless of evidence count.

*Non-obvious* is the dimension people drop, and it is the one measuring whether the engine earned its cost. A finding that is well-supported, mechanism-level, actionable, and already known to everyone in the room is a correct answer to a question nobody needed asked.

### EV-P8-07 — The discrimination test

Rubric ratings drift, and raters are generous to output they know is real. So test whether the synthesis is distinguishable from degraded versions of itself.

| Variant | Degradation |
|---|---|
| `real` | Untouched engine output |
| `shuffled` | Quotes swapped with another finding's |
| `generic` | Opportunity replaced with a blocklist phrase |
| `symptom` | Mechanism sentence stripped |

Present all four blind; the rater picks the most decision-useful.

```
Discrimination rate = share of trials where `real` ranks first
```

| Result | Reading |
|---|---|
| ≥ 75% | Synthesis adds real value over its inputs |
| 50–75% | Marginal — the mechanism layer is not landing |
| ≈ 25% (chance) | **The synthesis layer is decorative.** Aggregation alone would serve as well |

**This is the single most honest test in the document**, and the one most likely to return an uncomfortable answer — which is precisely why it is worth running.

### EV-P8-08 — Opportunity-gate agreement

- Sample 30 gate decisions, mixed accept/reject
- A PM independently judges buildable / not buildable
- Target **≥ 85% agreement**
- **False accepts matter far more than false rejects** — a generic opportunity reaching a deck costs more than a good one filtered out, because the filtered one is still visible in the rejection list

### Other P8 evals

| ID | Eval | Threshold |
|---|---|---|
| EV-P8-09 | Weak corpus → low readiness with **correct** gap text | exact gap strings |
| EV-P8-10 | Spot-check sampler is **uniform**, not confidence-sorted ([EC-P8-02](edge-cases.md)) | uniform |
| EV-P8-11 | Drift-alarm baseline requires ≥ 3 runs before activating | enforced |
| EV-P8-12 | Confidence histogram variance is non-trivial | reported |

### Gate

- [ ] Max label drift ≤ 3pp; trackable-label list published
- [ ] Stability harness refuses cache-on
- [ ] Every presented finding scores > 3/8
- [ ] Discrimination rate ≥ 75%
- [ ] Opportunity-gate agreement ≥ 85%
- [ ] Deliberately weak corpus produces correct, specific gap text

---

# P9 — Production validation

**What becomes measurable.** The real thing. Everything prior used the seed corpus; this is the first run on a live Blinkit corpus, and the evals shift from *build-time* to *per-run*.

### Evals

| ID | Eval | Method | Threshold |
|---|---|---|---|
| EV-P9-01 | **Human spot-check** — top 3 themes × 10 random reviews each | manual, 30 min | ≥ 8/10 per theme |
| EV-P9-02 | Spot-check on top root cause and top segment | manual | recorded |
| EV-P9-03 | Cost reconciliation — actual vs. pre-flight | instrumented | ±15% |
| EV-P9-04 | Director readiness | engine self-grade | ≥ 6/10 |
| EV-P9-05 | Evidence-strength distribution | run report | ≥ 1 Strong |
| EV-P9-06 | **Thread-concentration check** | per-finding | < 40% single thread |
| EV-P9-07 | Curation funnel sanity vs. pilot ratios | run stats | ~4.5% end-to-end |
| EV-P9-08 | Per-source yield vs. expectation | run stats | within band |
| EV-P9-09 | Baselines established for drift alarms | ≥ 3 runs | recorded |

### EV-P9-01 in detail — sample uniformly, not conveniently

The dashboard's quote clusters are the top 5 **by confidence** — which makes them the most convenient thing to spot-check, and the rows the classifier found easiest. Agreement measured on them will beat true agreement by a wide margin, and the gap grows exactly as quality falls ([EC-P8-02](edge-cases.md)).

**Sample uniformly at random within each label.** It is less pleasant to read and it is the only number that means anything.

Expect `segment` at the low end — a grocery review rarely reveals household composition. That is why segment splits are presented as directional regardless of what the spot-check returns.

### EV-P9-06 in detail — independence, not just volume

Evidence strength grades a finding Strong at ≥20 reviews across ≥3 sources, assuming 20 *independent* observations. One Reddit thread can supply 40 comments that are one conversation ([EC-P9-03](edge-cases.md)).

Compute per-finding thread concentration and downgrade evidence strength above 40% single-thread share. Without this, the most valuable source is also the one most likely to manufacture a false Strong finding — on exactly the topics people argue about most.

### If readiness comes back low

The system working. The gap text names the fix:

| Gap | Action |
|---|---|
| *Limited exploration corpus depth* | Scrape more; weight Reddit and forums higher |
| *Insufficient mechanism-level findings* | Root causes collapsing to Unclear — strengthen detection signals in L1 |
| *Fewer than 3 strategic opportunities* | Check the rejection list; if rejections are correct, the corpus is too thin |
| Evidence strength all Weak | Single-source concentration — add **sources**, not reviews |

### Gate

- [ ] Spot-check ≥ 8/10 agreement per top theme, recorded
- [ ] Cost within ±15% of estimate
- [ ] Readiness ≥ 6/10, or a documented path to it
- [ ] No presented finding above 40% thread concentration
- [ ] Drift baselines recorded

---

# Consolidated gates

**Bold rows block release.**

| # | Metric | Threshold | Phase gate |
|---|---|---|---|
| 1 | Human IAA, `theme` | ≥ 85% | **P1** |
| 2 | Prefilter negative fixture | 0/20 false matches | **P1** |
| 3 | All ten invariants | pass | **P2** |
| 4 | Gold set quota compliance | 100% | P2 |
| 5 | Every model target ≤ measured IAA | pass | **P2** |
| 6 | **`exploration_relevant` agreement** | **≥ 90%** | **P3** |
| 7 | **`theme` agreement** | **≥ 80%** | **P3** |
| 8 | `barrier`, `unmet_need` agreement | ≥ 75% | P3 |
| 9 | **`root_cause` agreement** | **≥ 70%** | **P3** |
| 10 | `segment` agreement | ≥ 60% | Advisory — directional regardless |
| 11 | `theme` macro-F1 | ≥ 0.65 | P3 |
| 12 | `theme` Cohen's κ | ≥ 0.70 | P3 |
| 13 | **Coercion rate** | **< 5%** | **P3** |
| 14 | Filter 2 precision | ≥ 85% | P3 |
| 15 | **Cost-model accuracy** | **±15%** | **P3** |
| 16 | No recomputation in render path | exact | P4 |
| 17 | Quote resolution (I8) | 100% | P4 |
| 18 | **Filter 1 recall** | **≥ 90%** | **P5** |
| 19 | Filter 1 keep-rate, per source | 5–20% (Play Store) | P5 |
| 20 | Yield alarm fires on decay fixture | pass | P5 |
| 21 | **Fault routing** | **100%** | **P6** |
| 22 | **Zero re-spend on resume** | **exact** | **P6** |
| 23 | Export equivalence | exact | **P7** |
| 24 | CSV injection neutralized | 100% | P7 |
| 25 | Traceability | ≤ 2 clicks, 20/20 | P7 |
| 26 | Chat decline rate on unanswerable | ≥ 95% | P7 |
| 27 | Chat citation resolution | 100% | P7 |
| 28 | ECE | ≤ 0.10 | P8 |
| 29 | **Max label drift** | **≤ 3pp** | **P8 — gates the monthly cadence** |
| 30 | Rank stability | ≥ 0.85 | P8 |
| 31 | **Rubric score, presented findings** | **> 3 / 8 each** | **P8 — presentation** |
| 32 | **Discrimination rate** | **≥ 75%** | **P8 — presentation** |
| 33 | Opportunity-gate agreement | ≥ 85% | P8 |
| 34 | Spot-check agreement, top themes | ≥ 8/10 | **P9** |
| 35 | Thread concentration | < 40% | P9 |
| 36 | **Director readiness** | **≥ 6 / 10** | **P9 — presentation** |

### The code-mixed slice

Reported separately at every gate and **not** required to clear the same bars. The point is not to pass — it is to know the size of the gap and state it on every deck ([README §22](README.md)). Code-mixed `theme` agreement below 60% means every distribution should be read as English-skewed, explicitly.

---

# Cadence — what re-runs when

| Trigger | E1 | E2 | E3 | E4 | E5 |
|---|---|---|---|---|---|
| Every PR | — | — | — | — | unit + fault suite |
| Prompt change | full | — | — | — | cost model |
| **Taxonomy change** | **full, after gold re-adjudication** | full | **full** | — | — |
| Model or provider change | full | — | full | discrimination | full |
| Collector change | — | full incl. rejected sample | — | — | yield baseline |
| Prefilter change | — | **Filter 1 recall** | — | — | — |
| Before first monthly cadence | full | full | **full** | full | full |
| Monthly production run | spot-check | keep-rate check | — | rubric on presented findings | cost reconciliation |
| Quarterly | full | full incl. rejected sample | full | full | full |

**A taxonomy change is the heaviest trigger** — it invalidates gold labels, the classification cache, and cross-run comparability simultaneously. That cost is why the P1 gate exists and why it is worth 90 minutes of PM time.

---

# Interpreting a failure

Which metric fails tells you where to look. Fixing the wrong layer is the common waste.

| Failing metric | Phase | Most likely cause | Fix |
|---|---|---|---|
| Human IAA < 85% | P1 | Ambiguous taxonomy boundaries | **Rebuild the labels.** No model will beat the ceiling |
| Prefilter negative fixture fails | P1 | Substring matching without word boundaries | Compile with `\b`; declare stems explicitly |
| Invariant fails with mock classifier | P2 | Structural bug in aggregation | Fix now — it will not pass with a real classifier |
| Model agreement ≥ IAA | P3 | Gold-set contamination | Re-label a fresh sample independently |
| `theme` agreement low, κ **also** low | P3 | Genuinely poor classification | Sharpen detection signals; few-shot from gold |
| `theme` agreement low, κ **fine** | P3 | Skewed corpus, metric artifact | Read macro-F1; likely no action |
| One confusion pair dominates | P3 | Ambiguous boundary | **Fix the taxonomy**, not the prompt |
| `root_cause` low, `theme` fine | P3 | Mechanism inference is the hard part | More detection signals; consider a two-model cascade |
| Coercion rate rising | P3 | Prompt/array drift, or silent model upgrade | Verify `formatTaxonomyForPrompt()`; pin the model |
| ECE high | P3/P8 | Confidence is decorative | Stop using confidence gates until fixed |
| Dashboard ≠ persisted value | P4 | Recomputation in the render path | Remove it; render from stored fields only |
| Filter 1 recall low | P5 | Prefilter too narrow | Add terms; re-measure on the rejected sample |
| Yield alarm silent on decay fixture | P5 | Alarm wired to errors, not yield | Alarm on **yield** |
| Per-day quota retried | P6 | Recoverable/fatal misclassification | One-line fix; costs a day of runtime unfixed |
| Export figures disagree | P7 | One serializer recomputes | Both must read the persisted report |
| Chat confabulates | P7 | Grounding instruction too weak | Delimit corpus as quoted data; require citations |
| Label drift high | P8 | Ambiguous boundary **or** low determinism | Fix taxonomy first; only then consider temperature |
| Rubric low, evidence fine | P8 | Synthesis under-performing | Check mechanism narratives and severity weights |
| **Discrimination ≈ chance** | P8 | **Synthesis adds nothing** | Rebuild the mechanism layer, or drop it and ship aggregation |
| Spot-check < 8/10 | P9 | Real accuracy below gold-set accuracy | Corpus has drifted from the gold set — refresh it |
| Readiness < 6 | P9 | Corpus too thin or single-sourced | Follow the gap text |

---

# Limitations of this evaluation

Stated plainly, because an evaluation that oversells itself is worse than none.

- **The gold set is 100 reviews.** Per-field confidence intervals are roughly ±8pp at n=100. Treat a 3pp agreement movement as noise.
- **Two annotators are not a panel.** IAA is the ceiling, measured by the same two people who wrote the taxonomy. Both share its blind spots.
- **The gold set mirrors the corpus's English skew.** The code-mixed quota (15) makes the gap *visible*; it does not make the measurement representative of non-English-first customers.
- **P8 raters are not blind to the project.** The discrimination test controls for this partially; the rubric does not.
- **No external benchmark.** Nothing here says the engine beats a good analyst reading 200 reviews by hand. It says the output is internally consistent, traceable, and reproducible.
- **Stability ≠ validity.** A consistently wrong classifier scores perfectly at P8. E3 gates *trend-reading*, not correctness — P3 does that.
- **Per-run evals (P9) are sampled, not exhaustive.** A 30-minute spot-check on 30 reviews cannot certify 200.
- **None of this measures whether the findings are true of Blinkit customers**, only whether they are true of what people wrote publicly. That gap is a property of review research, not of this engine, and it is why [README §22](README.md) insists on pairing with behavioural telemetry.

---

# Scorecard

Emitted by `npm run eval:all` — skeleton created at **P0**, rows filled as phases close. Versioned per run and attached to any release of findings.

```
REVIEWLENS EVALUATION SCORECARD
run: <eval-id>          date: <date>
corpus: <name>          taxonomy: v<n>          model: <provider>/<model>
gold set: v<n> (100 reviews)          phases closed: P0–P<n>

P1 TAXONOMY                               value   gate    status
  human IAA — theme                        ——%   ≥85%      —
  prefilter positive fixture               ——/20  20/20    —
  prefilter negative fixture               ——/20  0/20     —
  prompt token budget                      ——    ≤1800     —

P2 DETERMINISTIC LAYERS
  invariants passing                       ——/10  10/10    —
  aggregation vs hand-computed             ——    exact     —
  gold-set quota compliance                ——%   100%      —
  gold-set IAA — theme                     ——%   report    —

P3 CLASSIFICATION
  exploration_relevant agreement           ——%   ≥90%      —
  theme agreement                          ——%   ≥80%      —
  barrier / unmet_need agreement           ——%   ≥75%      —
  root_cause agreement                     ——%   ≥70%      —
  segment agreement                        ——%   ≥60%      —  (advisory)
  theme macro-F1                           ——    ≥0.65     —
  theme Cohen's κ                          ——    ≥0.70     —
  coercion rate                            ——%   <5%       —
  ECE                                      ——    ≤0.10     —
  model agreement ≤ IAA                    ——    pass      —
  cost-model accuracy                      ——%   ±15%      —
  ── slice: code-mixed, theme              ——%   report    —

P4 PERSISTENCE
  round-trip deep-equal                    ——    exact     —
  zero recomputation in render             ——    pass      —
  quote resolution (I8)                    ——%   100%      —

P5 COLLECTION
  Filter 1 recall                          ——%   ≥90%      —
  Filter 1 keep-rate (Play Store)          ——%   5–20%     —
  yield alarm on decay fixture             ——    fires     —
  Filter 2 precision                       ——%   ≥85%      —
  too_short share of exclusions            ——%   <40%      —

P6 RESILIENCE & ECONOMICS
  fault routing                            ——%   100%      —
  zero re-spend on resume                  ——    exact     —
  per-day quota attempts                   ——    1         —

P7 OUTPUT FIDELITY
  export equivalence                       ——    exact     —
  CSV injection neutralized                ——%   100%      —
  traceability (20 sampled)                ——/20  20/20    —
  chat decline on unanswerable             ——%   ≥95%      —
  chat citation resolution                 ——%   100%      —

P8 STABILITY & INSIGHT                (cache disabled — verified)
  max label drift                          ——pp  ≤3pp      —
  mean absolute deviation                  ——pp  ≤1.5pp    —
  rank stability (Spearman)                ——    ≥0.85     —
  trackable labels                         ——/——  report   —
  mean rubric score                        ——/8  >3 each   —
  discrimination rate                      ——%   ≥75%      —
  opportunity-gate agreement               ——%   ≥85%      —

P9 PRODUCTION
  spot-check agreement (top themes)        ——/10  ≥8/10    —
  cost reconciliation                      ——%   ±15%      —
  thread concentration (max)               ——%   <40%      —
  director readiness                       ——/10  ≥6       —

VERDICT: ____________________________________________
BLOCKING FAILURES: __________________________________
NOT YET MEASURED: ___________________________________
```

---

*Three rules hold this together. Measure each layer at the earliest phase where it becomes measurable — the human ceiling at P1 is worth more than any metric at P8. Report per field, never blended, because an average hides the one field you need to see. And publish the failures: a scorecard with no red rows usually means the thresholds are too low, not that the system is perfect.*
