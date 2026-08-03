-- Schema for ReviewLens persistence

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    seq INTEGER NOT NULL,
    dataset_name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    total_reviews INTEGER NOT NULL,
    exploration_relevant_count INTEGER NOT NULL,
    excluded_count INTEGER NOT NULL,
    source_mix TEXT NOT NULL,          -- JSON string of Record<string, number>
    fetch_params TEXT NOT NULL,        -- JSON string of Record<string, unknown>
    curation_stats TEXT NOT NULL,      -- JSON string of CurationStats
    aggregation TEXT NOT NULL,         -- JSON string of Aggregation
    findings TEXT NOT NULL,            -- JSON string of Finding[]
    executive_report TEXT NOT NULL,    -- JSON string of ExecutiveReport
    readiness_score REAL NOT NULL,
    readiness_gaps TEXT NOT NULL,      -- JSON string of string[]
    taxonomy_version TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    mock INTEGER NOT NULL,             -- 0 or 1
    environment TEXT NOT NULL          -- 'prod' | 'staging' | 'local'
);

CREATE TABLE IF NOT EXISTS run_reviews (
    id TEXT PRIMARY KEY,               -- composite: run_id::review_id
    run_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    source TEXT NOT NULL,
    text TEXT NOT NULL,
    rating INTEGER,
    date TEXT,
    city TEXT,
    url TEXT,
    exploration_relevant INTEGER NOT NULL, -- 0 or 1
    noise_category TEXT,
    outcome TEXT,
    user_goal TEXT,
    research_relevant INTEGER NOT NULL, -- 0 or 1
    research_questions TEXT NOT NULL,  -- JSON string of string[]
    evidence TEXT NOT NULL,
    exploration_outcome TEXT NOT NULL,
    theme TEXT NOT NULL,
    barrier TEXT NOT NULL,
    behavior TEXT NOT NULL,
    emotion TEXT NOT NULL,
    segment TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    unmet_need TEXT NOT NULL,
    mentioned_categories TEXT NOT NULL, -- JSON string of string[]
    confidence REAL NOT NULL,
    classification_reasons TEXT NOT NULL, -- JSON string of string[]
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classification_cache (
    hash TEXT PRIMARY KEY,
    review_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

