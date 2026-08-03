/**
 * Schema for ReviewLens persistence (PostgreSQL).
 *
 * Kept as a TypeScript module rather than a .sql file read at runtime so the
 * statements are bundled with the service — the source tree is not guaranteed
 * to be present at process.cwd() in a deployed build.
 *
 * `seq` is BIGINT because it holds Date.now() values, which overflow INTEGER.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    seq BIGINT NOT NULL,
    dataset_name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    total_reviews INTEGER NOT NULL,
    exploration_relevant_count INTEGER NOT NULL,
    excluded_count INTEGER NOT NULL,
    source_mix TEXT NOT NULL,
    fetch_params TEXT NOT NULL,
    curation_stats TEXT NOT NULL,
    aggregation TEXT NOT NULL,
    findings TEXT NOT NULL,
    executive_report TEXT NOT NULL,
    readiness_score DOUBLE PRECISION NOT NULL,
    readiness_gaps TEXT NOT NULL,
    taxonomy_version TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    mock INTEGER NOT NULL,
    environment TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS run_reviews (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    source TEXT NOT NULL,
    text TEXT NOT NULL,
    rating INTEGER,
    date TEXT,
    city TEXT,
    url TEXT,
    exploration_relevant INTEGER NOT NULL,
    noise_category TEXT,
    outcome TEXT,
    user_goal TEXT,
    research_relevant INTEGER NOT NULL,
    research_questions TEXT,
    evidence TEXT,
    exploration_outcome TEXT,
    theme TEXT,
    barrier TEXT,
    behavior TEXT,
    emotion TEXT,
    segment TEXT,
    root_cause TEXT,
    unmet_need TEXT,
    mentioned_categories TEXT,
    confidence DOUBLE PRECISION,
    classification_reasons TEXT,
    CONSTRAINT run_reviews_run_id_fkey FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS run_reviews_run_id_idx ON run_reviews (run_id)`,

  `CREATE TABLE IF NOT EXISTS classification_cache (
    hash TEXT PRIMARY KEY,
    review_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
]
