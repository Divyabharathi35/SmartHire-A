-- ============================================================
--  MIGRATION 010: Emotion Analysis Events Table
--  SmartHire — Real PyTorch Facial Emotion Recognition Events
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Emotion Analysis Events Table
CREATE TABLE IF NOT EXISTS emotion_analysis_events (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id             UUID          REFERENCES interview_questions(id) ON DELETE SET NULL,
  captured_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  face_detected           BOOLEAN       NOT NULL DEFAULT FALSE,
  face_event              VARCHAR(50)   NOT NULL DEFAULT 'no_face_detected',
  detected_emotion        VARCHAR(50),
  confidence_score        NUMERIC(5,4),
  probabilities           JSONB,
  model_name              VARCHAR(100)  DEFAULT 'SmartHire-EmotionNet-EmotionCNN',
  model_version           VARCHAR(50)   DEFAULT '1.0.0',
  frame_processing_status VARCHAR(50)   NOT NULL DEFAULT 'SUCCESS',
  error_message           TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for fast query retrieval
CREATE INDEX IF NOT EXISTS idx_emotion_events_session_id  ON emotion_analysis_events (session_id);
CREATE INDEX IF NOT EXISTS idx_emotion_events_question_id ON emotion_analysis_events (question_id);
CREATE INDEX IF NOT EXISTS idx_emotion_events_captured_at ON emotion_analysis_events (captured_at);

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('010_emotion_analysis_events')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
