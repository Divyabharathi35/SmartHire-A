# ============================================================
#  test_requirements_8_9.py — PyTest Suite for Requirements 8 & 9
#  (Dashboard Analytics, Notifications & Reports)
# ============================================================
import json
import httpx
import pytest
import uuid
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from datetime import datetime, timezone

from app.services.analytics_service import CandidateAnalyticsService
from app.services.notification_service import NotificationService
from app.services.ai_service import AIService
from app.services.scoring_engine import RealAIScoringEngine

CAND_ID = "11111111-1111-1111-1111-111111111111"
SESS_ID = "22222222-2222-2222-2222-222222222222"


# ── Test 1: Candidate Data Isolation ────────────────────────────────────────

@pytest.mark.asyncio
async def test_candidate_data_isolation():
    mock_db = AsyncMock()
    mock_db.fetch.side_effect = [
        [],  # interview_results query
        [],  # question_results query
        []   # population ranking query
    ]
    mock_db.fetchrow.return_value = None

    res = await CandidateAnalyticsService.get_candidate_analytics(mock_db, candidate_id=CAND_ID)

    first_query_args = mock_db.fetch.call_args_list[0][0]
    assert CAND_ID in first_query_args
    assert res["candidate_id"] == CAND_ID
    assert res["overall_summary"]["status"] == "insufficient_data"


# ── Test 2: Interview History Query & Mapping ────────────────────────────────

@pytest.mark.asyncio
async def test_interview_history_query():
    mock_db = AsyncMock()
    now_dt = datetime.now(timezone.utc)
    mock_db.fetch.side_effect = [
        # Session rows
        [
            {
                "id": uuid.UUID(SESS_ID),
                "candidate_id": uuid.UUID(CAND_ID),
                "user_id": uuid.UUID(CAND_ID),
                "created_by": uuid.UUID(CAND_ID),
                "job_role": "Senior Full Stack Developer",
                "domain": "Full Stack",
                "interview_type": "Technical Interview",
                "difficulty": "Hard",
                "experience_level": "Senior",
                "num_questions": 5,
                "user_skills": "React, Node.js",
                "job_description": "",
                "resume_text": "",
                "status": "completed",
                "score": 78.5,
                "total_questions": 1,
                "completed_questions": 1,
                "current_question_index": 1,
                "started_at": now_dt,
                "ended_at": now_dt,
                "created_at": now_dt,
                "updated_at": now_dt,
            }
        ],
        # Question rows for session
        [
            {
                "id": uuid.UUID("33333333-3333-3333-3333-333333333333"),
                "session_id": uuid.UUID(SESS_ID),
                "question_number": 1,
                "question_text": "What is PostgreSQL connection pooling?",
                "interview_type": "Technical Interview",
                "domain": "Database",
                "difficulty": "Hard",
                "expected_answer_points": "[]",
                "category": "PostgreSQL",
                "user_answer": "Connection pooling reuses database connections...",
                "sample_answer": "",
                "feedback": "Good answer",
                "score": 85.0
            }
        ]
    ]
    mock_db.fetchrow.return_value = {"overall_score": 78.5}

    from app.routers.interviews import get_interview_history
    history = await get_interview_history(
        current_user={"id": CAND_ID, "role": "candidate", "name": "Divya", "email": "divya@example.com"},
        db=mock_db
    )

    assert len(history) == 1
    assert history[0]["job_role"] == "Senior Full Stack Developer"
    assert history[0]["score"] == 78.5


# ── Test 3: Score Breakdown Formula (30/25/30/15) ───────────────────────────

def test_score_breakdown_formula():
    comm = 82.0
    conf = 74.0
    tech = 79.0
    prof = 81.0

    overall = RealAIScoringEngine.calculate_overall_score(
        communication_score=comm,
        confidence_score=conf,
        technical_relevance_score=tech,
        professionalism_score=prof
    )

    assert overall["status"] == "Available"
    assert overall["communication_weighted"] == 24.6
    assert overall["confidence_weighted"] == 18.5
    assert overall["technical_relevance_weighted"] == 23.7
    assert overall["professionalism_weighted"] == 12.15
    assert abs(overall["overall_score"] - 78.95) < 0.1


