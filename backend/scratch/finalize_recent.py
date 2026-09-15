import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_pool, close_pool
from app.routers.interviews import run_finalize_interview_pipeline

async def check():
    pool = await get_pool()
    async with pool.acquire() as db:
        # Check session 26524272-319d-430f-8113-802548da2c8b
        sid = "26524272-319d-430f-8113-802548da2c8b"
        sess = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", sid)
        if sess and sess["status"] == "COMPLETED":
            q_rows = await db.fetch("SELECT id, question_number, user_answer FROM interview_questions WHERE session_id = $1", sid)
            has_ans = any(q.get("user_answer") and q.get("user_answer").strip() for q in q_rows)
            print(f"Session {sid}: has_answers={has_ans}, completed={len(q_rows)}")
            if has_ans:
                print(f"Finalizing {sid}...")
                await run_finalize_interview_pipeline(sid, db)
                res = await db.fetchrow("SELECT session_id, feedback_status, ai_provider, ai_model, strengths FROM interview_results WHERE session_id = $1", sid)
                print(f"Updated result for {sid}: status={res['feedback_status']}, provider={res['ai_provider']}, strengths={res['strengths'][:80]}")
    await close_pool()

if __name__ == "__main__":
    asyncio.run(check())
