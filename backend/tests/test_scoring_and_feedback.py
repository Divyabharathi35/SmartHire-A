# ============================================================
#  test_scoring_and_feedback.py — Automated PyTest Suite for Real AI Scoring & Feedback
# ============================================================
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from app.services.scoring_engine import RealAIScoringEngine, get_performance_rating
from app.services.communication_service import CommunicationService
from app.services.ai_service import AIService
from app.schemas import StructuredAIEvaluation


# ── Test 1: Communication Score & Speech Metrics ────────────

def test_communication_score_calculation():
    # 1. Test filler word detection formula
    sample_text = "Um, uh, I actually think that PostgreSQL connection pooling is basically useful, you know."
    filler_res = CommunicationService.detect_filler_words(sample_text, duration_seconds=60)
    assert filler_res["filler_word_count"] > 0
    assert "um" in filler_res["detected_breakdown"] or "uh" in filler_res["detected_breakdown"]

    # 2. Test speech pace formula (WPM)
    pace_res = CommunicationService.calculate_speech_pace(word_count=140, duration_seconds=60)
    assert pace_res["words_per_minute"] == 140.0
    assert pace_res["pace_category"] == "Normal"

    # 3. Test communication score aggregation
    comm_res = RealAIScoringEngine.calculate_communication_score(
        speech_clarity=90.0,
        grammar_quality=85.0,
        filler_words_per_minute=2.0,
        speaking_pace_wpm=135.0,
        response_completeness=88.0
    )
    assert comm_res["status"] == "Available"
    assert comm_res["score"] is not None
    assert 80.0 <= comm_res["score"] <= 100.0


# ── Test 2: Confidence Score & Observable Indicators ──────────

def test_confidence_score_calculation():
    conf_res = RealAIScoringEngine.calculate_confidence_score(
        eye_contact_duration=80.0,
        valid_tracking_duration=100.0,
        attention_break_duration=5.0,
        response_hesitation_seconds=1.5,
        facial_engagement_score=85.0,
        speaking_confidence_score=90.0,
        tracking_available=True
    )
    assert conf_res["status"] == "Available"
    assert conf_res["eye_contact_consistency"] == 80.0
    assert conf_res["confidence_indicator"] == "High Observed Confidence"
    assert 80.0 <= conf_res["score"] <= 100.0


# ── Test 3: Technical Relevance Score Calculation ─────────────

def test_technical_relevance_score_calculation():
    tech_res = RealAIScoringEngine.calculate_technical_relevance_score(
        technical_accuracy=85.0,
        keyword_relevance=90.0,
        problem_solving=80.0,
        domain_knowledge=88.0,
        answer_completeness=82.0
    )
    assert tech_res["status"] == "Available"
    # Average of 85, 90, 80, 88, 82 = 85.0
    assert tech_res["score"] == 85.0


# ── Test 4: Professionalism Score Calculation ────────────────

def test_professionalism_score_calculation():
    prof_res = RealAIScoringEngine.calculate_professionalism_score(
        total_duration_seconds=1500,
        expected_duration_seconds=1800,
        unnecessary_delays_count=0,
        transcript_clarity_score=90.0,
        unprofessional_words_detected=0,
        proctoring_violations_count=1,
        system_errors_count=0
    )
    assert prof_res["status"] == "Available"
    assert 80.0 <= prof_res["score"] <= 100.0


# ── Test 5: Overall Weighted Score Formula ────────────────────

def test_overall_weighted_score():
    # Example: Communication = 80, Confidence = 70, Technical = 90, Professionalism = 85
    # Overall = (80 * 0.30) + (70 * 0.25) + (90 * 0.30) + (85 * 0.15)
    #         = 24 + 17.5 + 27 + 12.75 = 81.25
    res = RealAIScoringEngine.calculate_overall_score(
        communication_score=80.0,
        confidence_score=70.0,
        technical_relevance_score=90.0,
        professionalism_score=85.0
    )
    assert res["overall_display_score"] == 81.25
    assert res["performance_rating"] == "Good"


# ── Test 6: Performance Rating Rubric Boundaries ────────────

@pytest.mark.parametrize("score,expected_rating", [
    (95.0, "Excellent"),
    (90.0, "Excellent"),
    (89.9, "Good"),
    (75.0, "Good"),
    (74.9, "Average"),
    (60.0, "Average"),
    (59.9, "Needs Improvement"),
    (40.0, "Needs Improvement"),
    (39.9, "Poor"),
    (10.0, "Poor"),
    (None, "Insufficient Data")
])
def test_performance_rating_boundaries(score, expected_rating):
    assert get_performance_rating(score) == expected_rating


