import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_pool, close_pool

async def check():
    pool = await get_pool()
    async with pool.acquire() as db:
        session_id = "efca4130-bb2a-45cc-8d8a-afd0880b8e9b"
        sess = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
        print("Session:", dict(sess))
        questions = await db.fetch("SELECT id, question_number, question_text, user_answer, score FROM interview_questions WHERE session_id = $1 ORDER BY question_number", session_id)
        print("\nQuestions:", len(questions))
        for q in questions:
            print(f"Q{q['question_number']}: {q['question_text'][:80]}... | Ans: {q['user_answer'][:80] if q['user_answer'] else None}")
        trans = await db.fetch("SELECT * FROM interview_transcripts WHERE session_id = $1 ORDER BY question_number", session_id)
        print("\nTranscripts:", len(trans))
        for t in trans:
            print(f"T{t['question_number']}: {t['transcript'][:80]}...")
        res = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", session_id)
        print("\nResult:", dict(res) if res else None)
    await close_pool()

if __name__ == "__main__":
    asyncio.run(check())
