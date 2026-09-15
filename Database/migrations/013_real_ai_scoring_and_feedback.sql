-- ============================================================
--  MIGRATION 013: Real AI Feedback & Scoring Schema Updates
--  SmartHire — Candidate Assessment & Recruiter Analytics Module
-- ============================================================

BEGIN;

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Enhance interview_results table with 4 category scores, performance rating & feedback arrays
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS technical_relevance_score NUMERIC(5,2);
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2);
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS professionalism_score NUMERIC(5,2);
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS performance_rating VARCHAR(50) DEFAULT 'Under Review';
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS weaknesses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS improvement_suggestions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS practice_recommendations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS learning_resources JSONB DEFAULT '[]'::jsonb;

-- 2. Enhance interview_question_results table with per-question category & sub-metric scores
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS communication_score NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS technical_score NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS professionalism_score NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5,2);

ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS technical_accuracy NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS keyword_relevance NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS problem_solving NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS domain_knowledge NUMERIC(5,2);
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS answer_completeness NUMERIC(5,2);

ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS weaknesses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interview_question_results ADD COLUMN IF NOT EXISTS improvement_suggestions JSONB DEFAULT '[]'::jsonb;

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('013_real_ai_scoring_and_feedback')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
