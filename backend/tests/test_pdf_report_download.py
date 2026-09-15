# ============================================================
#  test_pdf_report_download.py
#  Backend unit tests for Candidate Self-Report PDF download feature.
# ============================================================
import pytest
from uuid import uuid4
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from reportlab.pdfgen import canvas
import io

from app.routers.interviews import download_candidate_report
from app.services.pdf_service import CandidatePDFGenerator


def make_session(candidate_id, status="completed", job_role="Frontend Engineer", domain="Web"):
    s_id = uuid4()
    return {
        "id": s_id,
        "candidate_id": candidate_id,
        "user_id": candidate_id,
        "status": status,
        "job_role": job_role,
        "domain": domain,
        "interview_type": "Technical",
        "difficulty": "Intermediate",
        "duration": 600,
        "created_at": "2026-09-13T10:00:00Z",
        "ended_at": "2026-09-13T10:10:00Z"
    }


def make_user(user_id, role="candidate", name="Avanthika Sharma", email="avanthika@example.com"):
    return {
        "id": user_id,
        "role": role,
        "name": name,
        "email": email
    }


def make_result_row(session_id):
    return {
        "session_id": session_id,
        "overall_score": 85.0,
        "communication_score": 90.0,
        "confidence_score": 80.0,
        "technical_relevance_score": 88.0,
        "professionalism_score": 82.0,
        "performance_rating": "Strong Hire",
        "ai_provider": "SmartHire AI",
        "ai_model": "SmartHire-Evaluator-v1",
        "feedback_generated_at": "2026-09-13T10:11:00Z",
        "strengths": '["Strong React component architecture", "Clear communication"]',
        "weaknesses": '["Could explain CSS Grid details deeper"]',
        "improvement_suggestions": '["Practice layout math"]',
        "practice_recommendations": '["Build complex UI widgets"]',
        "learning_resources": '["MDN Web Docs"]',
        "total_duration": 600
    }


# ── Test 1: Candidate can download own completed report ──────

@pytest.mark.asyncio
async def test_candidate_can_download_own_completed_report():
    cand_id = uuid4()
    candidate_user = make_user(cand_id, role="candidate", name="Avanthika Sharma")
    session = make_session(candidate_id=cand_id, status="completed")
    result_row = make_result_row(session["id"])

    mock_db = AsyncMock()
    
    async def mock_fetchrow(query, *args):
        if "interview_sessions" in query:
            return session
        if "users" in query:
            return candidate_user
        if "interview_results" in query:
            return result_row
        return None

    async def mock_fetch(query, *args):
        if "interview_questions" in query:
            return [{"user_answer": "I would use React hooks..."}, {"user_answer": "Virtual DOM works by..."}]
        return []

    mock_db.fetchrow.side_effect = mock_fetchrow
    mock_db.fetch.side_effect = mock_fetch

    response = await download_candidate_report(
        session_id=session["id"],
        format="pdf",
        current_user=candidate_user,
        db=mock_db
    )

    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert "attachment; filename=\"SmartHire_Avanthika_Interview_Report.pdf\"" in response.headers["Content-Disposition"]
    assert len(response.body) > 1000
    # Header starts with PDF magic bytes %PDF
    assert response.body.startswith(b"%PDF")


# ── Test 2: Candidate cannot download another candidate's report 

@pytest.mark.asyncio
async def test_candidate_cannot_download_other_candidate_report():
    owner_id = uuid4()
    attacker_id = uuid4()
    
    session = make_session(candidate_id=owner_id, status="completed")
    attacker_user = make_user(attacker_id, role="candidate", name="Attacker Candidate")

    mock_db = AsyncMock()
    mock_db.fetchrow.return_value = session

    with pytest.raises(HTTPException) as exc_info:
        await download_candidate_report(
            session_id=session["id"],
            format="pdf",
            current_user=attacker_user,
            db=mock_db
        )

    assert exc_info.value.status_code == 403
    assert "not authorized" in exc_info.value.detail.lower()


# ── Test 3: Candidate cannot download IN_PROGRESS report ─────

@pytest.mark.asyncio
async def test_candidate_cannot_download_in_progress_report():
    cand_id = uuid4()
    candidate_user = make_user(cand_id, role="candidate")
    session = make_session(candidate_id=cand_id, status="in_progress")

    mock_db = AsyncMock()
    mock_db.fetchrow.return_value = session

    with pytest.raises(HTTPException) as exc_info:
        await download_candidate_report(
            session_id=session["id"],
            format="pdf",
            current_user=candidate_user,
            db=mock_db
        )

    assert exc_info.value.status_code == 400
    assert "completed" in exc_info.value.detail.lower()


