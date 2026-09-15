import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.ai_service import AIService
import app.services.ai_service as ai_mod

# Point to gemini-3.6-flash
ai_mod.GEMINI_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]

async def test():
    q1 = {
        "user_answer": "in a lot scale react application using the types group I design a custom type safe hook using generics and useEffect, storing responses in a map cache and returning error and loading states",
        "question_text": "In a large React application using TypeScript, how would you design a custom type-safe hook for data fetching with caching and error handling?",
        "score": 7.0,
        "strengths": ["Understands TypeScript generics", "Mentions custom hook pattern"],
        "weaknesses": ["Missed cache invalidation strategies"]
    }
    q2 = {
        "user_answer": "in a high through no J is microservice running St Apa CPU intensive Torchlight p",
        "question_text": "In a high-throughput Node.js microservice running REST APIs, CPU-intensive tasks block the event loop. How do you mitigate this?",
        "score": 3.0,
        "strengths": [],
        "weaknesses": ["Incomplete response on Node.js worker threads and event loop"]
    }
    q3 = {
        "user_answer": "you are building a future in a poster for not JS back and by multiple conquer mi",
        "question_text": "You are building a feature in PostgreSQL for a Node.js backend where multiple concurrent transactions modify the same account balance. How do you prevent race conditions?",
        "score": 6.0,
        "strengths": ["Recognizes concurrency issues"],
        "weaknesses": ["Did not mention SELECT FOR UPDATE or transaction isolation levels"]
    }
    
    print("Testing generate_session_feedback with gemini-3.6-flash directly...")
    res = await AIService.generate_session_feedback(
        job_role="Senior Full Stack Developer",
        domain="Software Development",
        interview_type="Technical Interview",
        difficulty="Medium",
        total_duration=191,
        answered_count=3,
        total_questions=3,
        question_evaluations=[q1, q2, q3],
        comm_res={"score": 70.75, "speaking_pace_wpm": 120, "filler_words_per_minute": 2, "grammar_quality": 75},
        conf_res={"score": 46.67, "eye_contact_consistency": 50},
        tech_res={"score": 4.67},
        prof_res={"score": 94.25},
        experience_level="Mid Level (3-5 yrs)",
        overall_res={"overall_display_score": 48.43, "performance_rating": "Needs Improvement"}
    )
    print("STATUS:", res.get("status"))
    print("PROVIDER:", res.get("ai_provider"))
    print("MODEL:", res.get("ai_model"))
    print("STRENGTHS:", res.get("strengths"))
    print("WEAKNESSES:", res.get("weaknesses"))
    print("SUGGESTIONS:", res.get("improvement_suggestions"))
    print("PRACTICE:", res.get("practice_recommendations"))
    print("RESOURCES:", res.get("learning_resources"))

if __name__ == "__main__":
    asyncio.run(test())
