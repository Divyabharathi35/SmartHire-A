-- ============================================================
--  MIGRATION 009: Emotion Analysis Results & Enhanced Analytics
--  SmartHire — Real Kaggle Emotion Model & Candidate Analytics Pipeline
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Emotion Analysis Results Table
CREATE TABLE IF NOT EXISTS emotion_analysis_results (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id       UUID          REFERENCES interview_questions(id) ON DELETE CASCADE,
  timestamp         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  face_detected     BOOLEAN       NOT NULL DEFAULT TRUE,
  dominant_emotion  VARCHAR(50)   NOT NULL DEFAULT 'neutral',
  emotion_scores    JSONB         NOT NULL DEFAULT '{}'::jsonb,
  model_confidence  NUMERIC(5,4)  NOT NULL DEFAULT 0.0,
  smoothing_window  INT           NOT NULL DEFAULT 1,
  model_version     VARCHAR(50)   DEFAULT '1.0.0',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for fast query retrieval
CREATE INDEX IF NOT EXISTS idx_emotion_results_session_id  ON emotion_analysis_results (session_id);
CREATE INDEX IF NOT EXISTS idx_emotion_results_question_id ON emotion_analysis_results (question_id);
CREATE INDEX IF NOT EXISTS idx_emotion_results_timestamp   ON emotion_analysis_results (timestamp);

-- 2. Enhance Communication & Behavior Analysis tables with reliability & derived indicator fields
ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS face_visible_ratio NUMERIC(5,2) DEFAULT 100.0;
ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS frustration_indicator VARCHAR(100) DEFAULT 'Not observed';
ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS tension_indicator VARCHAR(100) DEFAULT 'Low Tension Signals';
ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS reliability VARCHAR(50) DEFAULT 'High';
ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '{}'::jsonb;
ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT '1.0.0';

ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS reliability VARCHAR(50) DEFAULT 'High';
ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT '1.0.0';

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('009_emotion_and_analytics_pipeline')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