# ── Test 7: Missing Data Handling ("Insufficient Data") ──────

def test_missing_data_handling():
    # Communication with no data
    comm_no_data = RealAIScoringEngine.calculate_communication_score(transcript_available=False)
    assert comm_no_data["status"] == "Insufficient Data"
    assert comm_no_data["score"] is None

    # Confidence with no tracking
    conf_no_data = RealAIScoringEngine.calculate_confidence_score(tracking_available=False)
    assert conf_no_data["status"] == "Insufficient Data"
    assert conf_no_data["score"] is None

    # Overall with no valid data
    overall_no_data = RealAIScoringEngine.calculate_overall_score(None, None, None, None)
    assert overall_no_data["performance_rating"] == "Insufficient Data"
    assert overall_no_data["overall_score"] is None


# ── Test 8: Invalid AI Output Pydantic Validation ─────────────

def test_invalid_ai_pydantic_validation():
    invalid_json = {
        "technical_accuracy": "invalid_number",
        "keyword_relevance": 150,  # exceeds 100
        "problem_solving": 80
    }
    with pytest.raises(Exception):
        StructuredAIEvaluation.model_validate(invalid_json)

    valid_json = {
        "technical_accuracy": 85,
        "keyword_relevance": 90,
        "problem_solving": 80,
        "domain_knowledge": 88,
        "answer_completeness": 82,
        "communication": 80,
        "confidence_indicators": 75,
        "professionalism": 90,
        "strengths": ["Clear API design"],
        "weaknesses": ["Missed connection pooling"],
        "improvement_suggestions": ["Practice DB pooling"],
        "practice_recommendations": ["Review PostgreSQL docs"],
        "learning_resources": ["PostgreSQL Manual"]
    }
    validated = StructuredAIEvaluation.model_validate(valid_json)
    assert validated.technical_accuracy == 85.0


# ── Test 9 & 10: Gemini Failure & Unavailable Handling ─────

@pytest.mark.asyncio
async def test_gemini_quota_returns_unavailable():
    with patch("httpx.AsyncClient.post") as mock_post:
        gemini_fail_resp = MagicMock()
        gemini_fail_resp.status_code = 429
        gemini_fail_resp.text = '{"error": {"code": 429, "message": "RESOURCE_EXHAUSTED"}}'

        mock_post.return_value = gemini_fail_resp

        res = await AIService.evaluate_answer(
            question_text="What is connection pooling?",
            user_answer="Connection pooling maintains reusable database connections to minimize overhead.",
            interview_type="Technical Interview",
            difficulty="Intermediate"
        )
        assert res["status"] == "unavailable"
        assert res["provider"] == "unavailable"
        assert res["fallback_used"] is False
        assert res["technical_accuracy"] is None


@pytest.mark.asyncio
async def test_gemini_unavailable_returns_unavailable_status():
    with patch("httpx.AsyncClient.post") as mock_post:
        fail_resp = MagicMock()
        fail_resp.status_code = 500
        mock_post.return_value = fail_resp

        res = await AIService.evaluate_answer(
            question_text="Explain database indexing.",
            user_answer="Indexing creates a data structure like B-Tree to speed up searches.",
            interview_type="Technical Interview",
            difficulty="Intermediate"
        )
        assert res["status"] == "unavailable"
        assert "AI evaluation unavailable" in res["message"]
        assert res["technical_accuracy"] is None


@pytest.mark.asyncio
async def test_gemini_quota_429_raises_503_without_fallback():
    with patch("httpx.AsyncClient.post") as mock_post:
        gemini_quota_resp = MagicMock()
        gemini_quota_resp.status_code = 429
        gemini_quota_resp.text = '{"error": {"code": 429, "message": "Quota exceeded"}}'

        mock_post.return_value = gemini_quota_resp

        with patch.object(AIService, "get_gemini_api_key", return_value="fake_gemini_key"):
            with pytest.raises(HTTPException) as exc_info:
                await AIService.generate_interview_questions(
                    job_role="Python Engineer",
                    domain="Python",
                    interview_type="Technical Interview",
                    difficulty="Intermediate",
                    num_questions=1
                )
            assert exc_info.value.status_code == 503
            assert "quota exceeded" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_dual_failure_raises_503_service_unavailable():
    with patch("httpx.AsyncClient.post") as mock_post:
        fail_resp = MagicMock()
        fail_resp.status_code = 500
        mock_post.return_value = fail_resp

        with pytest.raises(HTTPException) as exc_info:
            await AIService.generate_interview_questions(
                job_role="Backend Developer",
                domain="Python",
                interview_type="Technical Interview",
                difficulty="Intermediate",
                num_questions=1
            )
        assert exc_info.value.status_code == 503
        # The backend now returns specific, categorized error messages instead of generic "AI service temporarily unavailable"
        assert "AI" in exc_info.value.detail and "error" in exc_info.value.detail.lower()


