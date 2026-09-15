# ============================================================
#  verify_real_candidate_report.py — Real Candidate Report End-to-End Verification
# ============================================================
import asyncio
import json
import os
import sys
from uuid import uuid4
from datetime import datetime
from unittest.mock import patch, AsyncMock

# Set PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from app.database import get_pool, close_pool
from app.services.ai_service import AIService
from app.routers.interviews import run_finalize_interview_pipeline, get_recruiter_interview_details


async def main():
    print("=== Starting Real Candidate Report Verification ===")
    pool = await get_pool()
    async with pool.acquire() as db:
        # 1. Fetch or create a test candidate user
        cand_user = await db.fetchrow("SELECT id FROM users WHERE role = 'candidate' LIMIT 1")
        if not cand_user:
            cand_id = uuid4()
            await db.execute(
                """
                INSERT INTO users (id, name, email, role, created_at, updated_at)
                VALUES ($1, 'Test Candidate', 'test_candidate@smarthire.ai', 'candidate', NOW(), NOW())
                """,
                cand_id
            )
        else:
            cand_id = cand_user["id"]

        rec_user = await db.fetchrow("SELECT id FROM users WHERE role IN ('recruiter', 'admin') LIMIT 1")
        rec_id = rec_user["id"] if rec_user else cand_id

        # 2. Create Interview Session
        session_id = uuid4()
        await db.execute(
            """
            INSERT INTO interview_sessions (
                id, candidate_id, user_id, created_by, job_role, domain, interview_type,
                difficulty, status, total_questions, completed_questions, created_at, updated_at
            ) VALUES (
                $1, $2, $2, $3, 'Senior Backend Engineer', 'Backend Engineering', 'Technical Interview',
                'Advanced', 'IN_PROGRESS', 3, 0, NOW(), NOW()
            )
            """,
            session_id, cand_id, rec_id
        )

        # 3. Create 3 Questions
        questions = [
            {
                "id": uuid4(),
                "num": 1,
                "text": "How do you design a high-throughput connection pool for PostgreSQL in Python using asyncpg?",
                "ans": "I use asyncpg's create_pool with min_size=5 and max_size=20, configuring connection timeouts, statement caching, and health checks to handle high concurrency efficiently.",
                "duration": 45
            },
            {
                "id": uuid4(),
                "num": 2,
                "text": "Explain how Redis handles caching and cache invalidation strategies like LRU.",
                "ans": "Redis supports maxmemory-policy volatile-lru or allkeys-lru to evict least recently used keys when memory limits are reached. I set explicit TTLs on keys to prevent stale data.",
                "duration": 50
            },
            {
                "id": uuid4(),
                "num": 3,
                "text": "How do you handle rate limiting and 429 quota errors gracefully in distributed API clients?",
                "ans": "I implement exponential backoff with jitter and circuit breaker patterns, falling back to local replica models like Ollama when primary cloud APIs like Gemini return 429 errors.",
                "duration": 40
            }
        ]

        for q in questions:
            await db.execute(
                """
                INSERT INTO interview_questions (
                    id, session_id, question_number, question_text, interview_type, domain,
                    difficulty, expected_answer_points, category, user_answer, score, created_at
                ) VALUES ($1, $2, $3, $4, 'Technical Interview', 'Backend Engineering', 'Advanced', '["Architecture", "Optimization"]'::jsonb, 'System Design', $5, NULL, NOW())
                """,
                q["id"], session_id, q["num"], q["text"], q["ans"]
            )

            # Insert transcripts
            w_cnt = len(q["ans"].split())
            await db.execute(
                """
                INSERT INTO interview_transcripts (
                    session_id, question_id, candidate_id, question_number, transcript, duration, word_count, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                """,
                session_id, q["id"], cand_id, q["num"], q["ans"], q["duration"], w_cnt
            )

            # Insert timings
            await db.execute(
                """
                INSERT INTO interview_question_timings (
                    session_id, question_id, question_number, time_spent, created_at
                ) VALUES ($1, $2, $3, $4, NOW())
                """,
                session_id, q["id"], q["num"], q["duration"]
            )

        print(f"[SmartHire Test] Inserted interview session {session_id} with 3 answered questions.")

        # 4. Finalize the interview session via pipeline (with mocked AI evaluation to simulate API success)
        mock_eval = {
            "status": "completed",
            "provider": "gemini (gemini-2.5-flash)",
            "technical_accuracy": 88.0,
            "keyword_relevance": 90.0,
            "problem_solving": 85.0,
            "domain_knowledge": 92.0,
            "answer_completeness": 90.0,
            "communication": 88.0,
            "confidence_indicators": 85.0,
            "professionalism": 95.0,
            "feedback": "Strong explanation of backend architecture, connection pooling, and resilient API fallback mechanisms.",
            "strengths": ["Clear understanding of asyncpg connection pool tuning.", "Good explanation of Redis LRU eviction policies."],
            "weaknesses": ["Could provide specific memory limit values."],
            "improvement_suggestions": ["Include benchmark metrics."],
            "practice_recommendations": ["Practice stress testing database connections."],
            "learning_resources": ["Read asyncpg documentation and PostgreSQL performance tuning."]
        }

        print("[SmartHire Test] Executing run_finalize_interview_pipeline...")
        with patch.object(AIService, "evaluate_answer", new_callable=AsyncMock) as mock_eval_fn, \
             patch.object(AIService, "generate_session_feedback", new_callable=AsyncMock) as mock_fb_fn:
            mock_eval_fn.return_value = mock_eval
            mock_fb_fn.return_value = {
                "status": "available",
                "strengths": mock_eval["strengths"],
                "weaknesses": mock_eval["weaknesses"],
                "improvement_suggestions": mock_eval["improvement_suggestions"],
                "practice_recommendations": mock_eval["practice_recommendations"],
                "learning_resources": mock_eval["learning_resources"],
                "ai_provider": "gemini (gemini-2.5-flash)",
                "ai_model": "gemini-2.5-flash",
                "generated_at": datetime.utcnow().isoformat()
            }
            res_row = await run_finalize_interview_pipeline(session_id, db)

        print(f"[SmartHire Test] Session finalized! Overall score: {res_row.get('overall_score')}, Rating: {res_row.get('performance_rating')}")

        # 5. Retrieve Candidate Report details endpoint response
        current_user = {"id": str(rec_id), "role": "admin"}
        report_data = await get_recruiter_interview_details(session_id, current_user, db)

        print("\n=== CANDIDATE REPORT VERIFICATION RESULTS ===")
        print(f"Candidate Name: {report_data['candidate']['name']}")
        print(f"Target Role: {report_data['session']['job_role']}")
        print(f"Overall Score: {report_data['result']['overall_score']}%")
        print(f"Recommendation: {report_data['result']['recommendation']}")
        print(f"Category Scores: {json.dumps(report_data['category_scores'], indent=2)}")
        print(f"Question Results Count: {len(report_data['question_results'])}")
        print(f"Communication Analysis Records: {len(report_data['communication_analysis'])}")
        print(f"AI Feedback Status: {report_data['feedback']['status']} (Provider: {report_data['feedback']['ai_provider']})")
        print(f"Grounded Strengths Count: {len(report_data['feedback']['strengths'])}")
        print("=============================================\n")

        # Basic assertions
        assert report_data["result"]["overall_score"] is not None
        assert report_data["result"]["overall_score"] > 0
        assert len(report_data["question_results"]) == 3
        assert len(report_data["communication_analysis"]) == 3
        assert report_data["category_scores"]["communication"] is not None
        assert report_data["category_scores"]["technical_relevance"] is not None

        print("[SUCCESS] REAL CANDIDATE REPORT VERIFICATION SUCCESSFUL!")

    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