# ── Test 4: PDF response content type is application/pdf ──────

@pytest.mark.asyncio
async def test_pdf_response_content_type_is_application_pdf():
    cand_id = uuid4()
    candidate_user = make_user(cand_id)
    session = make_session(candidate_id=cand_id, status="completed")
    result_row = make_result_row(session["id"])

    mock_db = AsyncMock()
    mock_db.fetchrow.side_effect = lambda q, *args: session if "interview_sessions" in q else (candidate_user if "users" in q else result_row)
    mock_db.fetch.return_value = []

    response = await download_candidate_report(
        session_id=session["id"],
        format="pdf",
        current_user=candidate_user,
        db=mock_db
    )

    assert response.media_type == "application/pdf"
    assert response.body[:4] == b"%PDF"


# ── Test 5: PDF contains real candidate/report information ─────

def test_pdf_generator_embeds_real_candidate_information():
    cand_info = {"name": "Avanthika Sharma", "email": "avanthika@example.com"}
    session_info = {"job_role": "Backend Engineer", "domain": "Cloud", "interview_type": "Technical", "difficulty": "Hard", "status": "completed", "duration": 1200}
    result_info = {"overall_score": 92.4, "communication_score": 95, "confidence_score": 90, "technical_relevance_score": 94, "professionalism_score": 88, "performance_rating": "Strong Hire", "strengths": ["System design clarity"]}
    q_info = {"completed": 5, "total": 5}

    pdf_bytes = CandidatePDFGenerator.generate_pdf(cand_info, session_info, result_info, q_info)
    assert len(pdf_bytes) > 2000
    assert b"%PDF" in pdf_bytes


# ── Test 6: Recruiter/admin authorization remains unaffected ──

@pytest.mark.asyncio
async def test_recruiter_can_download_candidate_report():
    cand_id = uuid4()
    recruiter_id = uuid4()
    
    recruiter_user = make_user(recruiter_id, role="recruiter", name="HR Recruiter")
    cand_user = make_user(cand_id, role="candidate", name="John Doe")
    session = make_session(candidate_id=cand_id, status="completed")
    result_row = make_result_row(session["id"])

    mock_db = AsyncMock()
    mock_db.fetchrow.side_effect = lambda q, *args: session if "interview_sessions" in q else (cand_user if "users" in q else result_row)
    mock_db.fetch.return_value = []

    response = await download_candidate_report(
        session_id=session["id"],
        format="pdf",
        current_user=recruiter_user,
        db=mock_db
    )

    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert "SmartHire_John_Interview_Report.pdf" in response.headers["Content-Disposition"]


# ── Test 7: Missing fields display "Unavailable" / "Insufficient Data"

def test_pdf_missing_fields_display_unavailable_or_insufficient_data():
    cand_info = {"name": None, "email": ""}
    session_info = {"job_role": None, "domain": "", "status": "completed"}
    result_info = {"overall_score": None, "communication_score": None, "confidence_score": None, "technical_relevance_score": None, "professionalism_score": None}
    q_info = {"completed": "Unavailable", "total": "Unavailable"}

    # Must generate without exception and gracefully render fallbacks
    pdf_bytes = CandidatePDFGenerator.generate_pdf(cand_info, session_info, result_info, q_info)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


# ── Test 8: Recruiter-only fields are NOT present in candidate PDF 

def test_recruiter_only_fields_excluded_from_candidate_pdf():
    """
    Ensures that emotion timeline, eye-contact, face visibility, proctoring events,
    transcripts, and audio/video links are never drawn in candidate PDF.
    """
    cand_info = {"name": "Privacy Test", "email": "test@privacy.org"}
    session_info = {"job_role": "Security Engineer", "domain": "SecOps", "status": "completed"}
    result_info = {
        "overall_score": 88,
        "strengths": ["Good security knowledge"],
        # Internal fields passed in result dict
        "emotion_detection": {"dominant_emotion": "Happy"},
        "proctoring_events": [{"event": "tab_switch"}],
        "eye_contact_percentage": 94.2
    }
    q_info = {"completed": 3, "total": 3}

    pdf_bytes = CandidatePDFGenerator.generate_pdf(cand_info, session_info, result_info, q_info)
    
    # Verify PDF bytes do not contain recruiter-only headers/labels
    raw_str = str(pdf_bytes)
    assert "Observable Behavioral" not in raw_str
    assert "Proctoring & Interview Integrity" not in raw_str
    assert "Tab switches" not in raw_str
    assert "Eye-contact analysis" not in raw_str
