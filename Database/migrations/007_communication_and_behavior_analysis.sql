-- ============================================================
--  MIGRATION 007: Create Speech Transcripts, Communication Analysis & Behavior Analysis Tables
--  SmartHire — Real-Time Speech-to-Text, Communication & Behavioral Analytics Module
-- ============================================================

BEGIN;

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Interview Transcripts Table
CREATE TABLE IF NOT EXISTS interview_transcripts (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id      UUID          NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  candidate_id     UUID          REFERENCES users(id) ON DELETE SET NULL,
  question_number  INT           NOT NULL,
  transcript       TEXT          NOT NULL DEFAULT '',
  duration         INT           NOT NULL DEFAULT 0, -- speaking duration in seconds
  word_count       INT           NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_transcripts_session_question UNIQUE (session_id, question_id)
);

-- Trigger for interview_transcripts updated_at
DROP TRIGGER IF EXISTS trg_interview_transcripts_updated_at ON interview_transcripts;
CREATE TRIGGER trg_interview_transcripts_updated_at
  BEFORE UPDATE ON interview_transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for interview_transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_session_id  ON interview_transcripts (session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_question_id ON interview_transcripts (question_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_candidate   ON interview_transcripts (candidate_id);

-- 2. Communication Analysis Table
CREATE TABLE IF NOT EXISTS communication_analysis (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id             UUID          NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  transcript_id           UUID          REFERENCES interview_transcripts(id) ON DELETE CASCADE,
  grammar_score           NUMERIC(5,2)  NOT NULL DEFAULT 85.0,
  grammar_error_count     INT           NOT NULL DEFAULT 0,
  grammar_feedback        TEXT          DEFAULT '',
  filler_word_count       INT           NOT NULL DEFAULT 0,
  filler_words_per_minute NUMERIC(5,2)  NOT NULL DEFAULT 0.0,
  filler_rate             NUMERIC(5,2)  NOT NULL DEFAULT 0.0,
  filler_words_list       JSONB         DEFAULT '[]'::jsonb,
  words_per_minute        NUMERIC(5,2)  NOT NULL DEFAULT 0.0,
  speaking_duration       INT           NOT NULL DEFAULT 0, -- in seconds
  word_count              INT           NOT NULL DEFAULT 0,
  pace_category           VARCHAR(50)   NOT NULL DEFAULT 'Good', -- Too Slow / Moderate / Good / Fast / Too Fast
  pronunciation_score     NUMERIC(5,2)  NOT NULL DEFAULT 85.0,
  pronunciation_status    VARCHAR(50)   NOT NULL DEFAULT 'Estimated', -- Supported / Limited / Estimated / Unavailable
  pronunciation_feedback  TEXT          DEFAULT '',
  communication_score     NUMERIC(5,2)  NOT NULL DEFAULT 85.0,
  feedback                TEXT          DEFAULT '',
  strengths               JSONB         DEFAULT '[]'::jsonb,
  weaknesses              JSONB         DEFAULT '[]'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_comm_analysis_session_question UNIQUE (session_id, question_id)
);

-- Trigger for communication_analysis updated_at
DROP TRIGGER IF EXISTS trg_comm_analysis_updated_at ON communication_analysis;
CREATE TRIGGER trg_comm_analysis_updated_at
  BEFORE UPDATE ON communication_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for communication_analysis
CREATE INDEX IF NOT EXISTS idx_comm_analysis_session_id  ON communication_analysis (session_id);
CREATE INDEX IF NOT EXISTS idx_comm_analysis_question_id ON communication_analysis (question_id);

-- 3. Interview Behavior Analysis Table
CREATE TABLE IF NOT EXISTS interview_behavior_analysis (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID          NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
  candidate_id            UUID          REFERENCES users(id) ON DELETE SET NULL,
  eye_contact_percentage  NUMERIC(5,2)  NOT NULL DEFAULT 0.0,
  looking_away_duration   INT           NOT NULL DEFAULT 0, -- in seconds
  attention_breaks        INT           NOT NULL DEFAULT 0,
  eye_contact_status      VARCHAR(50)   NOT NULL DEFAULT 'Available', -- Available / Unavailable
  observed_emotion        VARCHAR(100)  DEFAULT 'Neutral / Engaged',
  confidence_indicator    VARCHAR(100)  DEFAULT 'Moderate Confidence',
  engagement_score        NUMERIC(5,2)  NOT NULL DEFAULT 80.0,
  engagement_summary      TEXT          DEFAULT '',
  behavior_score          NUMERIC(5,2)  NOT NULL DEFAULT 80.0,
  behavior_events         JSONB         DEFAULT '[]'::jsonb,
  feedback                TEXT          DEFAULT '',
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Trigger for interview_behavior_analysis updated_at
DROP TRIGGER IF EXISTS trg_behavior_analysis_updated_at ON interview_behavior_analysis;
CREATE TRIGGER trg_behavior_analysis_updated_at
  BEFORE UPDATE ON interview_behavior_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for interview_behavior_analysis
CREATE INDEX IF NOT EXISTS idx_behavior_analysis_session_id ON interview_behavior_analysis (session_id);
CREATE INDEX IF NOT EXISTS idx_behavior_analysis_candidate  ON interview_behavior_analysis (candidate_id);

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('007_communication_and_behavior_analysis')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
