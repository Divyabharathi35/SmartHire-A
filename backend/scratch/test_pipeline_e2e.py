import asyncio
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_pool, close_pool
from app.routers.interviews import run_finalize_interview_pipeline, get_recruiter_interview_details

SESSION_ID = "efca4130-bb2a-45cc-8d8a-afd0880b8e9b"

async def test():
    print("=== Running End-to-End Pipeline on Session efca4130-bb2a-45cc-8d8a-afd0880b8e9b ===")
    pool = await get_pool()
    async with pool.acquire() as db:
        # Check current row in interview_results
        row_before = await db.fetchrow("SELECT session_id, feedback_status, ai_provider, strengths FROM interview_results WHERE session_id = $1", SESSION_ID)
        print("Before run_finalize_interview_pipeline:")
        print(f"  feedback_status: {row_before.get('feedback_status') if row_before else None}")
        print(f"  ai_provider: {row_before.get('ai_provider') if row_before else None}")
        print(f"  strengths: {row_before.get('strengths') if row_before else None}")
        
        print("\nExecuting run_finalize_interview_pipeline with REAL Gemini...")
        final_res = await run_finalize_interview_pipeline(SESSION_ID, db)
        print("run_finalize_interview_pipeline completed successfully!")
        print("Result returned from pipeline:")
        print(f"  session_id: {final_res.get('session_id')}")
        print(f"  overall_score: {final_res.get('overall_score')}")
        print(f"  performance_rating: {final_res.get('performance_rating')}")
        print(f"  feedback_status: {final_res.get('feedback_status')}")
        print(f"  ai_provider: {final_res.get('ai_provider')}")
        print(f"  ai_model: {final_res.get('ai_model')}")
        print(f"  strengths: {final_res.get('strengths')}")
        print(f"  weaknesses: {final_res.get('weaknesses')}")
        print(f"  improvement_suggestions: {final_res.get('improvement_suggestions')}")
        print(f"  practice_recommendations: {final_res.get('practice_recommendations')}")
        print(f"  learning_resources: {final_res.get('learning_resources')}")

        # Check DB directly
        print("\nChecking interview_results directly from DB:")
        row_after = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", SESSION_ID)
        print(f"  DB feedback_status: {row_after.get('feedback_status')}")
        print(f"  DB ai_provider: {row_after.get('ai_provider')}")
        print(f"  DB ai_model: {row_after.get('ai_model')}")
        print(f"  DB feedback_generated_at: {row_after.get('feedback_generated_at')}")
        
        # Test the Recruiter Details API
        print("\nCalling get_recruiter_interview_details (Details API)...")
        cand_user = await db.fetchrow("SELECT id FROM users WHERE role IN ('recruiter', 'admin') LIMIT 1")
        rec_id = cand_user["id"]
        current_user = {"id": str(rec_id), "role": "admin"}
        details = await get_recruiter_interview_details(SESSION_ID, current_user, db)
        
        fb = details.get("feedback", {})
        print("API Response feedback object:")
        print(f"  status: {fb.get('status')}")
        print(f"  ai_provider: {fb.get('ai_provider')}")
        print(f"  ai_model: {fb.get('ai_model')}")
        print(f"  feedback_generated_at: {fb.get('feedback_generated_at')}")
        print(f"  strengths count: {len(fb.get('strengths', []))}")
        print(f"  weaknesses count: {len(fb.get('weaknesses', []))}")
        print(f"  improvement_suggestions count: {len(fb.get('improvement_suggestions', []))}")
        print(f"  practice_recommendations count: {len(fb.get('practice_recommendations', []))}")
        print(f"  learning_resources count: {len(fb.get('learning_resources', []))}")
        
        print("\nAPI Response strengths content:")
        for idx, s in enumerate(fb.get("strengths", []), 1):
            print(f"  {idx}. {s}")
        print("\nAPI Response weaknesses content:")
        for idx, w in enumerate(fb.get("weaknesses", []), 1):
            print(f"  {idx}. {w}")
        print("\nAPI Response suggestions content:")
        for idx, sug in enumerate(fb.get("improvement_suggestions", []), 1):
            print(f"  {idx}. {sug}")
        print("\nAPI Response practice content:")
        for idx, p in enumerate(fb.get("practice_recommendations", []), 1):
            print(f"  {idx}. {p}")
        print("\nAPI Response resources content:")
        for idx, r in enumerate(fb.get("learning_resources", []), 1):
            print(f"  {idx}. {r}")
            
        # Assertions
        assert fb.get("status") == "available"
        assert fb.get("ai_provider") is not None
        assert len(fb.get("strengths", [])) > 0
        assert len(fb.get("weaknesses", [])) > 0
        assert len(fb.get("improvement_suggestions", [])) > 0
        assert len(fb.get("practice_recommendations", [])) > 0
        assert len(fb.get("learning_resources", [])) > 0
        
        print("\n>>> ALL ASSERTIONS PASSED! AI FEEDBACK PIPELINE IS 100% WORKING! <<<")

    await close_pool()

if __name__ == "__main__":
    asyncio.run(test())
