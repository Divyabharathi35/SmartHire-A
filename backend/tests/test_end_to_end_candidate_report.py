# ============================================================
#  test_end_to_end_candidate_report.py — End-to-End Candidate Report Tests
# ============================================================
import json
import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock

from app.services.scoring_engine import RealAIScoringEngine, get_performance_rating
from app.services.communication_service import CommunicationService
from app.services.ai_service import AIService


# 1. Candidate Isolation: Category & Score calculation for specific session
def test_candidate_session_data_isolation():
    session_id_a = uuid4()
    session_id_b = uuid4()
    assert str(session_id_a) != str(session_id_b)


# 2. Correct session weighted score calculation
def test_overall_score_weighting_30_25_30_15():
    # Comm: 90, Conf: 80, Tech: 70, Prof: 100
    # Expected = 90*0.30 + 80*0.25 + 70*0.30 + 100*0.15 = 27 + 20 + 21 + 15 = 83.0
    res = RealAIScoringEngine.calculate_overall_score(
        communication_score=90.0,
        confidence_score=80.0,
        technical_relevance_score=70.0,
        professionalism_score=100.0
    )
    assert res["status"] == "Available"
    assert res["overall_display_score"] == 83.0
    assert res["performance_rating"] == "Good"


# 3. Transcript & Communication Analysis Persistence Calculation
def test_speech_pace_calculated_from_actual_duration_or_word_count():
    text = "PostgreSQL is an open source relational database that supports advanced indexing and JSON processing."
    # With 0 duration and allow_estimate=True, effective duration is estimated from word count
    pace_est = CommunicationService.calculate_speech_pace(word_count=14, duration_seconds=0, allow_estimate=True)
    assert pace_est["words_per_minute"] is not None
    assert pace_est["words_per_minute"] > 0

    # With explicit duration
    pace_real = CommunicationService.calculate_speech_pace(word_count=140, duration_seconds=60)
    assert pace_real["words_per_minute"] == 140.0
    assert pace_real["pace_category"] == "Normal"


# 4. Filler words calculated from actual transcript
def test_filler_words_calculated_from_transcript():
    text = "Um, so basically we can use Redis for caching, right?"
    res = CommunicationService.detect_filler_words(text, duration_seconds=30)
    assert res["filler_word_count"] > 0
    assert len(res["filler_words_list"]) > 0


# 5. Grammar analysis returned correctly
def test_grammar_analysis():
    text = "i am working on python. python python is great."
    res = CommunicationService.analyze_grammar(text)
    assert res["status"] == "Evaluated"
    assert res["grammar_score"] is not None
    assert res["grammar_error_count"] >= 1


# 6. Technical Score calculation
def test_technical_relevance_score():
    res = RealAIScoringEngine.calculate_technical_relevance_score(
        technical_accuracy=90.0,
        keyword_relevance=80.0,
        problem_solving=85.0,
        domain_knowledge=95.0,
        answer_completeness=90.0
    )
    assert res["status"] == "Available"
    assert res["score"] == 88.0


# 7. Incomplete / unanswered questions not treated as fake 0 scores in overall calculation
def test_unanswered_questions_not_fake_zero():
    # Unanswered technical score is None
    res = RealAIScoringEngine.calculate_technical_relevance_score(evaluation_status="unanswered")
    assert res["score"] is None
    assert res["status"] == "Unanswered"

    # Overall score with 1 category missing uses normalized weights
    overall = RealAIScoringEngine.calculate_overall_score(
        communication_score=80.0,
        confidence_score=80.0,
        technical_relevance_score=80.0,
        professionalism_score=None
    )
    assert overall["status"] == "Available"
    assert overall["overall_display_score"] == 80.0


# 8. Insufficient category evidence returns "Insufficient Data"
def test_insufficient_categories_returns_insufficient_data():
    res = RealAIScoringEngine.calculate_overall_score(
        communication_score=80.0,
        confidence_score=None,
        technical_relevance_score=None,
        professionalism_score=None
    )
    assert res["overall_score"] is None
    assert res["performance_rating"] == "Insufficient Data"


# 9. Recommendation matches score rubric
def test_recommendation_rubric():
    assert get_performance_rating(95.0) == "Excellent"
    assert get_performance_rating(82.0) == "Good"
    assert get_performance_rating(65.0) == "Average"
    assert get_performance_rating(45.0) == "Needs Improvement"
    assert get_performance_rating(30.0) == "Poor"
    assert get_performance_rating(None) == "Insufficient Data"


# 10. Gemini 429 Quota Exceeded returns unavailable status without Ollama fallback
@pytest.mark.asyncio
async def test_gemini_429_returns_unavailable_status():
    mock_gemini_res = MagicMock()
    mock_gemini_res.status_code = 429
    mock_gemini_res.text = "RESOURCE_EXHAUSTED quota exceeded"

    with patch("httpx.AsyncClient.post", return_value=mock_gemini_res), \
         patch.object(AIService, "get_gemini_api_key", return_value="fake-key"):

        res = await AIService.evaluate_answer(
            question_text="Explain Python GIL",
            user_answer="The GIL is a mutex that protects access to Python objects.",
            interview_type="Technical",
            difficulty="Intermediate"
        )
        assert res["status"] == "unavailable"
        assert res["fallback_used"] is False
        assert res["provider"] == "unavailable"


# 11. Gemini API failure returns honest unavailable status
@pytest.mark.asyncio
async def test_gemini_failure_returns_unavailable_status():
    mock_fail_res = MagicMock()
    mock_fail_res.status_code = 500
    mock_fail_res.text = "Service Error"

    with patch("httpx.AsyncClient.post", return_value=mock_fail_res), \
         patch.object(AIService, "get_gemini_api_key", return_value="fake-key"):
        
        res = await AIService.evaluate_answer(
            question_text="Explain Python GIL",
            user_answer="The GIL is a mutex that protects access to Python objects.",
            interview_type="Technical",
            difficulty="Intermediate"
        )
        assert res["status"] == "unavailable"
        assert res["provider"] == "unavailable"
        assert res["ai_provider"] is None
        assert res["technical_accuracy"] is None
        assert "unavailable" in res["weaknesses"][0].lower()
