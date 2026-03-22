-- Run this in your Supabase SQL editor to set up the analytics tables

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  visitor_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  max_scroll_depth INTEGER,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  user_agent TEXT,
  browser TEXT,
  os TEXT,
  device_type TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  language TEXT,
  timezone TEXT,
  is_bounce BOOLEAN DEFAULT TRUE,
  event_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT,
  visitor_id TEXT,
  event_type TEXT NOT NULL,
  event_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  seconds_on_page REAL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_name ON events(event_type, event_name);

-- Function to increment session event count (used by event endpoint)
CREATE OR REPLACE FUNCTION increment_event_count(session_id_param TEXT)
RETURNS void AS $$
  UPDATE sessions SET event_count = event_count + 1 WHERE id = session_id_param;
$$ LANGUAGE sql;

-- Disable RLS for service role access (API routes use service key)
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
