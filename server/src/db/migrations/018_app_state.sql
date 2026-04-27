-- Generic key/value table for app-level state (e.g. last backfill timestamp).
-- Used by pushScheduler to throttle the backfill scan to once per 24h
-- so we don't hammer the DB on every cold start (was eating ~30% Neon CU).
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
