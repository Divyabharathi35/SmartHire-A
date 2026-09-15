import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_pool, close_pool

async def check():
    pool = await get_pool()
    async with pool.acquire() as db:
        rows = await db.fetch("SELECT id, job_role, status, completed_questions, total_questions FROM interview_sessions ORDER BY created_at DESC LIMIT 5")
        print("Sessions count:", len(rows))
        for r in rows:
            print(f"Session {r['id']}: status={r['status']}, role={r['job_role']}, completed={r['completed_questions']}/{r['total_questions']}")
        res = await db.fetch("SELECT session_id, overall_score, feedback_status, ai_provider, strengths FROM interview_results ORDER BY created_at DESC LIMIT 5")
        print("Results count:", len(res))
        for r in res:
            st = str(r['strengths'])[:60] if r['strengths'] else None
            print(f"Result for {r['session_id']}: score={r['overall_score']}, status={r['feedback_status']}, provider={r['ai_provider']}, strengths={st}")
    await close_pool()

if __name__ == "__main__":
    asyncio.run(check())
