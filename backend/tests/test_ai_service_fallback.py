# ============================================================
#  test_ai_service_fallback.py — Tests for Gemini-Only AI System
# ============================================================
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
import httpx

from app.services.ai_service import AIService


@pytest.mark.asyncio
async def test_gemini_success():
    """Test 1: Gemini succeeds on question generation."""
    mock_questions = [
        {
            "question_number": 1,
            "question_text": "Explain Python GIL.",
            "interview_type": "Technical Interview",
            "domain": "Software Development",
            "difficulty": "Intermediate",
            "category": "Software Development",
            "expected_answer_points": ["Thread lock", "Interpreter execution"],
            "sample_answer": "GIL locks thread execution."
        }
    ]

    with patch.object(AIService, "get_gemini_api_key", return_value="fake-gemini-key"), \
         patch.object(AIService, "_generate_with_gemini", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.return_value = (mock_questions, None)

        res = await AIService.generate_interview_questions(
            job_role="Backend Dev", domain="Software Development",
            interview_type="Technical Interview", difficulty="Intermediate", num_questions=1
        )

        assert len(res) == 1
        assert res[0]["provider"] == "gemini"
        assert res[0]["ai_provider"] == "gemini"
        assert res[0]["fallback_used"] is False


@pytest.mark.asyncio
async def test_gemini_quota_exceeded_raises_503_without_ollama():
    """Test 2: Gemini 429 quota exceeded raises 503 Service Unavailable without attempting Ollama."""
    with patch.object(AIService, "get_gemini_api_key", return_value="fake-gemini-key"), \
         patch.object(AIService, "_generate_with_gemini", new_callable=AsyncMock) as mock_gemini:
        
        mock_gemini.return_value = (None, "QUOTA_EXCEEDED")

        with pytest.raises(HTTPException) as exc_info:
            await AIService.generate_interview_questions(
                job_role="Backend Dev", domain="Software Development",
                interview_type="Technical Interview", difficulty="Intermediate", num_questions=1
            )

        assert exc_info.value.status_code == 503
        assert "quota exceeded" in exc_info.value.detail.lower()
        mock_gemini.assert_called_once()


@pytest.mark.asyncio
async def test_gemini_authentication_failure():
    """Test 3: Gemini authentication failure (401/403) raises 503 Service Unavailable."""
    with patch.object(AIService, "get_gemini_api_key", return_value="invalid-key"), \
         patch.object(AIService, "_generate_with_gemini", new_callable=AsyncMock) as mock_gemini:
        
        mock_gemini.return_value = (None, "AUTHENTICATION_FAILED")

        with pytest.raises(HTTPException) as exc_info:
            await AIService.generate_interview_questions(
                job_role="Backend Dev", domain="Software Development",
                interview_type="Technical Interview", difficulty="Intermediate", num_questions=1
            )

        assert exc_info.value.status_code == 503
        assert "authentication failed" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_gemini_timeout_raises_503_without_ollama():
    """Test 4: Gemini timeout raises 503 Service Unavailable without attempting Ollama."""
    with patch.object(AIService, "get_gemini_api_key", return_value="fake-key"), \
         patch.object(AIService, "_generate_with_gemini", new_callable=AsyncMock) as mock_gemini:
        
        mock_gemini.return_value = (None, "TIMEOUT")

        with pytest.raises(HTTPException) as exc_info:
            await AIService.generate_interview_questions(
                job_role="Backend Dev", domain="Software Development",
                interview_type="Technical Interview", difficulty="Intermediate", num_questions=1
            )

        assert exc_info.value.status_code == 503
        assert "timeout" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_evaluate_answer_gemini_failure_returns_unavailable_state():
    """Test 5: evaluate_answer returns status 'unavailable' on Gemini failure without attempting Ollama."""
    with patch.object(AIService, "get_gemini_api_key", return_value="fake-key"), \
         patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection refused")):

        res = await AIService.evaluate_answer(
            question_text="What is asynchronous programming?",
            user_answer="Asynchronous programming allows non-blocking execution using an event loop.",
            interview_type="Technical Interview",
            difficulty="Intermediate"
        )

        assert res["status"] == "unavailable"
        assert res["provider"] == "unavailable"
        assert res["ai_provider"] is None
        assert res["ai_model"] is None
        assert res["fallback_used"] is False
        assert res["user_answer"] == "Asynchronous programming allows non-blocking execution using an event loop."
        assert res["strengths"] == []


@pytest.mark.asyncio
async def test_ai_health_diagnostics_gemini_only():
    """Test 6: Health diagnostic check reports Gemini status accurately and excludes Ollama."""
    AIService._last_gemini_status = None
    AIService._last_gemini_model = None

    with patch.object(AIService, "get_gemini_api_key", return_value="fake-key"), \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        
        gemini_res = MagicMock()
        gemini_res.status_code = 200
        mock_get.return_value = gemini_res

        g_health = await AIService.check_gemini_health()
        assert g_health["configured"] is True
        assert not hasattr(AIService, "check_ollama_health")