# ── Test 4: Skill Analytics Calculation ──────────────────────────────────────

@pytest.mark.asyncio
async def test_skill_analytics_calculation():
    mock_db = AsyncMock()
    mock_db.fetch.side_effect = [
        [
            {
                "result_id": "r1", "session_id": SESS_ID, "overall_score": 78.5,
                "communication_score": 82.0, "confidence_score": 74.0,
                "technical_relevance_score": 79.0, "professionalism_score": 81.0,
                "completed_at": datetime.now(timezone.utc), "job_role": "Full Stack",
                "domain": "Web", "user_skills": "React, Node.js, PostgreSQL",
                "interview_type": "Technical", "total_duration": 1200
            }
        ],
        [
            {"question_score": 85.0, "answer_type": "Frontend", "category": "React", "domain": "Web", "question_text": "q1", "user_skills": "React, Node.js"},
            {"question_score": 76.0, "answer_type": "Backend", "category": "Node.js", "domain": "Web", "question_text": "q2", "user_skills": "React, Node.js"},
            {"question_score": 68.0, "answer_type": "Database", "category": "PostgreSQL", "domain": "Web", "question_text": "q3", "user_skills": "PostgreSQL"}
        ],
        [
            {"cand_user_id": CAND_ID, "best_score": 78.5}
        ]
    ]
    mock_db.fetchrow.return_value = {"best_score": 78.5}

    res = await CandidateAnalyticsService.get_candidate_analytics(mock_db, candidate_id=CAND_ID)

    skills = {s["skill"]: s["score"] for s in res["skill_analytics"]}
    assert "React" in skills
    assert skills["React"] is not None
    assert "PostgreSQL" in skills
    assert skills["PostgreSQL"] == 68.0


# ── Test 5: Weak-Area Calculation & Threshold Verification ───────────────────

@pytest.mark.asyncio
async def test_weak_area_prediction_threshold():
    mock_db = AsyncMock()
    mock_db.fetch.side_effect = [
        [
            {
                "result_id": "r1", "session_id": SESS_ID, "overall_score": 78.5,
                "communication_score": 82.0, "confidence_score": 74.0,
                "technical_relevance_score": 79.0, "professionalism_score": 81.0,
                "completed_at": datetime.now(timezone.utc), "job_role": "Full Stack",
                "domain": "Web", "user_skills": "PostgreSQL",
                "interview_type": "Technical", "total_duration": 1200
            }
        ],
        [
            {"question_score": 65.0, "answer_type": "Database", "category": "PostgreSQL", "domain": "Web", "question_text": "q1", "user_skills": "PostgreSQL"},
            {"question_score": 68.0, "answer_type": "Database", "category": "PostgreSQL", "domain": "Web", "question_text": "q2", "user_skills": "PostgreSQL"}
        ],
        [{"cand_user_id": CAND_ID, "best_score": 78.5}]
    ]
    mock_db.fetchrow.return_value = {"best_score": 78.5}

    res = await CandidateAnalyticsService.get_candidate_analytics(mock_db, candidate_id=CAND_ID)

    weak_areas = res["predicted_weak_areas"]
    assert len(weak_areas) > 0
    postgre_weak = next((w for w in weak_areas if w["skill"] == "PostgreSQL"), None)
    assert postgre_weak is not None
    assert postgre_weak["average_score"] < 70.0


# ── Test 6: Performance Trends Chronological Ordering ───────────────────────

