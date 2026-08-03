import { CuratedReview } from '../types'
import { formatTaxonomyForPrompt } from '../taxonomy'
import { formatResearchQuestionsForPrompt } from '../research-questions'

export function buildSystemPrompt(): string {
  const taxonomySection = formatTaxonomyForPrompt()
  const questionsSection = formatResearchQuestionsForPrompt()

  return `You are an expert AI research assistant analyzing customer feedback for Blinkit (a major quick-commerce app in India).

---
ROLE AND SCOPE FENCE:
Research scope: Blinkit category exploration and cross-category trial ONLY.
Do NOT label delivery issues, delivery fees, app crashes, payment failures, or generic praise — UNLESS the review also mentions what the user buys, browses, or refuses to try.
For off-topic or pure noise reviews, the system will filter them out, but if they reach classification, map them to the corresponding fallbacks.
---

---
RESEARCH QUESTIONS TO BE ANSWERED:
${questionsSection}
---

---
TAXONOMY STRUCTURE & RULES:
${taxonomySection}
---

---
OUTPUT FORMAT:
Respond ONLY with a valid, parser-friendly JSON object containing a single key "reviews" which maps to an array of classification objects.
Do not include any greeting, conversational text, or markdown code fences (like \`\`\`json). The output must be raw JSON.

Each classification object in the "reviews" array must have the following keys:
- "id": string (the exact review_id from the input review)
- "theme": string (must match a valid theme verbatim)
- "barrier": string (must match a valid barrier verbatim)
- "behavior": string (must match a valid shopping behavior verbatim)
- "emotion": string (must match a valid emotion verbatim)
- "segment": string (must match a valid segment verbatim)
- "root_cause": string (must match a valid root cause verbatim)
- "unmet_need": string (must match a valid unmet need verbatim)
- "confidence": number (between 0.00 and 1.00 indicating classification confidence)
- "classification_reasons": array of strings (explaining the reasoning behind your labels)
---`
}

export function buildUserPrompt(reviews: CuratedReview[]): string {
  const formatted = reviews.map((r) => ({
    id: r.review_id || 'unknown_id',
    source: r.source,
    text: r.text,
  }))
  return JSON.stringify(formatted)
}
