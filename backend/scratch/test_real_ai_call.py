import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.ai_service import AIService

async def test():
    q_text = "In a large React application using TypeScript, how would you design a custom type-safe hook for data fetching with caching and error handling?"
    ans = "in a lot scale react application using the types group I design a custom type safe hook using generics and useEffect, storing responses in a map cache and returning error and loading states"
    
    print("Testing evaluate_answer with real answer...")
    eval_res = await AIService.evaluate_answer(
        question_text=q_text,
        user_answer=ans,
        interview_type="Technical Interview",
        difficulty="Medium",
        expected_points=["Generics", "Cache invalidation", "Error states"],
        job_role="Senior Full Stack Developer",
        domain="Software Development"
    )
    print("eval_res status:", eval_res.get("status"))
    print("eval_res provider:", eval_res.get("provider"))
    print("eval_res technical_accuracy:", eval_res.get("technical_accuracy"))
    print("eval_res strengths:", eval_res.get("strengths"))
    print("eval_res weaknesses:", eval_res.get("weaknesses"))
    
    # Now attach user_answer and question_text
    eval_res["user_answer"] = ans
    eval_res["question_text"] = q_text
    
    print("\nTesting generate_session_feedback with real evaluations...")
    fb_res = await AIService.generate_session_feedback(
        job_role="Senior Full Stack Developer",
        domain="Software Development",
        interview_type="Technical Interview",
        difficulty="Medium",
        total_duration=191,
        answered_count=1,
        total_questions=3,
        question_evaluations=[eval_res],
        comm_res={"score": 70.75, "speaking_pace_wpm": 120, "filler_words_per_minute": 2, "grammar_quality": 75},
        conf_res={"score": 46.67, "eye_contact_consistency": 50},
        tech_res={"score": 65.0},
        prof_res={"score": 94.25},
        experience_level="Mid Level (3-5 yrs)",
        overall_res={"overall_display_score": 68.0, "performance_rating": "Fair"}
    )
    print("fb_res status:", fb_res.get("status"))
    print("fb_res provider:", fb_res.get("ai_provider"))
    print("fb_res strengths:", fb_res.get("strengths"))
    print("fb_res weaknesses:", fb_res.get("weaknesses"))
    print("fb_res suggestions:", fb_res.get("improvement_suggestions"))
    print("fb_res practice:", fb_res.get("practice_recommendations"))
    print("fb_res resources:", fb_res.get("learning_resources"))

if __name__ == "__main__":
    asyncio.run(test())
