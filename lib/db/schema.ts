/**
 * Schema for ReviewLens persistence.
 *
 * Kept as a TypeScript module rather than a .sql file read at runtime so the
 * statements are bundled into the serverless function. On Vercel the source
 * tree is not present at process.cwd(), so fs.readFileSync('lib/db/schema.sql')
 * would fail in production.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    seq INTEGER NOT NULL,
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
    readiness_score REAL NOT NULL,
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
    research_questions TEXT NOT NULL,
    evidence TEXT NOT NULL,
    exploration_outcome TEXT NOT NULL,
    theme TEXT NOT NULL,
    barrier TEXT NOT NULL,
    behavior TEXT NOT NULL,
    emotion TEXT NOT NULL,
    segment TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    unmet_need TEXT NOT NULL,
    mentioned_categories TEXT NOT NULL,
    confidence REAL NOT NULL,
    classification_reasons TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS classification_cache (
    hash TEXT PRIMARY KEY,
    review_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
]