@pytest.mark.asyncio
async def test_performance_trends_chronological():
    mock_db = AsyncMock()
    d1 = datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc)
    d2 = datetime(2026, 9, 3, 10, 0, 0, tzinfo=timezone.utc)
    d3 = datetime(2026, 9, 5, 10, 0, 0, tzinfo=timezone.utc)

    mock_db.fetch.side_effect = [
        [
            {"result_id": "r1", "session_id": "s1", "overall_score": 62.0, "communication_score": 65.0, "confidence_score": 60.0, "technical_relevance_score": 60.0, "professionalism_score": 65.0, "completed_at": d1, "job_role": "Dev", "domain": "Web", "user_skills": "", "interview_type": "Tech", "total_duration": 1000},
            {"result_id": "r2", "session_id": "s2", "overall_score": 71.0, "communication_score": 75.0, "confidence_score": 70.0, "technical_relevance_score": 70.0, "professionalism_score": 72.0, "completed_at": d2, "job_role": "Dev", "domain": "Web", "user_skills": "", "interview_type": "Tech", "total_duration": 1000},
            {"result_id": "r3", "session_id": "s3", "overall_score": 78.5, "communication_score": 82.0, "confidence_score": 74.0, "technical_relevance_score": 79.0, "professionalism_score": 81.0, "completed_at": d3, "job_role": "Dev", "domain": "Web", "user_skills": "", "interview_type": "Tech", "total_duration": 1000},
        ],
        [], # questions
        []  # population
    ]
    mock_db.fetchrow.return_value = None

    res = await CandidateAnalyticsService.get_candidate_analytics(mock_db, candidate_id=CAND_ID)

    trends = res["performance_trends"]
    assert len(trends) == 3
    assert trends[0]["score"] == 62.0
    assert trends[1]["score"] == 71.0
    assert trends[2]["score"] == 78.5
    assert trends[0]["interview_number"] == 1
    assert trends[2]["interview_number"] == 3


# ── Test 7: Candidate Ranking Metrics Calculation ────────────────────────────

@pytest.mark.asyncio
async def test_candidate_ranking_calculation():
    mock_db = AsyncMock()
    mock_db.fetchrow.return_value = {"best_score": 78.5}
    mock_db.fetch.return_value = [
        {"cand_user_id": "u1", "best_score": 92.0},
        {"cand_user_id": "u2", "best_score": 88.0},
        {"cand_user_id": "u3", "best_score": 85.0},
        {"cand_user_id": CAND_ID, "best_score": 78.5},
        *([{"cand_user_id": f"u{i}", "best_score": 60.0} for i in range(5, 26)])
    ]

    ranking = await CandidateAnalyticsService.calculate_candidate_ranking(mock_db, candidate_id=CAND_ID)

    assert ranking["status"] == "available"
    assert ranking["rank"] == 4
    assert ranking["total_candidates"] == 25
    assert ranking["display"] == "#4 out of 25 candidates"


# ── Test 8: Downloadable Candidate Report Endpoint ────────────────────────────

@pytest.mark.asyncio
async def test_downloadable_report_endpoint():
    mock_db = AsyncMock()
    mock_db.fetchrow.side_effect = [
        # Session row
        {
            "id": uuid.UUID(SESS_ID),
            "candidate_id": uuid.UUID(CAND_ID),
            "user_id": uuid.UUID(CAND_ID),
            "job_role": "Senior Full Stack Developer",
            "domain": "Full Stack",
            "interview_type": "Technical Interview",
            "difficulty": "Hard",
            "status": "completed"
        },
        # Candidate User row
        {"name": "Divya", "email": "divya@example.com"},
        # Interview Results row
        {
            "session_id": uuid.UUID(SESS_ID),
            "overall_score": 78.5,
            "communication_score": 82.0,
            "confidence_score": 74.0,
            "technical_relevance_score": 79.0,
            "professionalism_score": 81.0,
            "performance_rating": "Strong Pass",
            "total_duration": 1500,
            "strengths": json.dumps(["Clear communication", "Good React knowledge"]),
            "weaknesses": json.dumps(["Improve database optimization"]),
            "improvement_suggestions": json.dumps(["Give more complete technical explanations"]),
            "practice_recommendations": json.dumps([]),
            "learning_resources": json.dumps([]),
            "completed_at": datetime.now(timezone.utc)
        }
    ]
    mock_db.fetch.return_value = [
        {
            "question_number": 1,
            "question_text": "Explain React state management.",
            "user_answer": "State management controls dynamic UI updates...",
            "score": 85.0,
            "evaluation": "Excellent answer."
        }
    ]

    from app.routers.interviews import download_candidate_report
    res = await download_candidate_report(
        session_id=uuid.UUID(SESS_ID),
        current_user={"id": CAND_ID, "role": "candidate"},
        db=mock_db
    )

    assert res.status_code == 200
    assert "attachment" in res.headers["content-disposition"]