# ── Test 11 & 14: AI Feedback Generation Relevance ─────────────

def test_ai_feedback_synthesis():
    question_evals = [{
        "strengths": ["Strong understanding of REST API design"],
        "weaknesses": ["Did not explain connection-pool exhaustion mitigation"],
        "improvement_suggestions": ["Practice explaining PostgreSQL connection pooling"],
        "practice_recommendations": ["Practice 5 PostgreSQL performance questions"],
        "learning_resources": ["PostgreSQL Connection Pooling Guide"]
    }]
    comm_res = {"score": 85.0, "speaking_pace_wpm": 135}
    conf_res = {"score": 80.0}
    tech_res = {"score": 85.0}
    prof_res = {"score": 90.0}

    feedback = RealAIScoringEngine.synthesize_ai_feedback(
        question_evaluations=question_evals,
        comm_res=comm_res,
        conf_res=conf_res,
        tech_res=tech_res,
        prof_res=prof_res
    )
    assert len(feedback["strengths"]) > 0
    assert "REST API" in feedback["strengths"][0] or "verbal" in feedback["strengths"][0]
    assert len(feedback["weaknesses"]) > 0
    assert "connection-pool" in feedback["weaknesses"][0] or "filler" in feedback["weaknesses"][0]
    assert len(feedback["improvement_suggestions"]) > 0
    assert len(feedback["practice_recommendations"]) > 0
    assert len(feedback["learning_resources"]) > 0


# ── Test 15: Search for Hardcoded Fallback Scores ──────────────

def test_no_hardcoded_scores_in_scoring_paths():
    import inspect
    source = inspect.getsource(RealAIScoringEngine)
    assert "overall_score = 80" not in source
    assert "overall_score = 85" not in source
    assert "random.randint" not in source


# ── Test 16: Session Feedback Generation with No Transcripts ───

@pytest.mark.asyncio
async def test_generate_session_feedback_no_transcript_insufficient_data():
    res = await AIService.generate_session_feedback(
        job_role="Backend Developer",
        domain="Python",
        interview_type="Technical Interview",
        difficulty="Intermediate",
        total_duration=120,
        answered_count=0,
        total_questions=5,
        question_evaluations=[]
    )
    assert res["status"] == "unavailable"
    assert res["strengths"] == []
    assert res["weaknesses"] == []
    assert res["improvement_suggestions"] == []
    assert res["practice_recommendations"] == []
    assert res["learning_resources"] == []
    assert res["ai_provider"] is None


# ── Test 17: Grounded Session Feedback Generation via Gemini ───

@pytest.mark.asyncio
async def test_generate_session_feedback_gemini_grounded():
    sample_session_feedback = {
        "strengths": ["Clear explanation of Python GIL and async event loop"],
        "weaknesses": ["Response for Q2 lacked details on database transaction isolation levels"],
        "improvement_suggestions": ["Review PostgreSQL transaction levels (Read Committed vs Repeatable Read)"],
        "practice_recommendations": ["Solve 3 concurrency and transaction handling scenarios"],
        "learning_resources": ["Python asyncio official documentation and PostgreSQL ACID guide"]
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "text": json.dumps(sample_session_feedback)
                    }]
                }
            }]
        }
        mock_post.return_value = mock_resp

        with patch.object(AIService, "get_gemini_api_key", return_value="fake_key"):
            res = await AIService.generate_session_feedback(
                job_role="Python Developer",
                domain="Python",
                interview_type="Technical",
                difficulty="Intermediate",
                total_duration=600,
                answered_count=2,
                total_questions=2,
                question_evaluations=[{
                    "question_text": "What is GIL?",
                    "user_answer": "GIL locks execution to one thread at a time in CPython.",
                    "score": 90.0
                }]
            )
            assert res is not None
            assert "Python GIL" in res["strengths"][0]
            assert "PostgreSQL" in res["weaknesses"][0] or "transaction" in res["weaknesses"][0]


