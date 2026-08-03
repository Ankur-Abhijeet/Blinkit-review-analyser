export const RESEARCH_QUESTION_IDS = [
  'why_exploration_fails',
  'top_frustrations',
  'shopping_behaviors',
  'repeat_purchase_causes',
  'segment_challenges',
  'unmet_needs',
] as const

export type ResearchQuestionId = (typeof RESEARCH_QUESTION_IDS)[number]

export const RESEARCH_QUESTION_LABELS: Record<ResearchQuestionId, string> = {
  why_exploration_fails: 'What prevents users from exploring new categories?',
  top_frustrations: 'What frustrations emerge repeatedly?',
  shopping_behaviors: 'How do users discover products today?',
  repeat_purchase_causes:
    'Why do users repeatedly buy from the same categories? What role do habits play?',
  segment_challenges: 'Which user segments are more likely to experiment?',
  unmet_needs:
    'What information do users need before trying a new category? What unmet needs emerge consistently?',
}

export function formatResearchQuestionsForPrompt(): string {
  return RESEARCH_QUESTION_IDS.map(
    (id) => `- ${id}: ${RESEARCH_QUESTION_LABELS[id]}`,
  ).join('\n')
}
