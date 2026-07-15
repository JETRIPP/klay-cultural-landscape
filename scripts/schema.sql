-- Run once against the Neon/Postgres database before running
-- scripts/migrate_to_postgres.mjs. Safe to re-run (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS entrants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location JSONB NOT NULL,
  bio TEXT,
  cv TEXT,
  notable_work JSONB NOT NULL DEFAULT '[]',
  socials JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS edges (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL REFERENCES entrants(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES entrants(id) ON DELETE CASCADE,
  context TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS edges_source_idx ON edges(source);
CREATE INDEX IF NOT EXISTS edges_target_idx ON edges(target);