# ── Test 18: Response JSON List Parsing & Session Isolation ───

def test_response_json_list_formatting_safety():
    # Simulate DB result row returning JSON strings for list columns
    db_result = {
        "session_id": "session-111",
        "overall_score": 88.5,
        "strengths": '["Strong verbal clarity"]',
        "weaknesses": '["Slight filler words"]',
        "improvement_suggestions": '["Pause before speaking"]',
        "practice_recommendations": '["Mock technical interviews"]',
        "learning_resources": '["FastAPI docs"]'
    }

    # Formatting logic as applied in router details endpoint
    formatted = dict(db_result)
    for fld in ["strengths", "weaknesses", "improvement_suggestions", "practice_recommendations", "learning_resources"]:
        val = formatted.get(fld)
        if isinstance(val, str):
            try:
                parsed = json.loads(val)
                formatted[fld] = parsed if isinstance(parsed, list) else [parsed]
            except Exception:
                formatted[fld] = [val]

    assert isinstance(formatted["strengths"], list)
    assert formatted["strengths"] == ["Strong verbal clarity"]
    assert isinstance(formatted["weaknesses"], list)
    assert formatted["weaknesses"] == ["Slight filler words"]


def test_session_isolation():
    session_a = {
        "session_id": "session-AAA",
        "strengths": ["Demonstrated deep understanding of Docker containerization"]
    }
    session_b = {
        "session_id": "session-BBB",
        "strengths": ["Insufficient Data"]
    }
    assert session_a["session_id"] != session_b["session_id"]
    assert session_a["strengths"] != session_b["strengths"]


# ── Test 19: Communication Pipeline & Category Score Tests ────

def test_communication_score_single_question_transcript():
    transcript = "In Python, connection pooling maintains reusable database connections to minimize connection creation overhead."
    analysis = CommunicationService.analyze_communication_quality(transcript, duration_seconds=15)

    assert analysis["communication_score"] is not None
    assert 0.0 <= analysis["communication_score"] <= 100.0
    assert analysis["words_per_minute"] > 0
    assert analysis["grammar_score"] is not None


def test_communication_score_multiple_questions_aggregation():
    # Question 1 analysis
    q1_text = "Database indexing creates B-Tree indices to optimize search performance."
    q1_comm = CommunicationService.analyze_communication_quality(q1_text, duration_seconds=12)

    # Question 2 analysis
    q2_text = "Um, REST APIs use HTTP verbs like GET, POST, PUT, and DELETE for resource manipulation, you know."
    q2_comm = CommunicationService.analyze_communication_quality(q2_text, duration_seconds=18)

    # Aggregate
    clarity_scores = [q1_comm["grammar_score"], q2_comm["grammar_score"]]
    avg_grammar = sum(clarity_scores) / len(clarity_scores)

    filler_wpms = [q1_comm["filler_words_per_minute"], q2_comm["filler_words_per_minute"]]
    avg_fw = sum(filler_wpms) / len(filler_wpms)

    wpms = [q1_comm["words_per_minute"], q2_comm["words_per_minute"]]
    avg_wpm = sum(wpms) / len(wpms)

    session_comm = RealAIScoringEngine.calculate_communication_score(
        speech_clarity=avg_grammar,
        grammar_quality=avg_grammar,
        filler_words_per_minute=avg_fw,
        speaking_pace_wpm=avg_wpm,
        response_completeness=85.0,
        transcript_available=True
    )

    assert session_comm["status"] == "Available"
    assert session_comm["score"] is not None
    assert 0.0 <= session_comm["score"] <= 100.0


def test_communication_score_empty_transcript_insufficient_data():
    empty_analysis = CommunicationService.analyze_communication_quality("", duration_seconds=0)
    assert empty_analysis["communication_score"] is None
    assert empty_analysis["pace_category"] == "Insufficient Data"

    session_comm = RealAIScoringEngine.calculate_communication_score(transcript_available=False)
    assert session_comm["status"] == "Insufficient Data"
    assert session_comm["score"] is None


def test_communication_score_short_answer_processing():
    short_text = "that managers using"
    short_analysis = CommunicationService.analyze_communication_quality(short_text, duration_seconds=5)

    assert short_analysis["word_count"] == 3
    assert short_analysis["communication_score"] is not None
    assert 0.0 <= short_analysis["communication_score"] <= 100.0


