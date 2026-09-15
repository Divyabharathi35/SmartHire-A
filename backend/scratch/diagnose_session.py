import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_pool, close_pool
from app.services.ai_service import AIService
from app.routers.interviews import get_recruiter_interview_details

SESSION_ID = "efca4130-bb2a-45cc-8d8a-afd0880b8e9b"

async def diagnose():
    print("================ DIAGNOSIS REPORT ================")
    pool = await get_pool()
    async with pool.acquire() as db:
        # 1. Does session exist?
        session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", SESSION_ID)
        print(f"1. Session exists: {session_row is not None}")
        if not session_row:
            print("Session not found!")
            await close_pool()
            return
        
        # 2. Is status COMPLETED?
        print(f"2. Session status: {session_row.get('status')}")
        
        # 3. How many questions completed?
        comp_q = session_row.get("completed_questions", 0)
        tot_q = session_row.get("total_questions", 0)
        print(f"3. Questions completed: {comp_q} / {tot_q}")
        
        # 4. Check questions and transcripts
        q_rows = await db.fetch("SELECT * FROM interview_questions WHERE session_id = $1 ORDER BY question_number", SESSION_ID)
        t_rows = await db.fetch("SELECT * FROM interview_transcripts WHERE session_id = $1 ORDER BY question_number", SESSION_ID)
        qr_rows = await db.fetch("SELECT * FROM interview_question_results WHERE session_id = $1 ORDER BY question_number", SESSION_ID)
        
        t_map = {str(t.get("question_id")): t for t in t_rows}
        t_num_map = {t.get("question_number"): t for t in t_rows}
        
        print(f"4. Question Details (Total: {len(q_rows)}):")
        for q in q_rows:
            q_num = q["question_number"]
            u_ans = q.get("user_answer") or ""
            q_text = q.get("question_text") or ""
            q_score = q.get("score")
            matching_t = t_map.get(str(q["id"])) or t_num_map.get(q_num)
            t_text = matching_t.get("transcript") if matching_t else None
            
            print(f"   Q{q_num}:")
            print(f"     question_text length: {len(q_text)} chars")
            print(f"     user_answer length: {len(u_ans)} chars | starts: '{u_ans[:40]}...'")
            print(f"     transcript present in interview_transcripts table: {matching_t is not None} (len={len(t_text) if t_text else 0})")
            print(f"     question score in interview_questions: {q_score}")
        
        # 5. Check interview_results table
        res_row = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", SESSION_ID)
        print(f"\n5. Current interview_results in DB:")
        if res_row:
            print(f"   overall_score: {res_row.get('overall_score')}")
            print(f"   performance_rating: {res_row.get('performance_rating')}")
            print(f"   feedback_status: {res_row.get('feedback_status')}")
            print(f"   ai_provider: {res_row.get('ai_provider')}")
            print(f"   ai_model: {res_row.get('ai_model')}")
            print(f"   feedback_generated_at: {res_row.get('feedback_generated_at')}")
            print(f"   strengths: {res_row.get('strengths')}")
            print(f"   weaknesses: {res_row.get('weaknesses')}")
            print(f"   improvement_suggestions: {res_row.get('improvement_suggestions')}")
            print(f"   practice_recommendations: {res_row.get('practice_recommendations')}")
            print(f"   learning_resources: {res_row.get('learning_resources')}")
        else:
            print("   No row in interview_results!")

        # 6 & 7 & 8: Simulate the EXACT finalize pipeline flow for this session step-by-step
        print("\n6-10. Tracing EXACT execution flow of run_finalize_interview_pipeline:")
        
        # Step A: How question_evaluations are constructed in interviews.py:
        print("   Step A: Tracing evaluate_answer calls for each question...")
        question_evaluations = []
        for q in q_rows:
            user_ans = q.get("user_answer") or ""
            if user_ans.strip():
                # In interviews.py:
                ai_eval = await AIService.evaluate_answer(
                    question_text=q["question_text"],
                    user_answer=user_ans,
                    interview_type=session_row.get("interview_type", "Technical Interview"),
                    difficulty=session_row.get("difficulty", "Medium"),
                    expected_points=[],
                    job_role=session_row.get("job_role", "Candidate"),
                    domain=session_row.get("domain", "General")
                )
                print(f"   -> Q{q['question_number']} evaluate_answer returned status='{ai_eval.get('status')}', provider='{ai_eval.get('provider')}'")
                print(f"      Keys in ai_eval returned by evaluate_answer: {list(ai_eval.keys())}")
                print(f"      'user_answer' present in ai_eval? {'user_answer' in ai_eval}")
                print(f"      'transcript' present in ai_eval? {'transcript' in ai_eval}")
                question_evaluations.append(ai_eval)

        # Step B: Now trace what generate_session_feedback sees:
        print("\n   Step B: Passing question_evaluations to generate_session_feedback:")
        has_transcript_evidence = False
        for idx, q_ev in enumerate(question_evaluations, 1):
            u_ans = q_ev.get("user_answer") or q_ev.get("transcript") or ""
            if u_ans and u_ans.strip():
                has_transcript_evidence = True
        print(f"   has_transcript_evidence flag inside generate_session_feedback: {has_transcript_evidence}")
        if not has_transcript_evidence:
            print("   >>> ROOT CAUSE CONFIRMED: generate_session_feedback immediately returned unavailable_response without calling Gemini!")
            
        # Step C: What happens if user_answer IS attached to question_evaluations:
        print("\n   Step C: Testing generate_session_feedback when user_answer IS attached:")
        for idx, q in enumerate(q_rows):
            if idx < len(question_evaluations):
                question_evaluations[idx]["user_answer"] = q.get("user_answer") or ""
                question_evaluations[idx]["question_text"] = q.get("question_text") or ""
        
        fb_result = await AIService.generate_session_feedback(
            job_role=session_row.get("job_role", "Candidate"),
            domain=session_row.get("domain", "General"),
            interview_type=session_row.get("interview_type", "Technical Interview"),
            difficulty=session_row.get("difficulty", "Medium"),
            total_duration=session_row.get("duration", 180),
            answered_count=len(question_evaluations),
            total_questions=len(q_rows),
            question_evaluations=question_evaluations,
            comm_res={"score": 70.0, "speaking_pace_wpm": 125, "filler_words_per_minute": 2, "grammar_quality": 75},
            conf_res={"score": 50.0, "eye_contact_consistency": 55},
            tech_res={"score": 65.0},
            prof_res={"score": 90.0},
            experience_level=session_row.get("experience_level"),
            overall_res={"overall_display_score": 68.0, "performance_rating": "Fair"}
        )
        print(f"   fb_result status: {fb_result.get('status')}")
        print(f"   fb_result provider: {fb_result.get('ai_provider')}")
        print(f"   fb_result model: {fb_result.get('ai_model')}")
        print(f"   strengths count: {len(fb_result.get('strengths', []))}")
        print(f"   weaknesses count: {len(fb_result.get('weaknesses', []))}")
        print(f"   suggestions count: {len(fb_result.get('improvement_suggestions', []))}")
        print(f"   practice count: {len(fb_result.get('practice_recommendations', []))}")
        print(f"   resources count: {len(fb_result.get('learning_resources', []))}")

        # 13. Details API inspection
        print("\n13. Inspecting GET recruiter details API output for this session:")
        cand_user = await db.fetchrow("SELECT id FROM users WHERE role IN ('recruiter', 'admin') LIMIT 1")
        rec_id = cand_user["id"] if cand_user else session_row["candidate_id"]
        current_user = {"id": str(rec_id), "role": "admin"}
        details = await get_recruiter_interview_details(SESSION_ID, current_user, db)
        print("   details['feedback'] keys:", list(details.get("feedback", {}).keys()))
        print("   details['feedback']['status']:", details.get("feedback", {}).get("status"))
        print("   details['feedback']['strengths']:", details.get("feedback", {}).get("strengths"))

    await close_pool()
    print("================ END DIAGNOSIS ================")

if __name__ == "__main__":
    asyncio.run(diagnose())
