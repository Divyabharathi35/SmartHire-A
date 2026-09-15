-- ============================================================
--  MIGRATION 012: Interview Emotion Analysis Table
--  SmartHire — PyTorch Real Inference Storage Table
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS interview_emotion_analysis (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID          NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  timestamp               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  emotion                 VARCHAR(50),
  confidence              NUMERIC(5,4),
  angry_probability       NUMERIC(5,4)  DEFAULT 0.0,
  disgust_probability     NUMERIC(5,4)  DEFAULT 0.0,
  fear_probability        NUMERIC(5,4)  DEFAULT 0.0,
  happy_probability       NUMERIC(5,4)  DEFAULT 0.0,
  neutral_probability     NUMERIC(5,4)  DEFAULT 0.0,
  sad_probability         NUMERIC(5,4)  DEFAULT 0.0,
  surprise_probability    NUMERIC(5,4)  DEFAULT 0.0,
  face_detected           BOOLEAN       NOT NULL DEFAULT FALSE,
  face_count              INT           NOT NULL DEFAULT 0,
  model_version           VARCHAR(50)   DEFAULT '1.0.0',
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_emotion_session_id ON interview_emotion_analysis (session_id);
CREATE INDEX IF NOT EXISTS idx_interview_emotion_timestamp  ON interview_emotion_analysis (timestamp);

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('012_interview_emotion_analysis')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
