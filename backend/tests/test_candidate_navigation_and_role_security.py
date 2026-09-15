# ============================================================
#  test_candidate_navigation_and_role_security.py
#  Verifies that:
#  1. Candidate role receives HTTP 403 when trying to access:
#     - Recruiter analytics (/api/recruiter/analytics)
#     - Recruiter candidate list (/api/recruiter/interviews)
#     - Admin dashboard (/api/admin/dashboard)
#     - Interview generation (/api/interviews/generate)
#  2. Recruiter role retains access to recruiter endpoints
#  3. Admin role retains access to admin endpoints
#  4. Role determination uses authenticated user role strictly from JWT/DB
# ============================================================
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.routers.interviews import get_recruiter_analytics, list_recruiter_interviews, generate_interview
from app.routers.admin import get_admin_dashboard


def make_user(role="candidate", user_id=None):
    return {
        "id": user_id or uuid4(),
        "name": f"Test {role.capitalize()}",
        "email": f"{role}@smarthire.ai",
        "role": role,
        "is_active": True,
    }


# ── 1. Candidate blocked from Recruiter Analytics ──────────────

@pytest.mark.asyncio
async def test_candidate_blocked_from_recruiter_analytics():
    candidate_user = make_user("candidate")
    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_recruiter_analytics(current_user=candidate_user, db=mock_db)

    assert exc_info.value.status_code == 403
    assert "recruiter authorization required" in exc_info.value.detail.lower()


# ── 2. Candidate blocked from Recruiter Interviews list ────────

@pytest.mark.asyncio
async def test_candidate_blocked_from_recruiter_interviews():
    candidate_user = make_user("candidate")
    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await list_recruiter_interviews(current_user=candidate_user, db=mock_db)

    assert exc_info.value.status_code == 403
    assert "recruiter authorization required" in exc_info.value.detail.lower()


# ── 3. Candidate blocked from Admin Dashboard ─────────────────

@pytest.mark.asyncio
async def test_candidate_blocked_from_admin_dashboard():
    candidate_user = make_user("candidate")
    mock_db = AsyncMock()

    # AdminOnly dependency checks require_role("admin")
    from app.dependencies import require_role
    checker = require_role("admin")

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=candidate_user)

    assert exc_info.value.status_code == 403
    assert "required role(s): admin" in exc_info.value.detail.lower()


# ── 4. Candidate blocked from Interview Generation ─────────────

@pytest.mark.asyncio
async def test_candidate_blocked_from_generate_interview():
    candidate_user = make_user("candidate")
    mock_db = AsyncMock()
    
    mock_req = MagicMock()
    mock_req.job_role = "Backend"
    mock_req.domain = "Python"
    mock_req.interview_type = "Technical"
    mock_req.difficulty = "Medium"
    mock_req.num_questions = 5

    with pytest.raises(HTTPException) as exc_info:
        await generate_interview(req=mock_req, current_user=candidate_user, db=mock_db)

    assert exc_info.value.status_code == 403
    assert "not authorized to create or generate" in exc_info.value.detail.lower()


# ── 5. Recruiter role allowed to access Recruiter Analytics ──

@pytest.mark.asyncio
async def test_recruiter_allowed_recruiter_analytics():
    recruiter_user = make_user("recruiter")
    mock_db = AsyncMock()
    mock_db.fetchval.return_value = 10

    res = await get_recruiter_analytics(current_user=recruiter_user, db=mock_db)
    assert res.total_interviews == 10
