-- ============================================================
--  MIGRATION 016: Add Mock Interview Support & Data Isolation
--  SmartHire — Candidate Practice Feature
-- ============================================================

BEGIN;

-- Add is_mock column to interview_sessions to isolate mock/practice sessions from official interviews
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient filtering of mock vs official interviews
CREATE INDEX IF NOT EXISTS idx_interview_sessions_is_mock ON interview_sessions (is_mock);

-- Track schema migration
INSERT INTO schema_migrations (version) VALUES ('016_add_mock_interview_support')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
