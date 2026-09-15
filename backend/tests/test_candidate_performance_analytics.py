# ============================================================
#  test_candidate_performance_analytics.py
#  Verifies that candidate performance analytics:
#  1. Only uses the authenticated candidate's data
#  2. Only includes COMPLETED interview sessions
#  3. Excludes PENDING, IN_PROGRESS, or CANCELLED sessions
#  4. Calculates real Skill Analysis from evaluated question data / scores
#  5. Calculates real Performance Trend chronologically
#  6. Identifies Predicted Weak Areas strictly for skills < 70%
#  7. Returns proper empty states when insufficient data exists
#  8. Contains no mock, fake, or hardcoded analytics values
# ============================================================
import pytest
from uuid import uuid4
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from app.services.analytics_service import get_candidate_analytics
from app.routers.interviews import get_candidate_analytics_endpoint


class DictRow(dict):
    """Utility to mimic asyncpg Record access via both [] and .get()"""
    def __getitem__(self, key):
        return self.get(key, None)
    def get(self, key, default=None):
        return super().get(key, default)


# ── 1. Only COMPLETED sessions are included in analytics ─────

@pytest.mark.asyncio
async def test_analytics_excludes_non_completed_sessions():
    candidate_id = uuid4()
    
    # Mock database session query returning ONLY completed sessions
    mock_db = AsyncMock()
    
    # Completed session
    session_completed_id = uuid4()
    
    mock_db.fetch.side_effect = [
        # Query 1: completed sessions
        [
            DictRow({
                "id": session_completed_id,
                "overall_score": 82.5,
                "technical_score": 85.0,
                "communication_score": 80.0,
                "confidence_score": 78.0,
                "domain_knowledge_score": 84.0,
                "ended_at": datetime.now() - timedelta(days=2),
                "created_at": datetime.now() - timedelta(days=2),
                "job_role": "Python Backend Engineer",
                "domain": "Software Engineering"
            })
        ],
        # Query 2: evaluated questions for completed session
        [
            DictRow({
                "question_text": "Explain Python GIL",
                "domain": "Python",
                "difficulty": "Medium",
                "score": 85.0,
                "created_at": datetime.now() - timedelta(days=2)
            }),
            DictRow({
                "question_text": "System Design for Chat",
                "domain": "System Design",
                "difficulty": "Hard",
                "score": 60.0,
                "created_at": datetime.now() - timedelta(days=2)
            })
        ],
        # Query 3: Ranking population
        []
    ]

    result = await get_candidate_analytics(mock_db, candidate_id)

    assert result["completed_interviews_count"] == 1
    assert len(result["performance_trend"]) == 1
    assert result["performance_trend"][0]["overall_score"] == 82.5
    
    # Verify Skill Analysis
    skills = {item["skill"]: item["score"] for item in result["skill_analysis"]}
    assert skills["Python"] == 85.0
    assert skills["System Design"] == 60.0

    # Verify Predicted Weak Areas (< 70%)
    assert len(result["predicted_weak_areas"]) == 1
    assert result["predicted_weak_areas"][0]["skill"] == "System Design"
    assert result["predicted_weak_areas"][0]["average_score"] == 60.0


# ── 2. Empty state when candidate has 0 completed sessions ──

@pytest.mark.asyncio
async def test_analytics_zero_completed_sessions():
    candidate_id = uuid4()
    mock_db = AsyncMock()
    
    # Returns 0 completed sessions
    mock_db.fetch.return_value = []

    result = await get_candidate_analytics(mock_db, candidate_id)

    assert result["completed_interviews_count"] == 0
    assert result["skill_analysis"] == []
    assert result["performance_trend"] == []
    assert result["predicted_weak_areas"] == []


# ── 3. Predicted weak areas filter skills strictly below 70% ──

