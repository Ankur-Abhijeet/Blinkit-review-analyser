import { ResearchQuestionId } from './research-questions'
import { Theme, Barrier, ShoppingBehavior, Emotion, Segment, RootCause, UnmetNeed } from './taxonomy'

export type SourceId =
  | 'appstore'
  | 'playstore'
  | 'reddit'
  | 'forums'
  | 'social'
  | 'product_reviews'
  | 'quickcommerce'
  | string

export type RawReview = {
  source: SourceId
  text: string
  review_id?: string
  rating?: number
  date?: string
  city?: string
  url?: string
  author_hash?: string
}

export type CuratedReview = RawReview & {
  exploration_relevant: boolean
  noise_category?:
    | 'not_exploration_related'
    | 'too_short'
    | 'generic_praise'
    | 'delivery'
    | 'pricing_fees'
    | 'app_bug'
    | 'payment'
    | 'customer_support'
    | 'off_topic'
  outcome?: 'successful' | 'failed' | 'unclear'
  user_goal?: string
}

export type CurationStats = {
  loaded: number
  unique: number
  duplicatesRemoved: number
  sentToClassification: number
  excluded: number
  excludedByCategory: Record<string, number>
}

export type CurationResult = {
  included: CuratedReview[]
  records: CuratedReview[]
  stats: CurationStats
}

export type ClassifiedReview = CuratedReview & {
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
  confidence: number // 0..1
  classification_reasons: string[]
}

export type LabelStat = {
  count: number
  pct: number
}

export type CrossTab = {
  rows: string[]
  cols: string[]
  cells: Record<string, Record<string, LabelStat>>
}

export type Quote = {
  review_id: string
  source: string
  text: string
  segment: string
  theme: string
  confidence: number
  barrier: string
  root_cause: string
  unmet_need: string
}

export type QuoteCluster = {
  label: string
  count: number
  pct: number
  quotes: Quote[]
}

export type Aggregation = {
  totalReviews: number
  explorationRelevantCount: number
  excludedCount: number
  themes: Record<Theme, LabelStat>
  barriers: Record<Barrier, LabelStat>
  behaviors: Record<ShoppingBehavior, LabelStat>
  emotions: Record<Emotion, LabelStat>
  segments: Record<Segment, LabelStat>
  rootCauses: Record<RootCause, LabelStat> // scoped to repeat-purchase-related reviews
  unmetNeeds: Record<UnmetNeed, LabelStat>
  categoryMentions: Record<string, LabelStat>
  segmentByTheme: CrossTab
  themeQuotes: QuoteCluster[]
  rootCauseQuotes: QuoteCluster[]
  unmetNeedQuotes: QuoteCluster[]
  sourceDistribution: Record<SourceId, number>
}

export type Finding = {
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

export type Opportunity = {
  id: string
  problem: string
  current_user_behavior: string
  root_cause: string
  blinkit_opportunity: string
  size: 'Large' | 'Medium' | 'Small'
  opportunity_score: number
  impact_score: number
  frequency_score: number
  confidence_score: number
  supporting_reviews: number
  affected_segments: string[]
  representative_quotes: Quote[]
  related_finding_id: string
}

export type Slide = {
  headline: string
  review_count: number
  quote: string
  implication: string
  action: string
}

export type ResearchAnswer = {
  question: string
  answer: string
  keyMetric: string
  supportingCount: number
  quote?: Quote
}

export type ExecutiveReport = {
  summary: string
  behaviors: string
  segmentDifferences: string
  unmetNeeds: string
  researchAnswers?: Record<string, ResearchAnswer>
  opportunities: Opportunity[]
  rejectedOpportunities: Opportunity[]
  slides: Slide[]
  readinessScore: number
  readinessGaps: string[]
}

export type Run = {
  id: string
  seq: number
  dataset_name: string
  status: 'completed' | 'queued' | 'failed'
  created_at: string
  total_reviews: number
  exploration_relevant_count: number
  excluded_count: number
  source_mix: Record<SourceId, number>
  fetch_params: Record<string, unknown>
  curation_stats: CurationStats
  aggregation: Aggregation
  findings: Finding[]
  executive_report: ExecutiveReport
  readiness_score: number
  readiness_gaps: string[]
  taxonomy_version: string
  model: string
  provider: string
  mock: boolean
  environment: 'prod' | 'staging' | 'local'
}
