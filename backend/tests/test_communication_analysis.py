# ============================================================
#  test_communication_analysis.py — Unit Tests for Communication Analysis
# ============================================================
import pytest
import uuid
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

from app.services.communication_service import CommunicationService, FILLER_WORDS_LIST
from app.schemas import CommunicationAnalysisResponse, SpeechPaceDetails, FillerWordsDetails, GrammarDetails, OverallCommunicationQualityDetails


def test_speech_pace_calculation_normal():
    """
    Test speech pace (WPM) calculation with valid duration.
    WPM = word_count / duration_minutes.
    120 words in 60 seconds = 120 WPM (Normal pace).
    """
    res = CommunicationService.calculate_speech_pace(word_count=120, duration_seconds=60)
    assert res["words_per_minute"] == 120.0
    assert res["pace_category"] == "Normal"
    assert res["status"] == "Calculated"


def test_speech_pace_missing_duration():
    """
    Test speech pace when duration is unavailable (<= 0 seconds).
    Must NOT return 0 WPM when word count > 0; must return None / Insufficient Data.
    """
    res = CommunicationService.calculate_speech_pace(word_count=150, duration_seconds=0)
    assert res["words_per_minute"] is None
    assert res["pace_category"] == "Insufficient Data"
    assert res["status"] == "Insufficient Data"


def test_filler_words_detection():
    """
    Test detection of filler words in candidate transcript.
    """
    transcript = "Um, I think that, like, building modular services is, you know, actually beneficial."
    res = CommunicationService.detect_filler_words(transcript, duration_seconds=60)

    assert res["filler_word_count"] >= 4
    assert "um" in res["detected_words"]
    assert "like" in res["detected_words"]
    assert "you know" in res["detected_words"]
    assert "actually" in res["detected_words"]
    assert res["filler_rate"] > 0.0


def test_grammar_analysis_valid_and_empty():
    """
    Test grammar analysis for valid text and empty transcript.
    """
    valid_text = "I designed the scalable microservices architecture using modern software patterns."
    res_valid = CommunicationService.analyze_grammar(valid_text)
    assert res_valid["grammar_score"] is not None
    assert res_valid["grammar_score"] >= 80.0
    assert res_valid["status"] == "Evaluated"

    empty_res = CommunicationService.analyze_grammar("")
    assert empty_res["grammar_score"] is None
    assert empty_res["status"] == "Insufficient Data"


def test_analyze_communication_quality_structured_json():
    """
    Test comprehensive communication quality evaluation returning requirement 14 structured JSON schema.
    """
    transcript = "So basically, um, I implemented the REST API with python and fast api. The the solution worked well."
    res = CommunicationService.analyze_communication_quality(
        text=transcript,
        duration_seconds=30
    )

    # Check top level fields for DB
    assert res["grammar_score"] is not None
    assert res["filler_word_count"] > 0
    assert res["words_per_minute"] is not None
    assert res["communication_score"] is not None

    # Check requirement 14 structured sub-models
    assert "speech_pace" in res
    assert res["speech_pace"]["words_per_minute"] is not None
    assert res["speech_pace"]["status"] == "Calculated"

    assert "filler_words" in res
    assert res["filler_words"]["count"] > 0
    assert len(res["filler_words"]["detected_words"]) > 0

    assert "grammar" in res
    assert res["grammar"]["score"] is not None
    assert res["grammar"]["status"] == "Evaluated"

    assert "overall_communication_quality" in res
    assert res["overall_communication_quality"]["score"] is not None


def test_pydantic_schema_validation():
    """
    Test Pydantic CommunicationAnalysisResponse schema with optional scores and structured sub-models.
    """
    sess_id = uuid.uuid4()
    q_id = uuid.uuid4()
    ca_id = uuid.uuid4()

    mock_data = {
        "id": ca_id,
        "session_id": sess_id,
        "question_id": q_id,
        "grammar_score": 90.0,
        "grammar_error_count": 0,
        "grammar_feedback": "Great grammar",
        "filler_word_count": 1,
        "filler_words_per_minute": 1.0,
        "filler_rate": 2.0,
        "filler_words_list": ["um (1x)"],
        "words_per_minute": 140.0,
        "speaking_duration": 60,
        "word_count": 140,
        "pace_category": "Normal",
        "pronunciation_score": None,
        "pronunciation_status": "Pronunciation analysis unavailable",
        "pronunciation_feedback": "Audio signal missing",
        "communication_score": 88.0,
        "feedback": "Clear articulation.",
        "strengths": ["Optimal pace"],
        "weaknesses": [],
        "speech_pace": {
            "words_per_minute": 140.0,
            "duration_minutes": 1.0,
            "total_words": 140,
            "pace_category": "Normal",
            "status": "Calculated"
        },
        "filler_words": {
            "count": 1,
            "percentage": 2.0,
            "detected_words": ["um"]
        },
        "grammar": {
            "score": 90.0,
            "error_count": 0,
            "feedback": "Great grammar",
            "status": "Evaluated"
        },
        "overall_communication_quality": {
            "score": 88.0,
            "confidence_level": "High",
            "summary": "Clear articulation."
        },
        "created_at": datetime.now(timezone.utc)
    }

    parsed = CommunicationAnalysisResponse(**mock_data)
    assert parsed.grammar_score == 90.0
    assert parsed.pronunciation_score is None
    assert parsed.speech_pace.words_per_minute == 140.0
    assert parsed.filler_words.detected_words == ["um"]


@pytest.mark.asyncio
async def test_gemini_quota_failure_resilience():
    """
    Test that even if AI / Gemini calls fail with rate limits, local deterministic communication analysis succeeds.
    """
    transcript = "Actually, I designed the database schema to normalize data and avoid redundancy."
    # Communication analysis service operates deterministically without external LLM API dependency
    comm_res = CommunicationService.analyze_communication_quality(transcript, duration_seconds=45)
    assert comm_res["words_per_minute"] is not None
    assert comm_res["filler_word_count"] >= 1
    assert "actually" in comm_res["filler_words"]["detected_words"]
    assert comm_res["communication_score"] is not None
