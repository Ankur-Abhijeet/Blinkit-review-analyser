import { describe, it, expect } from 'vitest'
import {
  POSITIVE_THEMES,
  NEGATIVE_THEMES,
  BARRIERS,
  SHOPPING_BEHAVIORS,
  EMOTIONS,
  SEGMENTS,
  ROOT_CAUSES,
  UNMET_NEEDS,
  THEME_MEANINGS,
  BARRIER_MEANINGS,
  ROOT_CAUSE_IMPLICATIONS,
  UNMET_NEED_INTERVENTIONS,
  OTHER_UNKNOWN_LABELS,
  formatTaxonomyForPrompt,
} from '../taxonomy'
import { isExplorationRelevant } from '../collectors/keyword-filter'

describe('Phase 1 Taxonomy & L1 Integrity', () => {
  const ALL_ARRAYS = [
    { name: 'POSITIVE_THEMES', items: POSITIVE_THEMES },
    { name: 'NEGATIVE_THEMES', items: NEGATIVE_THEMES },
    { name: 'BARRIERS', items: BARRIERS },
    { name: 'SHOPPING_BEHAVIORS', items: SHOPPING_BEHAVIORS },
    { name: 'EMOTIONS', items: EMOTIONS },
    { name: 'SEGMENTS', items: SEGMENTS },
    { name: 'ROOT_CAUSES', items: ROOT_CAUSES },
    { name: 'UNMET_NEEDS', items: UNMET_NEEDS },
  ]

  it('EV-P1-01: Array integrity — all 8 arrays non-empty, no duplicates within an array', () => {
    for (const { name, items } of ALL_ARRAYS) {
      expect(items.length, `${name} should not be empty`).toBeGreaterThan(0)
      const unique = new Set(items)
      expect(unique.size, `${name} should have no duplicates`).toBe(items.length)
    }
  })

  it('EV-P1-02: Disjointness — POSITIVE_THEMES ∩ NEGATIVE_THEMES = ∅', () => {
    const posSet = new Set<string>(POSITIVE_THEMES)
    for (const neg of NEGATIVE_THEMES) {
      expect(posSet.has(neg), `Theme "${neg}" exists in both positive and negative sets`).toBe(false)
    }
  })

  it('EV-P1-03: Meaning coverage — every theme, barrier, and root cause has a meaning string', () => {
    for (const theme of [...POSITIVE_THEMES, ...NEGATIVE_THEMES]) {
      expect(THEME_MEANINGS[theme], `Missing meaning for theme "${theme}"`).toBeDefined()
      expect(THEME_MEANINGS[theme].length).toBeGreaterThan(5)
    }
    for (const barrier of BARRIERS) {
      expect(BARRIER_MEANINGS[barrier], `Missing meaning for barrier "${barrier}"`).toBeDefined()
      expect(BARRIER_MEANINGS[barrier].length).toBeGreaterThan(5)
    }
  })

  it('EV-P1-04: Intervention coverage — every root cause has an implication; every unmet need an intervention', () => {
    for (const rc of ROOT_CAUSES) {
      expect(ROOT_CAUSE_IMPLICATIONS[rc], `Missing implication for root cause "${rc}"`).toBeDefined()
      expect(ROOT_CAUSE_IMPLICATIONS[rc].length).toBeGreaterThan(5)
    }
    for (const need of UNMET_NEEDS) {
      expect(UNMET_NEED_INTERVENTIONS[need], `Missing intervention for unmet need "${need}"`).toBeDefined()
      expect(UNMET_NEED_INTERVENTIONS[need].length).toBeGreaterThan(5)
    }
  })

  it('EV-P1-05: Unknown registry — every OTHER_UNKNOWN_LABELS member exists in exactly one taxonomy array', () => {
    const allItems = ALL_ARRAYS.flatMap((a) => a.items as readonly string[])
    for (const unknownLabel of OTHER_UNKNOWN_LABELS) {
      const occurrences = allItems.filter((item) => item === unknownLabel).length
      expect(
        occurrences,
        `Unknown label "${unknownLabel}" should exist in exactly 1 array, found ${occurrences}`,
      ).toBe(1)
    }
  })

  it('EV-P1-07: Prompt completeness — formatTaxonomyForPrompt() contains every single label verbatim', () => {
    const promptText = formatTaxonomyForPrompt()
    for (const { name, items } of ALL_ARRAYS) {
      for (const item of items) {
        expect(
          promptText.includes(item),
          `Prompt string missing label "${item}" from ${name}`,
        ).toBe(true)
      }
    }
  })

  it('EV-P1-08: Prompt budget — prompt block <= ~1,800 tokens (~7,200 chars)', () => {
    const promptText = formatTaxonomyForPrompt()
    // 1 token ~ 4 chars approximation
    const approxTokens = Math.ceil(promptText.length / 4)
    expect(approxTokens, `Prompt token estimate (${approxTokens}) exceeds 1,800 token budget`).toBeLessThanOrEqual(1800)
  })

  it('EV-P1-10: Substring fixture for prefilter — negative traps vs positive matches', () => {
    const NEGATIVE_TRAPS = [
      'bad support',
      'too much competition',
      'petrol bunk',
      'fabric care',
    ]

    const POSITIVE_MATCHES = [
      'love the dog food options',
      'great pet supplies selection',
      'good variety of baby care items',
      'expensive price for fresh veggies',
      'hard to discover new categories',
      'need to explore more snacks',
      'cannot browse through aisles',
    ]

    for (const trap of NEGATIVE_TRAPS) {
      expect(
        isExplorationRelevant(trap),
        `Prefilter falsely matched substring trap: "${trap}"`,
      ).toBe(false)
    }

    for (const positive of POSITIVE_MATCHES) {
      expect(
        isExplorationRelevant(positive),
        `Prefilter failed to match relevant review: "${positive}"`,
      ).toBe(true)
    }
  })
})
