-- Reserved for the D1 history layer. The initial deploy does not require a D1 binding.
CREATE TABLE IF NOT EXISTS reset_events (
  id TEXT PRIMARY KEY,
  happened_at TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('global', 'banked', 'incident', 'other')),
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reset_events_happened_at ON reset_events(happened_at DESC);