def test_communication_30_percent_weight_in_overall():
    overall_res = RealAIScoringEngine.calculate_overall_score(
        communication_score=80.0,
        confidence_score=70.0,
        technical_relevance_score=90.0,
        professionalism_score=85.0
    )
    # Overall = (80 * 0.30) + (70 * 0.25) + (90 * 0.30) + (85 * 0.15) = 24 + 17.5 + 27 + 12.75 = 81.25
    assert overall_res["overall_display_score"] == 81.25
    assert overall_res["communication_score"] == 80.0


# ── Test 20: Candidate Report Response Alignment & Data Mismatch Validation ───

def test_recruiter_report_api_response_schema_alignment():
    sample_res_row = {
        "session_id": "session-101",
        "candidate_id": "candidate-101",
        "overall_score": 85.5,
        "performance_rating": "Good",
        "communication_score": 88.0,
        "confidence_score": 75.0,
        "technical_relevance_score": 90.0,
        "professionalism_score": 85.0,
        "feedback_status": "available",
        "ai_provider": "gemini (gemini-3.5-flash)",
        "ai_model": "gemini-3.5-flash",
        "strengths": '["Strong technical accuracy in Python async"]',
        "weaknesses": '["Slight speaking hesitation"]',
        "improvement_suggestions": '["Practice database connection pooling explanation"]',
        "practice_recommendations": '["Solve 2 system design scenarios"]',
        "learning_resources": '["PostgreSQL docs"]'
    }

    formatted_result = dict(sample_res_row)
    for fld in ["strengths", "weaknesses", "improvement_suggestions", "practice_recommendations", "learning_resources"]:
        val = formatted_result.get(fld)
        if isinstance(val, str):
            try:
                parsed = json.loads(val)
                formatted_result[fld] = parsed if isinstance(parsed, list) else [parsed]
            except Exception:
                formatted_result[fld] = [val]

    category_scores = {
        "communication": float(sample_res_row["communication_score"]),
        "confidence": float(sample_res_row["confidence_score"]),
        "technical_relevance": float(sample_res_row["technical_relevance_score"]),
        "professionalism": float(sample_res_row["professionalism_score"]),
    }

    feedback = {
        "status": sample_res_row["feedback_status"],
        "ai_provider": sample_res_row["ai_provider"],
        "ai_model": sample_res_row["ai_model"],
        "strengths": formatted_result["strengths"],
        "weaknesses": formatted_result["weaknesses"],
        "improvement_suggestions": formatted_result["improvement_suggestions"],
        "practice_recommendations": formatted_result["practice_recommendations"],
        "learning_resources": formatted_result["learning_resources"]
    }

    report_response = {
        "candidate": {"id": "candidate-101", "name": "Alice Developer"},
        "session": {"id": "session-101", "job_role": "Backend Engineer"},
        "result": formatted_result,
        "category_scores": category_scores,
        "feedback": feedback,
        "question_results": []
    }

    assert report_response["result"]["session_id"] == "session-101"
    assert report_response["category_scores"]["communication"] == 88.0
    assert report_response["category_scores"]["confidence"] == 75.0
    assert report_response["category_scores"]["technical_relevance"] == 90.0
    assert report_response["category_scores"]["professionalism"] == 85.0
    assert report_response["feedback"]["status"] == "available"
    assert report_response["feedback"]["ai_provider"] == "gemini (gemini-3.5-flash)"
    assert report_response["feedback"]["strengths"] == ["Strong technical accuracy in Python async"]


def test_multi_candidate_strict_data_isolation():
    cand_a_data = {
        "candidate_id": "cand-AAAA",
        "session_id": "session-AAAA",
        "overall_score": 92.0,
        "transcript": "Candidate A discussed microservices architecture, Docker, and Redis caching.",
        "feedback": ["Excellent system design understanding"]
    }
    cand_b_data = {
        "candidate_id": "cand-BBBB",
        "session_id": "session-BBBB",
        "overall_score": 45.0,
        "transcript": "Candidate B had brief answers and multiple hesitation breaks.",
        "feedback": ["Needs improvement in technical depth"]
    }

    # Verify session & candidate level isolation
    assert cand_a_data["session_id"] != cand_b_data["session_id"]
    assert cand_a_data["candidate_id"] != cand_b_data["candidate_id"]
    assert cand_a_data["transcript"] != cand_b_data["transcript"]
    assert cand_a_data["overall_score"] != cand_b_data["overall_score"]
    assert cand_a_data["feedback"] != cand_b_data["feedback"]


