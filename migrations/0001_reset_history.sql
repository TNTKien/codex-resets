CREATE TABLE IF NOT EXISTS reset_events (
  id TEXT PRIMARY KEY,
  announced_at TEXT NOT NULL,
  reset_type TEXT NOT NULL CHECK (reset_type IN ('regular', 'banked')),
  text TEXT NOT NULL,
  source_type TEXT,
  source_author TEXT,
  source_url TEXT,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reset_events_announced_at
  ON reset_events(announced_at DESC);
