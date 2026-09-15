# ============================================================
#  test_video_recording_flow.py — Video Recording & Playback Tests
# ============================================================
import os
import uuid
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import status
from fastapi.testclient import TestClient

from main import app
from app.routers.interviews import UPLOAD_DIR

client = TestClient(app)

@pytest.fixture
def mock_candidate_user():
    return {
        "id": str(uuid.uuid4()),
        "name": "Candidate Jane",
        "email": "jane@example.com",
        "role": "candidate"
    }

@pytest.fixture
def mock_recruiter_user():
    return {
        "id": str(uuid.uuid4()),
        "name": "Recruiter Bob",
        "email": "bob@example.com",
        "role": "recruiter"
    }

@pytest.fixture
def mock_unauthorized_user():
    return {
        "id": str(uuid.uuid4()),
        "name": "Unauthorized User",
        "email": "stranger@example.com",
        "role": "candidate"
    }

@pytest.fixture
def mock_session_row(mock_candidate_user):
    s_id = uuid.uuid4()
    return {
        "id": s_id,
        "candidate_id": uuid.UUID(mock_candidate_user["id"]),
        "user_id": uuid.UUID(mock_candidate_user["id"]),
        "created_by": uuid.UUID(mock_candidate_user["id"]),
        "title": "Python Tech Interview",
        "job_role": "Python Developer",
        "domain": "Software Development",
        "interview_type": "Technical Interview",
        "status": "COMPLETED",
        "duration": 300,
        "created_at": "2026-09-13T20:00:00Z"
    }


@pytest.mark.asyncio
async def test_upload_zero_byte_recording_rejection(mock_candidate_user, mock_session_row):
    """Verifies that uploading an empty (0-byte) video file returns HTTP 400 Bad Request."""
    from app.dependencies import get_current_user, get_db

    async def override_user():
        return mock_candidate_user

    async def override_db():
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[mock_session_row])
        return conn

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_db] = override_db

    try:
        session_id = mock_session_row["id"]
        files = {"file": ("empty.webm", b"", "video/webm")}
        res = client.post(f"/api/sessions/{session_id}/recording", files=files)
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "empty" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_upload_valid_recording_success(mock_candidate_user, mock_session_row):
    """Verifies uploading a valid video file writes to disk and inserts database record."""
    from app.dependencies import get_current_user, get_db

    rec_id = uuid.uuid4()
    sample_video_bytes = b"\x00\x00\x00\x1aftypisom\x00\x00\x02\x00isomiso2avc1mp41"

    async def override_user():
        return mock_candidate_user

    async def override_db():
        conn = MagicMock()
        inserted_rec_row = {
            "id": rec_id,
            "session_id": mock_session_row["id"],
            "candidate_id": mock_session_row["candidate_id"],
            "interview_id": mock_session_row["id"],
            "recording_type": "video_audio",
            "storage_location": os.path.join(UPLOAD_DIR, f"{mock_session_row['id']}_test.webm"),
            "mime_type": "video/webm",
            "file_size": len(sample_video_bytes),
            "duration": 300,
            "created_at": "2026-09-13T20:05:00Z"
        }
        conn.fetchrow = AsyncMock(side_effect=[mock_session_row, inserted_rec_row])
        return conn

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_db] = override_db

    try:
        session_id = mock_session_row["id"]
        files = {"file": ("test_video.webm", sample_video_bytes, "video/webm")}
        res = client.post(f"/api/sessions/{session_id}/recording", files=files)
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["id"] == str(rec_id)
        assert data["session_id"] == str(session_id)
        assert data["file_size"] == len(sample_video_bytes)
        assert data["mime_type"] == "video/webm"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_recording_playback_authorization(mock_candidate_user, mock_unauthorized_user, mock_session_row, tmp_path):
    """Verifies that recording streaming verifies user authorization and returns HTTP 200/206 with correct Content-Type."""
    from app.dependencies import get_current_user, get_db

    sample_file = tmp_path / "test_recording.webm"
    sample_file.write_bytes(b"SMARTHIRE_VIDEO_STREAM_DATA_TEST_12345")

    rec_row = {
        "id": uuid.uuid4(),
        "session_id": mock_session_row["id"],
        "candidate_id": mock_session_row["candidate_id"],
        "storage_location": str(sample_file),
        "mime_type": "video/webm",
        "file_size": sample_file.stat().st_size,
        "created_at": "2026-09-13T20:00:00Z"
    }

    # Test 1: Candidate owner allowed
    async def override_owner():
        return mock_candidate_user

    async def override_db():
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[mock_session_row, rec_row])
        return conn

    app.dependency_overrides[get_current_user] = override_owner
    app.dependency_overrides[get_db] = override_db

    try:
        res = client.get(f"/api/sessions/{mock_session_row['id']}/recording")
        assert res.status_code == status.HTTP_200_OK
        assert res.headers["content-type"] == "video/webm"
        assert res.content == b"SMARTHIRE_VIDEO_STREAM_DATA_TEST_12345"
    finally:
        app.dependency_overrides.clear()

    # Test 2: Unauthorized candidate denied (HTTP 403)
    async def override_unauthorized():
        return mock_unauthorized_user

    async def override_db_unauth():
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[mock_session_row])
        return conn

    app.dependency_overrides[get_current_user] = override_unauthorized
    app.dependency_overrides[get_db] = override_db_unauth

    try:
        res = client.get(f"/api/sessions/{mock_session_row['id']}/recording")
        assert res.status_code == status.HTTP_403_FORBIDDEN
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_recording_range_header_support(mock_candidate_user, mock_session_row, tmp_path):
    """Verifies that Range header bytes=0-9 returns HTTP 206 Partial Content."""
    from app.dependencies import get_current_user, get_db

    sample_file = tmp_path / "range_test.webm"
    video_data = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    sample_file.write_bytes(video_data)

    rec_row = {
        "id": uuid.uuid4(),
        "session_id": mock_session_row["id"],
        "candidate_id": mock_session_row["candidate_id"],
        "storage_location": str(sample_file),
        "mime_type": "video/webm",
        "file_size": len(video_data),
        "created_at": "2026-09-13T20:00:00Z"
    }

    async def override_owner():
        return mock_candidate_user

    async def override_db():
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[mock_session_row, rec_row])
        return conn

    app.dependency_overrides[get_current_user] = override_owner
    app.dependency_overrides[get_db] = override_db

    try:
        res = client.get(f"/api/sessions/{mock_session_row['id']}/recording", headers={"Range": "bytes=0-9"})
        assert res.status_code == status.HTTP_206_PARTIAL_CONTENT
        assert res.headers["content-type"] == "video/webm"
        assert res.headers["content-range"] == f"bytes 0-9/{len(video_data)}"
        assert res.content == b"0123456789"
    finally:
        app.dependency_overrides.clear()
