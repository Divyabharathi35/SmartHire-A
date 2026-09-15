-- ============================================================
--  MIGRATION 014: AI Feedback Metadata Schema Updates
--  SmartHire — Candidate Assessment & AI Feedback Module
-- ============================================================

BEGIN;

ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS feedback_status VARCHAR(50) DEFAULT 'unavailable';
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(100) DEFAULT NULL;
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100) DEFAULT NULL;
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS feedback_generated_at TIMESTAMPTZ DEFAULT NULL;

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('014_ai_feedback_metadata')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
