-- ============================================================
--  MIGRATION 011: Real Speech Analysis & Behavioral Tracking
--  SmartHire — Speech, Emotion, Proctoring & Behavioral Pipeline
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Add audio_answer_id and transcription_status to interview_transcripts
ALTER TABLE interview_transcripts ADD COLUMN IF NOT EXISTS audio_answer_id UUID REFERENCES interview_audio_answers(id) ON DELETE SET NULL;
ALTER TABLE interview_transcripts ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(50) DEFAULT 'completed';
ALTER TABLE interview_transcripts ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4);

-- 2. Speech Analysis Table
CREATE TABLE IF NOT EXISTS speech_analysis (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id             UUID          REFERENCES interview_questions(id) ON DELETE CASCADE,
  audio_answer_id         UUID          REFERENCES interview_audio_answers(id) ON DELETE SET NULL,
  transcript              TEXT          DEFAULT '',
  transcription_status    VARCHAR(50)   NOT NULL DEFAULT 'completed', -- completed / failed / unavailable
  word_count              INT           NOT NULL DEFAULT 0,
  speaking_duration       INT           NOT NULL DEFAULT 0, -- in seconds
  words_per_minute        NUMERIC(5,2)  DEFAULT 0.0,
  pace_classification     VARCHAR(50)   DEFAULT 'Normal', -- Slow / Normal / Fast / Insufficient Data
  grammar_score           NUMERIC(5,2),
  grammar_issues          JSONB         DEFAULT '[]'::jsonb,
  sentence_clarity        VARCHAR(50)   DEFAULT 'Clear',
  vocabulary_usage        VARCHAR(50)   DEFAULT 'Good',
  response_completeness   NUMERIC(5,2),
  filler_word_count       INT           DEFAULT 0,
  filler_words_per_minute NUMERIC(5,2)  DEFAULT 0.0,
  detected_filler_words   JSONB         DEFAULT '[]'::jsonb,
  pronunciation_score     NUMERIC(5,2),
  pronunciation_issues    JSONB         DEFAULT '[]'::jsonb,
  confidence_reliability  NUMERIC(5,4),
  analysis_status         VARCHAR(50)   NOT NULL DEFAULT 'completed', -- completed / failed / unavailable
  communication_score     NUMERIC(5,2),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_speech_analysis_session_question UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_speech_analysis_session_id ON speech_analysis (session_id);
CREATE INDEX IF NOT EXISTS idx_speech_analysis_question_id ON speech_analysis (question_id);

-- 3. Eye Tracking Events Table
CREATE TABLE IF NOT EXISTS eye_tracking_events (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id             UUID          REFERENCES interview_questions(id) ON DELETE SET NULL,
  timestamp               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  eye_direction           VARCHAR(50)   NOT NULL DEFAULT 'center', -- center / left / right / up / down / none
  is_looking_at_camera    BOOLEAN       NOT NULL DEFAULT TRUE,
  gaze_x                  NUMERIC(5,2),
  gaze_y                  NUMERIC(5,2),
  confidence              NUMERIC(5,4)  DEFAULT 1.0,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eye_events_session_id ON eye_tracking_events (session_id);
CREATE INDEX IF NOT EXISTS idx_eye_events_timestamp  ON eye_tracking_events (timestamp);

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('011_speech_and_behavior_enhancements')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
