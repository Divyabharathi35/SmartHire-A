-- ============================================================
--  MIGRATION 015: Notifications & Session Alerts Table
--  SmartHire — Requirements 8 & 9 (Notifications & Analytics)
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   UUID          REFERENCES interview_sessions(id) ON DELETE CASCADE,
  type         VARCHAR(50)   NOT NULL, -- 'reminder', 'session_alert', 'report_available', 'proctoring_warning'
  title        VARCHAR(255)  NOT NULL,
  message      TEXT          NOT NULL,
  event_type   VARCHAR(50),  -- 'start', 'completion', 'proctoring_warning', 'reminder', 'report'
  is_read      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_session_id ON notifications (session_id);

-- Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('015_notifications_and_analytics')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