# ── Test 9: AI Summary Persistence & Reuse ────────────────────────────────────

@pytest.mark.asyncio
async def test_ai_summary_persistence_and_reuse():
    mock_db = AsyncMock()
    mock_db.fetchrow.return_value = {
        "feedback_status": "available",
        "strengths": json.dumps(["Clear communication"]),
        "weaknesses": json.dumps(["Database optimization"]),
        "improvement_suggestions": json.dumps(["Study connection pools"]),
        "practice_recommendations": json.dumps([]),
        "learning_resources": json.dumps([]),
        "ai_provider": "gemini (gemini-3.5-flash)",
        "ai_model": "gemini-3.5-flash",
        "feedback_generated_at": datetime.now(timezone.utc)
    }

    with patch("app.services.ai_service.AIService.generate_session_feedback") as mock_gen:
        res_row = mock_db.fetchrow.return_value
        assert res_row["feedback_status"] == "available"
        mock_gen.assert_not_called()


# ── Test 10: Gemini Quota (429) → Unavailable Status ────────────────────────────

@pytest.mark.asyncio
async def test_gemini_quota_to_unavailable_feedback():
    with patch.object(AIService, "get_gemini_api_key", return_value="fake_key"):
        gemini_429_resp = MagicMock()
        gemini_429_resp.status_code = 429
        gemini_429_resp.text = "RESOURCE_EXHAUSTED quota limit reached"

        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = gemini_429_resp
            res = await AIService.generate_session_feedback(
                job_role="Senior Full Stack Developer",
                domain="Full Stack",
                interview_type="Technical Interview",
                difficulty="Hard",
                total_duration=1200,
                answered_count=5,
                total_questions=5,
                question_evaluations=[{
                    "question_text": "Explain React hooks",
                    "user_answer": "Hooks let you use state and lifecycle features without writing a class.",
                    "score": 85.0
                }],
                comm_res={"score": 80.0},
                conf_res={"score": 75.0},
                tech_res={"score": 85.0},
                prof_res={"score": 90.0},
                experience_level="Senior",
                overall_res={"overall_score": 81.5}
            )

            assert res["status"] == "unavailable"
            assert res["ai_provider"] is None


# ── Test 11: Unavailable AI Providers Handling ─────────────────────────────

@pytest.mark.asyncio
async def test_unavailable_ai_providers_handling():
    with patch.object(AIService, "get_gemini_api_key", return_value="fake_key"):
        fail_resp = MagicMock()
        fail_resp.status_code = 500
        fail_resp.text = "Service Error"
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = fail_resp
            res = await AIService.generate_session_feedback(
                job_role="Senior Full Stack Developer",
                domain="Full Stack",
                interview_type="Technical Interview",
                difficulty="Hard",
                total_duration=1200,
                answered_count=5,
                total_questions=5,
                question_evaluations=[{
                    "question_text": "Explain React hooks",
                    "user_answer": "Hooks let you use state and lifecycle features without writing a class.",
                    "score": 85.0
                }],
                comm_res={"score": 80.0},
                conf_res={"score": 75.0},
                tech_res={"score": 85.0},
                prof_res={"score": 90.0},
                experience_level="Senior",
                overall_res={"overall_score": 81.5}
            )

            assert res["status"] == "unavailable"
            assert len(res["strengths"]) == 0


# ── Test 12: Notification & Alert Creation ───────────────────────────────────

@pytest.mark.asyncio
async def test_notification_creation():
    mock_db = AsyncMock()
    mock_db.fetchrow.return_value = {
        "id": "notif-123",
        "user_id": CAND_ID,
        "session_id": SESS_ID,
        "type": "session_alert",
        "title": "🔔 Interview Started",
        "message": "Your technical interview session has started.",
        "event_type": "start",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    }

    notif = await NotificationService.create_session_start_alert(
        mock_db, user_id=CAND_ID, session_id=SESS_ID, job_role="Senior Full Stack Developer"
    )

    assert notif["type"] == "session_alert"
    assert notif["event_type"] == "start"
    assert "Started" in notif["title"]


