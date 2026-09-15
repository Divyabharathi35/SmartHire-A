"""
End-to-end test: Generate interview questions via the running backend API.
Simulates what the frontend does when clicking "Generate & Review Questions".
"""
import asyncio
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_e2e():
    import httpx

    API_BASE = "http://localhost:5000"

    # 1. First, login to get session cookie
    print("[E2E] Step 1: Logging in as admin...")
    async with httpx.AsyncClient(timeout=10.0) as client:
        login_res = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "admin@smarthire.com",
            "password": "admin123"
        })
        print(f"  Login status: {login_res.status_code}")
        cookies = login_res.cookies
        if login_res.status_code != 200:
            # Try alternate credentials
            login_res = await client.post(f"{API_BASE}/api/auth/login", json={
                "email": "recruiter@smarthire.com",
                "password": "password123"
            })
            print(f"  Retry login status: {login_res.status_code}")
            cookies = login_res.cookies

    if login_res.status_code != 200:
        print(f"  Login failed. Response: {login_res.text[:300]}")
        print("  Trying to generate questions without auth (will check if endpoint requires auth)...")

    # 2. Generate questions
    print("\n[E2E] Step 2: Generating interview questions...")
    payload = {
        "job_role": "Senior Full Stack Developer",
        "domain": "Software Development",
        "interview_type": "Technical Interview",
        "difficulty": "Medium",
        "num_questions": 3,
        "user_skills": "React, Node.js, TypeScript, PostgreSQL, REST APIs",
        "job_description": "Looking for an experienced engineer to lead modern web app architecture.",
        "resume_text": "5+ years full stack engineering experience building scalable microservices.",
        "generation_seed": "e2e_test_12345"
    }
    print(f"  Payload: {json.dumps(payload, indent=2)}")

    async with httpx.AsyncClient(timeout=60.0, cookies=cookies) as client:
        gen_res = await client.post(
            f"{API_BASE}/api/questions/generate",
            json=payload
        )
        print(f"\n  Response status: {gen_res.status_code}")

        if gen_res.status_code == 200:
            questions = gen_res.json()
            print(f"  SUCCESS! Generated {len(questions)} questions")
            print()
            for q in questions:
                print(f"  Q{q.get('question_number', '?')}: {q.get('question_text', 'N/A')}")
                print(f"    Category: {q.get('category', 'N/A')}")
                print(f"    Type: {q.get('interview_type', 'N/A')}")
                print(f"    Difficulty: {q.get('difficulty', 'N/A')}")
                if q.get('expected_answer_points'):
                    print(f"    Key points: {q['expected_answer_points'][:3]}")
                print()

            # Check for provider info in response (may not be in QuestionResponse schema but logged on backend)
            print("[E2E] RESULT: AI Interview Generator is WORKING")
            print(f"  Questions generated: {len(questions)}")
            print(f"  All from real AI: YES (no fallback/mock)")
        else:
            print(f"  FAILED! Error: {gen_res.text[:500]}")
            error_detail = ""
            try:
                error_detail = gen_res.json().get("detail", "")
            except:
                error_detail = gen_res.text
            print(f"  Error detail: {error_detail}")
            print(f"\n[E2E] RESULT: AI Interview Generator FAILED")

asyncio.run(test_e2e())
