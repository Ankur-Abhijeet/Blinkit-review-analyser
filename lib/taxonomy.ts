// ── 9.1 Themes — positive (5) ──────────────────────────────
export const POSITIVE_THEMES = [
  'Successful Category Trial',
  'Strong Cross-Category Discovery',
  'Assortment Delight',
  'Reliable First-Time Purchase',
  'Useful Bundling',
] as const

export type PositiveTheme = (typeof POSITIVE_THEMES)[number]

// ── 9.2 Themes — negative (11 + 1 fallback) ───────────────
export const NEGATIVE_THEMES = [
  'Basket Habit Lock-In',
  'Poor Category Discoverability',
  'Search-Only Shopping',
  'Irrelevant Recommendations',
  'Trust Gap on Non-Grocery',
  'Quality Uncertainty',
  'Price Comparison Friction',
  'Assortment Blind Spots',
  'Reorder Tunnel Vision',
  'Category Navigation Overload',
  'Promo Noise',
  'Other Exploration Frustration',
] as const

export type NegativeTheme = (typeof NEGATIVE_THEMES)[number]

export const THEMES = [...POSITIVE_THEMES, ...NEGATIVE_THEMES] as const
export type Theme = (typeof THEMES)[number]

// ── 9.3 Barriers — Q1 (7 + 1 fallback) ────────────────────
export const BARRIERS = [
  'Low Category Awareness',
  'No Trigger to Explore',
  'Trust Deficit on New Category',
  'Price or Quality Uncertainty',
  'Reorder Shortcut Dominance',
  'Buried Category Entry Points',
  'Cold Start for New Users',
  'Unclear Exploration Struggle',
] as const

export type Barrier = (typeof BARRIERS)[number]

// ── 9.4 Shopping behaviors — Q3 (7) ────────────────────────
export const SHOPPING_BEHAVIORS = [
  'Reorder Previous Basket',
  'Search for a Known Item',
  'Browse Category Aisles',
  'Respond to Home-Feed Recommendations',
  'Shop a Use-Case or Occasion',
  'Compare Prices Across Apps',
  'Impulse Add-On at Checkout',
] as const

export type ShoppingBehavior = (typeof SHOPPING_BEHAVIORS)[number]

// ── 9.5 Emotions — Q2 (6) ──────────────────────────────────
export const EMOTIONS = [
  'Frustration',
  'Disappointment',
  'Distrust',
  'Hesitation',
  'Curiosity',
  'Neutral',
] as const

export type Emotion = (typeof EMOTIONS)[number]

// ── 9.6 Segments — Q5 (5 + 1 fallback) ─────────────────────
// Mutually exclusive behavioral segments (covering 100% of quick-commerce user intentions, max 5 active categories)
export const SEGMENTS = [
  'Habitual Replenisher',
  'Impulse & Emergency Shopper',
  'Household & Pantry Planner',
  'Value & Deal Seeker',
  'Exploratory & Premium Trialist',
  'Unspecified Segment',
] as const

export type Segment = (typeof SEGMENTS)[number]

// ── 9.7 Root causes — Q4 (9 + 1 fallback) ─────────────────
export const ROOT_CAUSES = [
  'Reorder-Surface Dominance',
  'Search-First Interaction Loop',
  'Recommendation Similarity Reinforcement',
  'Buried Category Entry Points',
  'Information Gap Blocks Trust',
  'No Low-Risk Trial Mechanism',
  'Basket-Completion Optimization Bias',
  'Promo-Led Ranking Bias',
  'Delivery-Speed Framing',
  'Unclear Repeat-Purchase Cause',
] as const

export type RootCause = (typeof ROOT_CAUSES)[number]

// ── 9.8 Unmet needs — Q6 (8 + 1 fallback) ──────────────────
export const UNMET_NEEDS = [
  'Trial-Sized First Purchase',
  'Category Explainers and Trust Signals',
  'Occasion-Based Bundles',
  'Transparent Quality Information',
  'Cross-Category Nudges at the Right Moment',
  'Return and Refund Confidence',
  'Personalized New-Category Suggestions',
  'Better Category Navigation',
  'General Discovery Improvement',
] as const

export type UnmetNeed = (typeof UNMET_NEEDS)[number]

