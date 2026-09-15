# ============================================================
#  apply_migrations.py — Auto-apply DB schema & migrations
# ============================================================
import asyncio
import os
import asyncpg
from app.config import settings

async def main():
    print(f"[SmartHire] Connecting to DB: {settings.DATABASE_URL.split('@')[-1]}...")
    try:
        conn = await asyncpg.connect(settings.DATABASE_URL)
        print("[SmartHire] Connected successfully!")
        
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        schema_path = os.path.join(base_dir, "Database", "schema.sql")
        mig_path = os.path.join(base_dir, "Database", "migrations", "002_create_interview_tables.sql")
        
        if os.path.exists(schema_path):
            print("[SmartHire] Applying base schema.sql...")
            with open(schema_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Base schema applied successfully!")
            
        if os.path.exists(mig_path):
            print("[SmartHire] Applying migration 002_create_interview_tables.sql...")
            with open(mig_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            
            # Ensure columns exist if table was previously created
            await conn.execute("""
                ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50) DEFAULT 'Mid Level';
            """)
            print("[SmartHire] Migration 002 applied successfully!")

            
        mig3_path = os.path.join(base_dir, "Database", "migrations", "003_add_recordings_and_session_fields.sql")
        if os.path.exists(mig3_path):
            print("[SmartHire] Applying migration 003_add_recordings_and_session_fields.sql...")
            with open(mig3_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 003 applied successfully!")

        mig4_path = os.path.join(base_dir, "Database", "migrations", "004_add_question_timings.sql")
        if os.path.exists(mig4_path):
            print("[SmartHire] Applying migration 004_add_question_timings.sql...")
            with open(mig4_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 004 applied successfully!")

        mig5_path = os.path.join(base_dir, "Database", "migrations", "005_create_interview_results.sql")
        if os.path.exists(mig5_path):
            print("[SmartHire] Applying migration 005_create_interview_results.sql...")
            with open(mig5_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 005 applied successfully!")

        mig6_path = os.path.join(base_dir, "Database", "migrations", "006_create_interview_audio_answers.sql")
        if os.path.exists(mig6_path):
            print("[SmartHire] Applying migration 006_create_interview_audio_answers.sql...")
            with open(mig6_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 006 applied successfully!")

        mig7_path = os.path.join(base_dir, "Database", "migrations", "007_communication_and_behavior_analysis.sql")
        if os.path.exists(mig7_path):
            print("[SmartHire] Applying migration 007_communication_and_behavior_analysis.sql...")
            with open(mig7_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 007 applied successfully!")

        mig8_path = os.path.join(base_dir, "Database", "migrations", "008_create_proctoring_tables.sql")
        if os.path.exists(mig8_path):
            print("[SmartHire] Applying migration 008_create_proctoring_tables.sql...")
            with open(mig8_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 008 applied successfully!")

        mig9_path = os.path.join(base_dir, "Database", "migrations", "009_emotion_and_analytics_pipeline.sql")
        if os.path.exists(mig9_path):
            print("[SmartHire] Applying migration 009_emotion_and_analytics_pipeline.sql...")
            with open(mig9_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 009 applied successfully!")

        mig10_path = os.path.join(base_dir, "Database", "migrations", "010_emotion_analysis_events.sql")
        if os.path.exists(mig10_path):
            print("[SmartHire] Applying migration 010_emotion_analysis_events.sql...")
            with open(mig10_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 010 applied successfully!")

        mig11_path = os.path.join(base_dir, "Database", "migrations", "011_speech_and_behavior_enhancements.sql")
        if os.path.exists(mig11_path):
            print("[SmartHire] Applying migration 011_speech_and_behavior_enhancements.sql...")
            with open(mig11_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 011 applied successfully!")

        mig12_path = os.path.join(base_dir, "Database", "migrations", "012_interview_emotion_analysis.sql")
        if os.path.exists(mig12_path):
            print("[SmartHire] Applying migration 012_interview_emotion_analysis.sql...")
            with open(mig12_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 012 applied successfully!")

        mig14_path = os.path.join(base_dir, "Database", "migrations", "014_ai_feedback_metadata.sql")
        if os.path.exists(mig14_path):
            print("[SmartHire] Applying migration 014_ai_feedback_metadata.sql...")
            with open(mig14_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 014 applied successfully!")

        mig15_path = os.path.join(base_dir, "Database", "migrations", "015_notifications_and_analytics.sql")
        if os.path.exists(mig15_path):
            print("[SmartHire] Applying migration 015_notifications_and_analytics.sql...")
            with open(mig15_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 015 applied successfully!")

        mig16_path = os.path.join(base_dir, "Database", "migrations", "016_add_mock_interview_support.sql")
        if os.path.exists(mig16_path):
            print("[SmartHire] Applying migration 016_add_mock_interview_support.sql...")
            with open(mig16_path, "r", encoding="utf-8") as f:
                await conn.execute(f.read())
            print("[SmartHire] Migration 016 applied successfully!")


        # Ensure all columns exist across all tables in case tables pre-existed
        await conn.execute("""
            ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;
            CREATE INDEX IF NOT EXISTS idx_interview_sessions_is_mock ON interview_sessions (is_mock);

            ALTER TABLE interview_question_timings ADD COLUMN IF NOT EXISTS question_number INT DEFAULT 1;
            ALTER TABLE interview_question_timings ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
            ALTER TABLE interview_question_timings ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;
            ALTER TABLE interview_question_timings ADD COLUMN IF NOT EXISTS time_spent INT DEFAULT 0;

            ALTER TABLE interview_transcripts ADD COLUMN IF NOT EXISTS question_number INT DEFAULT 1;
            ALTER TABLE interview_transcripts ADD COLUMN IF NOT EXISTS transcript TEXT DEFAULT '';
            ALTER TABLE interview_transcripts ADD COLUMN IF NOT EXISTS duration INT DEFAULT 0;
            ALTER TABLE interview_transcripts ADD COLUMN IF NOT EXISTS word_count INT DEFAULT 0;

            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS grammar_score NUMERIC(5,2) DEFAULT 85.0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS grammar_error_count INT DEFAULT 0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS grammar_feedback TEXT DEFAULT '';
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS filler_word_count INT DEFAULT 0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS filler_words_per_minute NUMERIC(5,2) DEFAULT 0.0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS filler_rate NUMERIC(5,2) DEFAULT 0.0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS filler_words_list JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS words_per_minute NUMERIC(5,2) DEFAULT 0.0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS speaking_duration INT DEFAULT 0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS word_count INT DEFAULT 0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS pace_category VARCHAR(50) DEFAULT 'Good';
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS pronunciation_score NUMERIC(5,2) DEFAULT 85.0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS pronunciation_status VARCHAR(50) DEFAULT 'Estimated';
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS pronunciation_feedback TEXT DEFAULT '';
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS communication_score NUMERIC(5,2) DEFAULT 85.0;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT '';
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE communication_analysis ADD COLUMN IF NOT EXISTS weaknesses JSONB DEFAULT '[]'::jsonb;

            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS eye_contact_percentage NUMERIC(5,2) DEFAULT 0.0;
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS looking_away_duration INT DEFAULT 0;
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS attention_breaks INT DEFAULT 0;
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS eye_contact_status VARCHAR(50) DEFAULT 'Available';
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS observed_emotion VARCHAR(100) DEFAULT 'Neutral / Engaged';
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS confidence_indicator VARCHAR(100) DEFAULT 'Moderate Observed Confidence';
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS engagement_score NUMERIC(5,2) DEFAULT 80.0;
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS engagement_summary TEXT DEFAULT '';
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS behavior_score NUMERIC(5,2) DEFAULT 80.0;
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS behavior_events JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE interview_behavior_analysis ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT '';

            ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS feedback_status VARCHAR(50) DEFAULT 'unavailable';
            ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(100) DEFAULT NULL;
            ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100) DEFAULT NULL;
            ALTER TABLE interview_results ADD COLUMN IF NOT EXISTS feedback_generated_at TIMESTAMPTZ DEFAULT NULL;
        """)

        await conn.close()
        print("[SmartHire] All database tables & migrations ready!")

    except Exception as e:
        print(f"[SmartHire] Error applying migrations: {e}")

if __name__ == "__main__":
    asyncio.run(main())
