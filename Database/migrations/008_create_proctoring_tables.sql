-- ============================================================
--  008_create_proctoring_tables.sql
--  Integrity events and session proctoring summary schema
-- ============================================================

-- Table for individual proctoring/integrity events
CREATE TABLE IF NOT EXISTS interview_integrity_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  event_type  VARCHAR(50) NOT NULL,
  severity    VARCHAR(20) NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
  message     TEXT        NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration    INT         NOT NULL DEFAULT 0,    -- event duration in seconds
  metadata    JSONB       DEFAULT '{}'::jsonb,   -- additional metadata (e.g. gaze direction, confidence)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrity_events_session_id ON interview_integrity_events (session_id);
CREATE INDEX IF NOT EXISTS idx_integrity_events_event_type ON interview_integrity_events (event_type);
CREATE INDEX IF NOT EXISTS idx_integrity_events_timestamp ON interview_integrity_events (timestamp);

-- Table for aggregate proctoring summary per session
CREATE TABLE IF NOT EXISTS interview_proctoring_summary (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID          NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
  face_verification_status VARCHAR(50)   NOT NULL DEFAULT 'PASSED',
  face_presence_percentage NUMERIC(5,2)  NOT NULL DEFAULT 100.0,
  multiple_face_count      INT           NOT NULL DEFAULT 0,
  looking_away_count       INT           NOT NULL DEFAULT 0,
  looking_away_duration    INT           NOT NULL DEFAULT 0,
  tab_switch_count         INT           NOT NULL DEFAULT 0,
  fullscreen_exit_count    INT           NOT NULL DEFAULT 0,
  screen_share_stop_count  INT           NOT NULL DEFAULT 0,
  possible_phone_count     INT           NOT NULL DEFAULT 0,
  camera_disconnect_count  INT           NOT NULL DEFAULT 0,
  mic_disconnect_count     INT           NOT NULL DEFAULT 0,
  suspicious_event_count   INT           NOT NULL DEFAULT 0,
  integrity_score          NUMERIC(5,2)  NOT NULL DEFAULT 100.0,
  final_status             VARCHAR(50)   NOT NULL DEFAULT 'GOOD', -- GOOD, REVIEW, HIGH RISK
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_summary_session_id ON interview_proctoring_summary (session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_summary_integrity_score ON interview_proctoring_summary (integrity_score);