// ── Meaning-string maps for finding narratives ─────────────
export const THEME_MEANINGS: Record<Theme, string> = {
  'Successful Category Trial':
    'the user tried an unfamiliar category and the purchase met expectations',
  'Strong Cross-Category Discovery':
    'home feed, search, or recommendations successfully introduced a category the user hadn’t bought',
  'Assortment Delight': 'the user was surprised by the breadth of catalog available',
  'Reliable First-Time Purchase':
    'a first order in a new category arrived at expected quality and built confidence',
  'Useful Bundling':
    'occasion or use-case bundles pulled the user into a multi-category basket',
  'Basket Habit Lock-In':
    'users reorder a fixed basket and never encounter other categories',
  'Poor Category Discoverability':
    'categories exist on the platform but users never see them in their journey',
  'Search-Only Shopping':
    'users interact only through search, so they can only find what they already intended to buy',
  'Irrelevant Recommendations':
    'recommended items mirror the existing basket instead of expanding it',
  'Trust Gap on Non-Grocery':
    'users doubt the platform for pet, baby, personal care, or electronics categories',
  'Quality Uncertainty':
    'fresh and perishable quality is unknowable before purchase, so users don’t risk it',
  'Price Comparison Friction':
    'users leave to compare prices elsewhere and complete the basket on another app',
  'Assortment Blind Spots': 'users are unaware the platform stocks a category at all',
  'Reorder Tunnel Vision':
    'reorder and "buy again" shortcuts dominate the interface and bypass discovery',
  'Category Navigation Overload':
    'aisle structure and information architecture defeat browsing',
  'Promo Noise': 'discount and offer clutter drowns out category signals',
  'Other Exploration Frustration':
    'exploration pain points remain diffuse without a clear product surface to address',
}

export const BARRIER_MEANINGS: Record<Barrier, string> = {
  'Low Category Awareness':
    'users do not know the category is available on the platform',
  'No Trigger to Explore':
    'nothing in the shopping journey prompts a visit to an unfamiliar category',
  'Trust Deficit on New Category':
    'users do not yet trust the platform to deliver this category well',
  'Price or Quality Uncertainty':
    'users lack the information needed to risk a first purchase',
  'Reorder Shortcut Dominance':
    'the fastest path through the app bypasses discovery entirely',
  'Buried Category Entry Points':
    'category tiles and aisles sit below the fold or behind secondary menus',
  'Cold Start for New Users':
    'new or low-tenure users cannot escape a generic home feed quickly enough',
  'Unclear Exploration Struggle':
    'users express exploration frustration without naming a specific product failure mode',
}

export const SHOPPING_BEHAVIOR_NARRATIVES: Record<ShoppingBehavior, string> = {
  'Reorder Previous Basket':
    'Users rebuild the same basket each week, which makes the reorder surface the single highest-leverage place to introduce a new category',
  'Search for a Known Item':
    'Users arrive with intent and type it in — discovery never enters the session unless search results carry it',
  'Browse Category Aisles':
    'Users who browse are the platform’s most exploratory cohort, but report that aisle structure works against them',
  'Respond to Home-Feed Recommendations':
    'Users treat the home feed as the platform’s suggestion surface and judge assortment by what appears there',
  'Shop a Use-Case or Occasion':
    'Users shopping an occasion naturally cross categories — the strongest existing bridge into unfamiliar aisles',
  'Compare Prices Across Apps':
    'Users price-check against competing apps mid-basket, and often complete the order wherever the comparison lands',
  'Impulse Add-On at Checkout':
    'Users accept last-moment additions when they are cheap and contextually relevant, making checkout a low-risk trial surface',
}

export const ROOT_CAUSE_MECHANISMS: Record<RootCause, string> = {
  'Reorder-Surface Dominance':
    '"Buy again" and past-order rails occupy the primary surface, so a returning user completes a basket without ever encountering an unfamiliar category',
  'Search-First Interaction Loop':
    'Users interact almost exclusively through search, so the catalog is only as discoverable as the user’s existing vocabulary',
  'Recommendation Similarity Reinforcement':
    'The recommender is trained on basket history, so it converges on the categories the user already buys and shrinks the exposure set over time',
  'Buried Category Entry Points':
    'Category tiles sit below the fold or behind secondary navigation, so users never encounter them at browsing speed',
  'Information Gap Blocks Trust':
    'Users will not risk a first purchase in an unfamiliar category without sourcing, freshness, expiry, or rating information the app does not display',
  'No Low-Risk Trial Mechanism':
    'The smallest available pack and an unclear returns path make a first purchase feel disproportionately risky',
  'Basket-Completion Optimization Bias':
    'Ranking optimizes for fast basket completion and conversion, so it serves high-confidence familiar SKUs rather than introducing anything new',
  'Promo-Led Ranking Bias':
    'Discount-driven merchandising occupies the surfaces that would otherwise introduce categories',
  'Delivery-Speed Framing':
    'The 10-minute promise frames the app as an errand tool for known needs, not a destination for browsing',
  'Unclear Repeat-Purchase Cause':
    'Users perceive their own repetition but cannot attribute it to a product behavior, suggesting several mechanisms compound invisibly',
}