# ── Test 13: Candidate Comparison Endpoint & Difference Math ──────────────────

@pytest.mark.asyncio
async def test_candidate_comparison_endpoint():
    from app.routers.interviews import get_candidate_comparison
    mock_db = AsyncMock()
    recruiter_user = {"id": uuid.UUID("33333333-3333-3333-3333-333333333333"), "role": "recruiter"}

    sess_1 = uuid.UUID("44444444-4444-4444-4444-444444444444")
    sess_2 = uuid.UUID("55555555-5555-5555-5555-555555555555")

    mock_rows = [
        {
            "session_id": sess_1,
            "candidate_id": uuid.UUID(CAND_ID),
            "candidate_name": "Alice Smith",
            "job_role": "Backend Engineer",
            "status": "COMPLETED",
            "overall_score": 88.0,
            "technical_score": 90.0,
            "communication_score": 85.0,
            "confidence_score": 88.0,
            "professionalism_score": 90.0,
            "recommendation": "Shortlisted"
        },
        {
            "session_id": sess_2,
            "candidate_id": uuid.UUID("66666666-6666-6666-6666-666666666666"),
            "candidate_name": "Bob Jones",
            "job_role": "Backend Engineer",
            "status": "COMPLETED",
            "overall_score": 78.0,
            "technical_score": 82.0,
            "communication_score": 75.0,
            "confidence_score": 76.0,
            "professionalism_score": 80.0,
            "recommendation": "Review Required"
        }
    ]
    mock_db.fetch.return_value = mock_rows

    res = await get_candidate_comparison(
        current_user=recruiter_user,
        session_id_a=str(sess_1),
        session_id_b=str(sess_2),
        db=mock_db
    )

    assert res.status == "available"
    assert res.candidate_a.name == "Alice Smith"
    assert res.candidate_a.overall_score == 88.0
    assert res.candidate_b.name == "Bob Jones"
    assert res.candidate_b.overall_score == 78.0

    # Differences: 90 - 82 = +8, 88 - 78 = +10, 85 - 75 = +10, 88 - 76 = +12
    assert res.comparison.technical_difference == 8.0
    assert res.comparison.overall_difference == 10.0
    assert res.comparison.communication_difference == 10.0
    assert res.comparison.confidence_difference == 12.0


# ── Test 14: Candidate Ranking Domain & Interview Type Filtering ────────────

@pytest.mark.asyncio
async def test_candidate_ranking_domain_and_interview_type_filtering():
    from app.routers.interviews import list_recruiter_interviews
    mock_db = AsyncMock()
    recruiter_user = {"id": uuid.UUID("33333333-3333-3333-3333-333333333333"), "role": "recruiter"}

    sess_1 = uuid.UUID("44444444-4444-4444-4444-444444444444")
    mock_db.fetch.return_value = [
        {
            "session_id": sess_1,
            "id": sess_1,
            "candidate_id": uuid.UUID(CAND_ID),
            "candidate_name": "Carol White",
            "candidate_email": "carol@example.com",
            "job_role": "AI Engineer",
            "domain": "AI/ML",
            "interview_type": "Technical",
            "difficulty": "Hard",
            "experience_level": "Senior",
            "status": "COMPLETED",
            "total_questions": 5,
            "completed_questions": 5,
            "completion_percentage": 100.0,
            "duration": 1200,
            "overall_score": 94.0,
            "recommendation": "Shortlisted",
            "completed_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }
    ]

    res = await list_recruiter_interviews(
        current_user=recruiter_user,
        domain="AI/ML",
        interview_type="Technical",
        sort_by="score",
        db=mock_db
    )

    assert len(res) == 1
    assert res[0]["candidate_name"] == "Carol White"
    assert res[0]["domain"] == "AI/ML"
    assert res[0]["interview_type"] == "Technical"

    # Verify SQL query received domain and interview_type filters
    call_query, *call_args = mock_db.fetch.call_args_list[0][0]
    assert "%ai/ml%" in call_args
    assert "%technical%" in call_args