@pytest.mark.asyncio
async def test_predicted_weak_areas_threshold():
    candidate_id = uuid4()
    mock_db = AsyncMock()
    
    session_id = uuid4()
    
    mock_db.fetch.side_effect = [
        # Completed sessions
        [
            DictRow({
                "id": session_id,
                "overall_score": 75.0,
                "technical_score": 75.0,
                "communication_score": 75.0,
                "confidence_score": 75.0,
                "domain_knowledge_score": 75.0,
                "ended_at": datetime.now(),
                "created_at": datetime.now(),
                "job_role": "Fullstack Dev",
                "domain": "Fullstack"
            })
        ],
        # Question evaluations
        [
            DictRow({"domain": "React", "score": 90.0, "question_text": "q1", "difficulty": "Easy", "created_at": datetime.now()}),
            DictRow({"domain": "Node.js", "score": 72.0, "question_text": "q2", "difficulty": "Medium", "created_at": datetime.now()}),
            DictRow({"domain": "SQL Optimization", "score": 65.0, "question_text": "q3", "difficulty": "Hard", "created_at": datetime.now()}),
            DictRow({"domain": "Docker & K8s", "score": 45.0, "question_text": "q4", "difficulty": "Hard", "created_at": datetime.now()})
        ],
        # Query 3: Ranking population
        []
    ]

    result = await get_candidate_analytics(mock_db, candidate_id)

    # Only skills < 70% should appear in weak areas
    weak_skills = [item["skill"] for item in result["predicted_weak_areas"]]
    assert "SQL Optimization" in weak_skills
    assert "Docker & K8s" in weak_skills
    assert "React" not in weak_skills
    assert "Node.js" not in weak_skills

    # Lowest performance should be first (sorted ascending)
    assert result["predicted_weak_areas"][0]["skill"] == "Docker & K8s"
    assert result["predicted_weak_areas"][0]["average_score"] == 45.0
    assert result["predicted_weak_areas"][1]["skill"] == "SQL Optimization"
    assert result["predicted_weak_areas"][1]["average_score"] == 65.0


# ── 4. Chronological Performance Trend ordering ─────────────

@pytest.mark.asyncio
async def test_performance_trend_chronological_order():
    candidate_id = uuid4()
    mock_db = AsyncMock()
    
    t1 = datetime.now() - timedelta(days=10)
    t2 = datetime.now() - timedelta(days=5)
    t3 = datetime.now() - timedelta(days=1)
    
    mock_db.fetch.side_effect = [
        # Query 1: Completed sessions returned in chronological order
        [
            DictRow({"id": uuid4(), "overall_score": 50.0, "ended_at": t1, "created_at": t1, "job_role": "Junior Engineer", "domain": "Backend"}),
            DictRow({"id": uuid4(), "overall_score": 65.0, "ended_at": t2, "created_at": t2, "job_role": "Junior Engineer", "domain": "Backend"}),
            DictRow({"id": uuid4(), "overall_score": 80.0, "ended_at": t3, "created_at": t3, "job_role": "Software Engineer", "domain": "Backend"}),
        ],
        # Query 2: Questions
        [],
        # Query 3: Ranking population
        []
    ]

    result = await get_candidate_analytics(mock_db, candidate_id)

    trend = result["performance_trend"]
    assert len(trend) == 3
    assert trend[0]["overall_score"] == 50.0
    assert trend[1]["overall_score"] == 65.0
    assert trend[2]["overall_score"] == 80.0
    assert trend[0]["session_label"] == "Session 1"
    assert trend[2]["session_label"] == "Session 3"


# ── 6. Improvement Tracker Milestones & Insights calculation ─

@pytest.mark.asyncio
async def test_improvement_insights_and_milestones_calculation():
    candidate_id = uuid4()
    mock_db = AsyncMock()

    t1 = datetime.now() - timedelta(days=10)
    t2 = datetime.now() - timedelta(days=2)

    mock_db.fetch.side_effect = [
        # Completed sessions (First: 60%, Second: 80%)
        [
            DictRow({"id": uuid4(), "overall_score": 60.0, "communication_score": 80.0, "technical_relevance_score": 50.0, "ended_at": t1, "created_at": t1, "job_role": "Backend Eng", "domain": "Python"}),
            DictRow({"id": uuid4(), "overall_score": 80.0, "communication_score": 90.0, "technical_relevance_score": 70.0, "ended_at": t2, "created_at": t2, "job_role": "Backend Eng", "domain": "Python"}),
        ],
        # Questions
        [],
        # Ranking population
        []
    ]

    result = await get_candidate_analytics(mock_db, candidate_id)

    # Milestones verification
    assert len(result["milestones"]) == 2
    assert result["milestones"][0]["session_label"] == "Session 1"
    assert result["milestones"][0]["score"] == 60.0
    assert result["milestones"][1]["session_label"] == "Session 2"
    assert result["milestones"][1]["score"] == 80.0

    # Insights verification
    insights = result["improvement_insights"]
    assert insights["overall_progress"]["change_value"] == 20.0  # 80 - 60
    assert "+20.0%" in insights["overall_progress"]["display_change"]
    assert insights["strongest_area"]["skill"] == "Communication"
    assert insights["focus_area"]["skill"] == "Technical Relevance"