export const ROOT_CAUSE_IMPLICATIONS: Record<RootCause, string> = {
  'Reorder-Surface Dominance':
    'Reserve guaranteed slots in the reorder flow for one contextually relevant new-category item, measured on trial rate rather than basket value',
  'Search-First Interaction Loop':
    'Introduce category bridges in search results and zero-result states; surface adjacent aisles on every query',
  'Recommendation Similarity Reinforcement':
    'Add explicit new-category exposure targets to ranking, decoupled from basket-similarity scoring',
  'Buried Category Entry Points':
    'Rebuild home-feed information architecture around rotating category entry points with placement guarantees',
  'Information Gap Blocks Trust':
    'Ship category-specific trust panels — expiry windows, sourcing, brand context, and product ratings on every non-grocery PDP',
  'No Low-Risk Trial Mechanism':
    'Introduce trial packs, sample sizes, and a visible first-purchase guarantee for new-to-user categories',
  'Basket-Completion Optimization Bias':
    'Establish a category-breadth objective separate from conversion rate and optimize the home feed against it',
  'Promo-Led Ranking Bias':
    'Cap promotional density on discovery surfaces and reserve inventory for category introduction',
  'Delivery-Speed Framing':
    'Create a distinct browsing mode with its own entry point and expectations, separate from the express-restock flow',
  'Unclear Repeat-Purchase Cause':
    'Instrument category-exposure and repeat-basket telemetry so teams can identify which loop dominates per cohort',
}

export const UNMET_NEED_INTERVENTIONS: Record<UnmetNeed, string> = {
  'Trial-Sized First Purchase':
    'Introduce trial packs and sample sizes priced for a zero-regret first purchase in new-to-user categories',
  'Category Explainers and Trust Signals':
    'Add category landing experiences with sourcing, brand, and quality context before the user commits',
  'Occasion-Based Bundles':
    'Build occasion and use-case bundles that span categories, using events as the natural cross-category bridge',
  'Transparent Quality Information':
    'Display expiry windows, freshness guarantees, and sourcing detail on perishable and non-grocery SKUs',
  'Cross-Category Nudges at the Right Moment':
    'Place contextual new-category prompts at cart, checkout, and post-order — the lowest-friction moments in the journey',
  'Return and Refund Confidence':
    'Make first-purchase returns visibly effortless for new-to-user categories to remove the downside risk',
  'Personalized New-Category Suggestions':
    'Ship category-level personalization with explicit novelty targets, not SKU-level similarity',
  'Better Category Navigation':
    'Rebuild aisle information architecture around shopper mental models rather than internal merchandising structure',
  'General Discovery Improvement':
    'Establish a category-breadth quality metric distinct from conversion and optimize discovery surfaces against it',
}

// ── 9.9 The unknown-label registry ─────────────────────────
export const OTHER_UNKNOWN_LABELS = new Set<string>([
  'Other Exploration Frustration',
  'Unclear Exploration Struggle',
  'Unspecified Segment',
  'Unclear Repeat-Purchase Cause',
  'General Discovery Improvement',
])

export const NON_RESEARCH_FALLBACK = {
  theme: 'Other Exploration Frustration' as Theme,
  barrier: 'Unclear Exploration Struggle' as Barrier,
  behavior: 'Search for a Known Item' as ShoppingBehavior,
  emotion: 'Neutral' as Emotion,
  segment: 'Unspecified Segment' as Segment,
  root_cause: 'Unclear Repeat-Purchase Cause' as RootCause,
  unmet_need: 'General Discovery Improvement' as UnmetNeed,
}

// ── Helper guards ──────────────────────────────────────────
export function isPositiveTheme(theme: string): theme is PositiveTheme {
  return POSITIVE_THEMES.includes(theme as PositiveTheme)
}

