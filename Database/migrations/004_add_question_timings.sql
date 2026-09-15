-- ============================================================
--  MIGRATION 004: Create Interview Question Timings Table & Indexes
--  SmartHire — Timer & Question Timing Tracking Module
-- ============================================================

BEGIN;

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Interview question timings table
CREATE TABLE IF NOT EXISTS interview_question_timings (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id     UUID          REFERENCES interview_questions(id) ON DELETE CASCADE,
  question_number INT           NOT NULL,
  started_at      TIMESTAMPTZ,
  answered_at     TIMESTAMPTZ,
  time_spent      INT           NOT NULL DEFAULT 0, -- in seconds
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE interview_question_timings ADD COLUMN IF NOT EXISTS question_number INT DEFAULT 1;

-- Ensure indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_question_timings_session_id  ON interview_question_timings (session_id);
CREATE INDEX IF NOT EXISTS idx_question_timings_question_id ON interview_question_timings (question_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate_id ON interview_sessions (candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_created_by   ON interview_sessions (created_by);

-- Schema migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('004_add_question_timings')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