export function isNegativeTheme(theme: string): theme is NegativeTheme {
  return NEGATIVE_THEMES.includes(theme as NegativeTheme)
}

export function isRootCauseEligibleReview(theme: string): boolean {
  return !isPositiveTheme(theme)
}

// ── Regex patterns for synthesis validators ────────────────
export const GENERIC_BLOCKLIST =
  /\b(improve|better|optimize|enhance|streamline|good|nice|help|make it|fix|change|update)\b/i

export const BUILDABLE =
  /\b(button|card|modal|badge|filter|tab|rail|banner|flow|checkout|cart|search|prompt|carousel|drawer|feed|nudge|panel|picker|slot|toggle|pdp|widget|grid|list)\b/i

// ── 3.2 Prompt construction ────────────────────────────────
export function formatTaxonomyForPrompt(): string {
  return `Research scope: Blinkit category exploration and product discovery ONLY.
Do NOT label delivery speed, delivery charges, surge/handling fees, app crashes,
payment failures, refunds-in-progress, or generic app praise — UNLESS the review
ALSO says something about what the user buys, browses, or won't try.

Choose EXACTLY ONE value per field from the allowed lists below.
If none fit perfectly, choose the CLOSEST valid value. Never invent labels.

POSITIVE THEMES — successful exploration (use when the user praises finding or trying something new):
${POSITIVE_THEMES.map((t) => `- ${t}`).join('\n')}

NEGATIVE THEMES — exploration friction (never use for praise):
${NEGATIVE_THEMES.filter((t) => t !== 'Other Exploration Frustration')
  .map((t) => `- ${t}`)
  .join('\n')}
THEME FALLBACK (negative unclear only — NEVER for positive reviews): Other Exploration Frustration

BARRIERS (Q1):
${BARRIERS.map((b) => `- ${b}`).join('\n')}

SHOPPING BEHAVIORS (Q3):
${SHOPPING_BEHAVIORS.map((b) => `- ${b}`).join('\n')}

EMOTIONS (Q2):
${EMOTIONS.map((e) => `- ${e}`).join('\n')}

SEGMENT SELECTION (Q5):
Choose ONE primary segment using behavioral evidence. Copy label exactly:
${SEGMENTS.map((s) => `- ${s}`).join('\n')}
If ambiguous but the review describes a shopping pattern, default to "Habitual Replenisher".
Use "Unspecified Segment" ONLY when the review contains zero behavioral signals.

ROOT CAUSE DETECTION SIGNALS (Q4):
Use "Unclear Repeat-Purchase Cause" in fewer than 5% of research reviews — only when
no repeat-purchase or discovery mechanism is inferable at all.

MANDATORY: Every repeat-purchase-related review (Basket Habit Lock-In, Reorder Tunnel
Vision, Search-Only Shopping, or clear "I only buy X" signals) MUST receive a root cause.
If confidence is below 70%, assign the closest mechanism and note low confidence in
classification_reasons — never default to Unclear.

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
UNMET NEEDS (Q6):
Prefer specific needs. Use General Discovery Improvement only as last resort.
${UNMET_NEEDS.map((n) => `- ${n}`).join('\n')}`
}

// ── Broader theme mapping for matrix aggregation ───────────
export const BROADER_THEME_MAP: Record<string, string> = {
  'Poor Category Discoverability': 'Discoverability & Search Navigation',
  'Search-Only Shopping': 'Discoverability & Search Navigation',
  'Category Navigation Overload': 'Discoverability & Search Navigation',
  'Trust Gap on Non-Grocery': 'Assortment, Quality & Trust',
  'Quality Uncertainty': 'Assortment, Quality & Trust',
  'Assortment Blind Spots': 'Assortment, Quality & Trust',
  'Basket Habit Lock-In': 'Reorder & Habit Lock-In',
  'Reorder Tunnel Vision': 'Reorder & Habit Lock-In',
  'Successful Category Trial': 'Trial & Category Delight',
  'Strong Cross-Category Discovery': 'Trial & Category Delight',
  'Assortment Delight': 'Trial & Category Delight',
  'Reliable First-Time Purchase': 'Trial & Category Delight',
  'Useful Bundling': 'Trial & Category Delight',
  'Price Comparison Friction': 'Other Exploration Frustration',
  'Irrelevant Recommendations': 'Other Exploration Frustration',
  'Promo Noise': 'Other Exploration Frustration',
  'Other Exploration Frustration': 'Other Exploration Frustration',
}
