# ============================================================
#  interviews.py — AI Interview Generation & Session Management Router
# ============================================================
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import List, Optional
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse

logger = logging.getLogger("smarthire.interviews")

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas import (
    AudioAnswerResponse,
    BatchIntegrityEventsRequest,
    BehaviorAnalysisResponse,
    CandidateComparisonDetail,
    CandidateComparisonResponse,
    CandidateUserResponse,
    ComparisonDifference,
    CommunicationAnalysisResponse,
    CreateMockSessionRequest,
    CreateSessionRequest,
    GenerateQuestionsRequest,
    IntegrityEventResponse,
    InterviewResultResponse,
    MockQuestionResponse,
    MockSessionHistoryResponse,
    MockSessionResponse,
    PauseSessionRequest,
    ProctoringSummaryResponse,
    QuestionResponse,
    QuestionResultResponse,
    QuestionTimingResponse,
    RecordingResponse,
    RecruiterAnalyticsResponse,
    RecruiterCandidateInterviewResponse,
    SessionResponse,
    SubmitAnswerRequest,
    SubmitBehaviorAnalysisRequest,
    SubmitCommunicationAnalysisRequest,
    SubmitProctoringSummaryRequest,
    SubmitTimingRequest,
    SubmitTranscriptRequest,
    TranscriptResponse,
    UpdateSessionRequest,
)
from app.services.ai_service import AIService
from app.services.behavior_analysis_service import BehaviorAnalysisService
from app.services.communication_service import CommunicationService
from app.services.emotion_service import EmotionService
from app.services.proctoring_service import ProctoringService
from app.services.scoring_engine import DeterministicScoringEngine, RealAIScoringEngine, get_performance_rating
from app.services.notification_service import NotificationService
from app.services.analytics_service import CandidateAnalyticsService
from app.services.pdf_service import CandidatePDFGenerator


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "recordings")
os.makedirs(UPLOAD_DIR, exist_ok=True)

AUDIO_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "audio_answers")
os.makedirs(AUDIO_UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/api", tags=["Interviews"])


# ── 0. GET /api/candidates ───────────────────────────────────
@router.get("/candidates", response_model=List[CandidateUserResponse])
async def list_candidates(
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns list of active candidates for recruiter interview assignment.
    """
    rows = await db.fetch(
        "SELECT id, name, email, avatar_url FROM users WHERE role = 'candidate' AND is_active = TRUE ORDER BY name ASC"
    )
    return [dict(r) for r in rows]



# ── 1. POST /api/questions/generate ─────────────────────────
@router.post("/questions/generate", response_model=List[QuestionResponse])
async def generate_questions(
    req: GenerateQuestionsRequest,
    current_user: CurrentUser,
):
    """
    Generates interview questions based on Job Role, Domain, Interview Type,
    Difficulty, User Skills, Resume Text, or Job Description using AI service.
    """
    if current_user["role"] == "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Candidates are not authorized to generate questions.",
        )

    try:
        questions = await AIService.generate_interview_questions(
            job_role=req.job_role,
            domain=req.domain,
            interview_type=req.interview_type,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
            user_skills=req.user_skills,
            job_description=req.job_description,
            resume_text=req.resume_text,
            generation_seed=req.generation_seed,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service temporarily unavailable: {str(e)}",
        )


    if not questions:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI Service failed to generate questions. Please retry.",
        )
    
    # Format response
    formatted = []
    for idx, q in enumerate(questions, 1):
        formatted.append(
            QuestionResponse(
                question_number=q.get("question_number", idx),
                question_text=q["question_text"],
                interview_type=q["interview_type"],
                domain=q["domain"],
                difficulty=q["difficulty"],
                expected_answer_points=q.get("expected_answer_points", []),
                category=q.get("category"),
                sample_answer=q.get("sample_answer"),
            )
        )
    return formatted



# ── 2. POST /api/interviews/generate ─────────────────────────
@router.post("/interviews/generate", response_model=SessionResponse)
async def generate_interview(
    req: GenerateQuestionsRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Generates AI interview questions AND automatically initializes + saves
    a new Interview Session in the database.
    """
    if current_user["role"] == "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Candidates are not authorized to create or generate interview sessions.",
        )

    questions = await AIService.generate_interview_questions(
        job_role=req.job_role,
        domain=req.domain,
        interview_type=req.interview_type,
        difficulty=req.difficulty,
        num_questions=req.num_questions,
        user_skills=req.user_skills,
        job_description=req.job_description,
        resume_text=req.resume_text,
    )

    # Insert session into DB
    session_row = await db.fetchrow(
        """
        INSERT INTO interview_sessions (
            user_id, job_role, domain, interview_type, difficulty,
            num_questions, user_skills, job_description, resume_text,
            status, total_questions, completed_questions, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'created', $10, 0, NOW(), NOW())
        RETURNING *
        """,
        current_user["id"],
        req.job_role,
        req.domain,
        req.interview_type,
        req.difficulty,
        req.num_questions,
        req.user_skills,
        req.job_description,
        req.resume_text,
        len(questions),
    )

    session_id = session_row["id"]

    # Insert questions into DB
    question_responses = []
    for idx, q in enumerate(questions, 1):
        points_json = json.dumps(q.get("expected_answer_points", []))
        q_row = await db.fetchrow(
            """
            INSERT INTO interview_questions (
                session_id, question_number, question_text, interview_type,
                domain, difficulty, expected_answer_points, category, sample_answer, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW())
            RETURNING *
            """,
            session_id,
            idx,
            q["question_text"],
            q["interview_type"],
            q["domain"],
            q["difficulty"],
            points_json,
            q.get("category"),
            q.get("sample_answer"),
        )
        
        pts = q_row["expected_answer_points"]
        if isinstance(pts, str):
            pts = json.loads(pts)

        question_responses.append(
            QuestionResponse(
                id=q_row["id"],
                session_id=q_row["session_id"],
                question_number=q_row["question_number"],
                question_text=q_row["question_text"],
                interview_type=q_row["interview_type"],
                domain=q_row["domain"],
                difficulty=q_row["difficulty"],
                expected_answer_points=pts or [],
                category=q_row["category"],
                sample_answer=q_row["sample_answer"],
            )
        )

    res = dict(session_row)
    res["questions"] = question_responses
    return res


# ── 3. POST /api/sessions ────────────────────────────────────
@router.post("/sessions", response_model=SessionResponse)
@router.post("/interviews/sessions", response_model=SessionResponse)
@router.post("/interview-sessions", response_model=SessionResponse)
async def create_session(
    req: CreateSessionRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Creates and saves a new interview session in the database.
    Recruiters can assign the session to a candidate via candidate_id.
    """
    questions_data = req.questions
    if not questions_data:
        questions_data = await AIService.generate_interview_questions(
            job_role=req.job_role,
            domain=req.domain,
            interview_type=req.interview_type,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
            user_skills=req.user_skills,
            job_description=req.job_description,
            resume_text=req.resume_text,
        )

    target_user_id = req.candidate_id if req.candidate_id else current_user["id"]

    session_row = await db.fetchrow(
        """
        INSERT INTO interview_sessions (
            user_id, created_by, candidate_id, job_role, domain, interview_type, difficulty,
            experience_level, num_questions, user_skills, job_description, resume_text,
            status, total_questions, completed_questions, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'created', $13, 0, NOW(), NOW())
        RETURNING *
        """,
        target_user_id,
        current_user["id"],
        req.candidate_id,
        req.job_role,
        req.domain,
        req.interview_type,
        req.difficulty,
        req.experience_level or "Mid Level",
        req.num_questions,
        req.user_skills,
        req.job_description,
        req.resume_text,
        len(questions_data),
    )

    session_id = session_row["id"]
    question_responses = []

    for idx, q in enumerate(questions_data, 1):
        points = q.get("expected_answer_points", [])
        points_json = json.dumps(points if isinstance(points, list) else [])
        
        q_row = await db.fetchrow(
            """
            INSERT INTO interview_questions (
                session_id, question_number, question_text, interview_type,
                domain, difficulty, expected_answer_points, category, sample_answer, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW())
            RETURNING *
            """,
            session_id,
            idx,
            q["question_text"],
            q.get("interview_type", req.interview_type),
            q.get("domain", req.domain),
            q.get("difficulty", req.difficulty),
            points_json,
            q.get("category"),
            q.get("sample_answer"),
        )
        
        pts = q_row["expected_answer_points"]
        if isinstance(pts, str):
            pts = json.loads(pts)

        question_responses.append(
            QuestionResponse(
                id=q_row["id"],
                session_id=q_row["session_id"],
                question_number=q_row["question_number"],
                question_text=q_row["question_text"],
                interview_type=q_row["interview_type"],
                domain=q_row["domain"],
                difficulty=q_row["difficulty"],
                expected_answer_points=pts or [],
                category=q_row["category"],
                sample_answer=q_row["sample_answer"],
            )
        )

    res = dict(session_row)
    res["questions"] = question_responses
    return res


# ── MOCK INTERVIEW ENDPOINTS (Candidate-Only Practice) ────────

@router.post("/mock-interviews/sessions", response_model=MockSessionResponse)
async def create_mock_session(
    req: CreateMockSessionRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Creates an isolated candidate Mock Interview practice session.
    Generates practice questions without triggering AI scoring, feedback, or recruiter reports.
    """
    if current_user["role"] != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Mock Interview is a candidate-only practice feature.",
        )

    try:
        questions = await AIService.generate_interview_questions(
            job_role=req.job_role,
            domain=req.domain,
            interview_type=req.interview_type,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
            user_skills=req.user_skills,
        )
    except Exception as e:
        logger.warning(f"AI question generation fallback for mock session: {e}")
        questions = [
            {
                "question_number": i + 1,
                "question_text": f"Practice Question {i+1} for {req.job_role} ({req.domain}): Explain your approach to solving complex problems in this role.",
                "interview_type": req.interview_type,
                "domain": req.domain,
                "difficulty": req.difficulty,
            }
            for i in range(req.num_questions)
        ]

    session_row = await db.fetchrow(
        """
        INSERT INTO interview_sessions (
            user_id, candidate_id, job_role, domain, interview_type, difficulty,
            experience_level, num_questions, user_skills, status, is_mock,
            total_questions, completed_questions, created_at, updated_at
        ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, 'created', TRUE, $9, 0, NOW(), NOW())
        RETURNING *
        """,
        current_user["id"],
        req.job_role,
        req.domain,
        req.interview_type,
        req.difficulty,
        req.experience_level or "Mid Level",
        req.num_questions,
        req.user_skills,
        len(questions),
    )

    session_id = session_row["id"]
    question_responses = []

    for idx, q in enumerate(questions, 1):
        q_row = await db.fetchrow(
            """
            INSERT INTO interview_questions (
                session_id, question_number, question_text, interview_type,
                domain, difficulty, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
            """,
            session_id,
            idx,
            q["question_text"],
            q.get("interview_type", req.interview_type),
            q.get("domain", req.domain),
            q.get("difficulty", req.difficulty),
        )

        question_responses.append(
            MockQuestionResponse(
                id=q_row["id"],
                session_id=q_row["session_id"],
                question_number=q_row["question_number"],
                question_text=q_row["question_text"],
                interview_type=q_row["interview_type"],
                domain=q_row["domain"],
                difficulty=q_row["difficulty"],
                user_answer=q_row["user_answer"],
            )
        )

    res = dict(session_row)
    res["questions"] = question_responses
    return res


@router.post("/mock-interviews/sessions/{session_id}/answer", response_model=MockQuestionResponse)
async def submit_mock_answer(
    session_id: UUID,
    req: SubmitAnswerRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Submits an answer for a mock practice question.
    Strictly candidate-only and strictly isolated from AI evaluation & scoring pipelines.
    """
    if current_user["role"] != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Mock Interview is a candidate-only practice feature.",
        )

    session_row = await db.fetchrow(
        "SELECT * FROM interview_sessions WHERE id = $1 AND (user_id = $2 OR candidate_id = $2) AND is_mock = TRUE",
        session_id,
        current_user["id"],
    )
    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mock interview session not found or access unauthorized.",
        )

    q_row = await db.fetchrow(
        "UPDATE interview_questions SET user_answer = $1 WHERE id = $2 AND session_id = $3 RETURNING *",
        req.user_answer,
        req.question_id,
        session_id,
    )
    if not q_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found for this mock session.",
        )

    answered_count = await db.fetchval(
        "SELECT COUNT(*) FROM interview_questions WHERE session_id = $1 AND user_answer IS NOT NULL AND TRIM(user_answer) != ''",
        session_id,
    ) or 0

    await db.execute(
        "UPDATE interview_sessions SET completed_questions = $1, status = 'in_progress', updated_at = NOW() WHERE id = $2",
        answered_count,
        session_id,
    )

    return MockQuestionResponse(
        id=q_row["id"],
        session_id=q_row["session_id"],
        question_number=q_row["question_number"],
        question_text=q_row["question_text"],
        interview_type=q_row["interview_type"],
        domain=q_row["domain"],
        difficulty=q_row["difficulty"],
        user_answer=q_row["user_answer"],
    )


@router.post("/mock-interviews/sessions/{session_id}/end", response_model=MockSessionResponse)
async def end_mock_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Completes a mock practice session.
    Marks session as completed without generating AI feedback, scores, or recruiter reports.
    """
    if current_user["role"] != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Mock Interview is a candidate-only practice feature.",
        )

    session_row = await db.fetchrow(
        "SELECT * FROM interview_sessions WHERE id = $1 AND (user_id = $2 OR candidate_id = $2) AND is_mock = TRUE",
        session_id,
        current_user["id"],
    )
    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mock interview session not found or access unauthorized.",
        )

    started_at = session_row["started_at"] or session_row["created_at"]
    now = datetime.now()
    duration = int((now - started_at).total_seconds()) if started_at else 0

    answered_count = await db.fetchval(
        "SELECT COUNT(*) FROM interview_questions WHERE session_id = $1 AND user_answer IS NOT NULL AND TRIM(user_answer) != ''",
        session_id,
    ) or 0

    updated_row = await db.fetchrow(
        """
        UPDATE interview_sessions
        SET status = 'completed', ended_at = NOW(), duration = $1, completed_questions = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        """,
        duration,
        answered_count,
        session_id,
    )

    q_rows = await db.fetch(
        "SELECT * FROM interview_questions WHERE session_id = $1 ORDER BY question_number ASC",
        session_id,
    )

    questions = [
        MockQuestionResponse(
            id=q["id"],
            session_id=q["session_id"],
            question_number=q["question_number"],
            question_text=q["question_text"],
            interview_type=q["interview_type"],
            domain=q["domain"],
            difficulty=q["difficulty"],
            user_answer=q["user_answer"],
        )
        for q in q_rows
    ]

    res = dict(updated_row)
    res["questions"] = questions
    return res


@router.get("/mock-interviews/sessions", response_model=List[MockSessionHistoryResponse])
async def list_mock_sessions(
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns candidate's private practice history. Strictly candidate-only.
    Displays basic practice metrics without scores or feedback.
    """
    if current_user["role"] != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Mock Interview is a candidate-only practice feature.",
        )

    rows = await db.fetch(
        """
        SELECT id, job_role, domain, interview_type, difficulty, num_questions,
               completed_questions, status, is_mock, duration, created_at, started_at, ended_at
        FROM interview_sessions
        WHERE is_mock = TRUE AND (user_id = $1 OR candidate_id = $1)
        ORDER BY created_at DESC
        """,
        current_user["id"],
    )

    return [dict(r) for r in rows]


@router.get("/mock-interviews/sessions/{session_id}", response_model=MockSessionResponse)
async def get_mock_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Retrieves details of a practice session including questions and candidate answers.
    Strictly ownership-validated; returns NO scores or AI feedback.
    """
    if current_user["role"] != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Mock Interview is a candidate-only practice feature.",
        )

    session_row = await db.fetchrow(
        "SELECT * FROM interview_sessions WHERE id = $1 AND (user_id = $2 OR candidate_id = $2) AND is_mock = TRUE",
        session_id,
        current_user["id"],
    )
    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mock interview session not found or access unauthorized.",
        )

    q_rows = await db.fetch(
        "SELECT * FROM interview_questions WHERE session_id = $1 ORDER BY question_number ASC",
        session_id,
    )

    questions = [
        MockQuestionResponse(
            id=q["id"],
            session_id=q["session_id"],
            question_number=q["question_number"],
            question_text=q["question_text"],
            interview_type=q["interview_type"],
            domain=q["domain"],
            difficulty=q["difficulty"],
            user_answer=q["user_answer"],
        )
        for q in q_rows
    ]

    res = dict(session_row)
    res["questions"] = questions
    return res


# ── 4. GET /api/sessions ─────────────────────────────────────
@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    current_user: CurrentUser,
    status_filter: Optional[str] = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Get official interview sessions. Candidates see assigned official interviews; Recruiters/Admins see managed official interviews.
    Mock practice sessions are strictly excluded.
    """
    if current_user["role"] == "candidate":
        if status_filter:
            rows = await db.fetch(
                """
                SELECT * FROM interview_sessions
                WHERE (candidate_id = $1 OR user_id = $1) AND status = $2 AND (is_mock IS FALSE OR is_mock IS NULL)
                ORDER BY created_at DESC
                """,
                current_user["id"],
                status_filter,
            )
        else:
            rows = await db.fetch(
                """
                SELECT * FROM interview_sessions
                WHERE (candidate_id = $1 OR user_id = $1) AND (is_mock IS FALSE OR is_mock IS NULL)
                ORDER BY created_at DESC
                """,
                current_user["id"],
            )
    else:
        if status_filter:
            rows = await db.fetch(
                """
                SELECT * FROM interview_sessions
                WHERE (created_by = $1 OR user_id = $1) AND status = $2 AND (is_mock IS FALSE OR is_mock IS NULL)
                ORDER BY created_at DESC
                """,
                current_user["id"],
                status_filter,
            )
        else:
            rows = await db.fetch(
                """
                SELECT * FROM interview_sessions
                WHERE (is_mock IS FALSE OR is_mock IS NULL)
                ORDER BY created_at DESC
                """,
            )

    result = []
    for r in rows:
        d = dict(r)
        d["questions"] = []
        result.append(d)
    return result


# ── 5. GET /api/sessions/{id} ────────────────────────────────
@router.get("/sessions/{session_id}", response_model=SessionResponse)
@router.get("/interviews/sessions/{session_id}", response_model=SessionResponse)
@router.get("/interview-sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Loads an existing official interview session by ID.
    Mock sessions are blocked for recruiters/admins and must be accessed via /api/mock-interviews/... for candidates.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    if role in ("recruiter", "admin"):
        session_row = await db.fetchrow(
            "SELECT * FROM interview_sessions WHERE id = $1 AND (is_mock IS FALSE OR is_mock IS NULL)",
            session_id,
        )
    else:
        session_row = await db.fetchrow(
            "SELECT * FROM interview_sessions WHERE id = $1 AND (user_id = $2 OR candidate_id = $2 OR created_by = $2) AND (is_mock IS FALSE OR is_mock IS NULL)",
            session_id,
            user_id,
        )

    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview session not found.",
        )

    rec_row = await db.fetchrow(
        "SELECT id FROM interview_recordings WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1",
        session_id,
    )

    q_rows = await db.fetch(
        """
        SELECT * FROM interview_questions
        WHERE session_id = $1
        ORDER BY question_number ASC
        """,
        session_id,
    )

    timing_rows = await db.fetch(
        """
        SELECT * FROM interview_question_timings
        WHERE session_id = $1
        ORDER BY question_number ASC, created_at DESC
        """,
        session_id,
    )
    timings_map = {}
    timings_list = []
    for t in timing_rows:
        td = dict(t)
        timings_list.append(td)
        q_num = t["question_number"]
        if q_num not in timings_map:
            timings_map[q_num] = t["time_spent"]

    questions = []
    for q in q_rows:
        pts = q["expected_answer_points"]
        if isinstance(pts, str):
            pts = json.loads(pts)
        q_num = q["question_number"]
        questions.append(
            QuestionResponse(
                id=q["id"],
                session_id=q["session_id"],
                question_number=q_num,
                question_text=q["question_text"],
                interview_type=q["interview_type"],
                domain=q["domain"],
                difficulty=q["difficulty"],
                expected_answer_points=pts or [],
                category=q["category"],
                user_answer=q["user_answer"],
                sample_answer=q["sample_answer"],
                feedback=q["feedback"],
                score=float(q["score"]) if q["score"] is not None else None,
                time_spent=timings_map.get(q_num, 0),
            )
        )

    res = dict(session_row)
    res["questions"] = questions
    res["timings"] = timings_list
    res["has_recording"] = rec_row is not None
    res["recording_id"] = rec_row["id"] if rec_row else None

    result_row = await db.fetchrow(
        "SELECT * FROM interview_results WHERE session_id = $1",
        session_id,
    )
    if result_row:
        res["result"] = dict(result_row)

    q_result_rows = await db.fetch(
        "SELECT * FROM interview_question_results WHERE session_id = $1 ORDER BY question_number ASC",
        session_id,
    )
    if q_result_rows:
        res["question_results"] = [dict(r) for r in q_result_rows]

    return res


# ── 6. POST /api/sessions/{id}/start ─────────────────────────
@router.post("/sessions/{session_id}/start", response_model=SessionResponse)
@router.post("/interviews/sessions/{session_id}/start", response_model=SessionResponse)
@router.post("/interview-sessions/{session_id}/start", response_model=SessionResponse)
async def start_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Starts an interview session (sets status to IN_PROGRESS and updates started_at).
    """
    user_id = current_user["id"]
    role = current_user["role"]

    existing = await db.fetchrow("SELECT status FROM interview_sessions WHERE id = $1", session_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    current_st = (existing["status"] or "").upper()
    if current_st in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start session in status '{current_st}'."
        )

    if role in ("recruiter", "admin"):
        session_row = await db.fetchrow(
            """
            UPDATE interview_sessions
            SET status = 'IN_PROGRESS',
                started_at = COALESCE(started_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            session_id,
        )
    else:
        session_row = await db.fetchrow(
            """
            UPDATE interview_sessions
            SET status = 'IN_PROGRESS',
                started_at = COALESCE(started_at, NOW()),
                updated_at = NOW()
            WHERE id = $1 AND (user_id = $2 OR candidate_id = $2 OR created_by = $2)
            RETURNING *
            """,
            session_id,
            user_id,
        )
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        cand_target = str(session_row.get("candidate_id") or session_row.get("user_id") or user_id)
        await NotificationService.create_session_start_alert(
            db, user_id=cand_target, session_id=str(session_id), job_role=session_row.get("job_role", "Interview")
        )
    except Exception as _start_notif_err:
        print(f"[SmartHire] Warning triggering start notification alert: {_start_notif_err}")

    return await get_session(session_id, current_user, db)


# ── 6b. POST /api/sessions/{id}/pause ────────────────────────
@router.post("/sessions/{session_id}/pause", response_model=SessionResponse)
@router.post("/interviews/sessions/{session_id}/pause", response_model=SessionResponse)
@router.post("/interview-sessions/{session_id}/pause", response_model=SessionResponse)
async def pause_session(
    session_id: UUID,
    req: Optional[PauseSessionRequest] = None,
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Pauses an interview session (sets status to PAUSED and saves current question index).
    """
    user_id = current_user["id"]
    role = current_user["role"]
    q_idx = req.current_question_index if req else 0

    existing = await db.fetchrow("SELECT status FROM interview_sessions WHERE id = $1", session_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    current_st = (existing["status"] or "").upper()
    if current_st != "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot pause session in status '{current_st}'. Session must be IN_PROGRESS."
        )

    if role in ("recruiter", "admin"):
        session_row = await db.fetchrow(
            """
            UPDATE interview_sessions
            SET status = 'PAUSED',
                paused_at = NOW(),
                current_question_index = COALESCE($2, current_question_index),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            session_id,
            q_idx,
        )
    else:
        session_row = await db.fetchrow(
            """
            UPDATE interview_sessions
            SET status = 'PAUSED',
                paused_at = NOW(),
                current_question_index = COALESCE($2, current_question_index),
                updated_at = NOW()
            WHERE id = $1 AND (user_id = $3 OR candidate_id = $3 OR created_by = $3)
            RETURNING *
            """,
            session_id,
            q_idx,
            user_id,
        )
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return await get_session(session_id, current_user, db)


# ── 6c. POST /api/sessions/{id}/resume ───────────────────────
@router.post("/sessions/{session_id}/resume", response_model=SessionResponse)
@router.post("/interviews/sessions/{session_id}/resume", response_model=SessionResponse)
@router.post("/interview-sessions/{session_id}/resume", response_model=SessionResponse)
async def resume_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Resumes a paused interview session (sets status back to IN_PROGRESS).
    """
    user_id = current_user["id"]
    role = current_user["role"]

    existing = await db.fetchrow("SELECT status FROM interview_sessions WHERE id = $1", session_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    current_st = (existing["status"] or "").upper()
    if current_st != "PAUSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resume session in status '{current_st}'. Session must be PAUSED."
        )

    if role in ("recruiter", "admin"):
        session_row = await db.fetchrow(
            """
            UPDATE interview_sessions
            SET status = 'IN_PROGRESS',
                resumed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            session_id,
        )
    else:
        session_row = await db.fetchrow(
            """
            UPDATE interview_sessions
            SET status = 'IN_PROGRESS',
                resumed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1 AND (user_id = $2 OR candidate_id = $2 OR created_by = $2)
            RETURNING *
            """,
            session_id,
            user_id,
        )
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return await get_session(session_id, current_user, db)


# ── 7. POST /api/sessions/{id}/answer & /answers ────────────
@router.post("/sessions/{session_id}/answer", response_model=QuestionResponse)
@router.post("/sessions/{session_id}/answers", response_model=QuestionResponse)
@router.post("/interviews/sessions/{session_id}/answer", response_model=QuestionResponse)
@router.post("/interviews/sessions/{session_id}/answers", response_model=QuestionResponse)
@router.post("/interview-sessions/{session_id}/answer", response_model=QuestionResponse)
@router.post("/interview-sessions/{session_id}/answers", response_model=QuestionResponse)
async def submit_question_answer(
    session_id: UUID,
    req: SubmitAnswerRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Submit answer for a specific question. Performs AI evaluation and returns instant feedback & score.
    """
    q_row = await db.fetchrow(
        "SELECT * FROM interview_questions WHERE id = $1 AND session_id = $2",
        req.question_id,
        session_id,
    )
    if not q_row:
        raise HTTPException(status_code=404, detail="Question not found in session")

    pts = q_row["expected_answer_points"]
    if isinstance(pts, str):
        pts = json.loads(pts)

    eval_result = await AIService.evaluate_answer(
        question_text=q_row["question_text"],
        user_answer=req.user_answer,
        interview_type=q_row["interview_type"],
        difficulty=q_row["difficulty"],
        expected_points=pts or [],
    )

    q_tech_res = RealAIScoringEngine.calculate_technical_relevance_score(
        technical_accuracy=eval_result.get("technical_accuracy"),
        keyword_relevance=eval_result.get("keyword_relevance"),
        problem_solving=eval_result.get("problem_solving"),
        domain_knowledge=eval_result.get("domain_knowledge"),
        answer_completeness=eval_result.get("answer_completeness"),
        evaluation_status=eval_result.get("status", "completed")
    )
    computed_q_score = q_tech_res.get("score")

    updated_q = await db.fetchrow(
        """
        UPDATE interview_questions
        SET user_answer = $1,
            score = $2,
            feedback = $3,
            sample_answer = COALESCE(sample_answer, $4)
        WHERE id = $5
        RETURNING *
        """,
        req.user_answer,
        computed_q_score,
        eval_result.get("feedback") or f"Answer evaluated with technical score of {computed_q_score:.0f}/100" if computed_q_score is not None else "Evaluation complete",
        eval_result.get("sample_answer"),
        req.question_id,
    )

    await db.execute(
        """
        UPDATE interview_sessions
        SET completed_questions = (
            SELECT COUNT(*) FROM interview_questions
            WHERE session_id = $1 AND user_answer IS NOT NULL AND user_answer != ''
        ), updated_at = NOW()
        WHERE id = $1
        """,
        session_id,
    )

    res_pts = updated_q["expected_answer_points"]
    if isinstance(res_pts, str):
        res_pts = json.loads(res_pts)

    return QuestionResponse(
        id=updated_q["id"],
        session_id=updated_q["session_id"],
        question_number=updated_q["question_number"],
        question_text=updated_q["question_text"],
        interview_type=updated_q["interview_type"],
        domain=updated_q["domain"],
        difficulty=updated_q["difficulty"],
        expected_answer_points=res_pts or [],
        category=updated_q["category"],
        user_answer=updated_q["user_answer"],
        sample_answer=updated_q["sample_answer"],
        feedback=updated_q["feedback"],
        score=float(updated_q["score"]) if updated_q["score"] is not None else None,
    )


# ── 7b. POST /api/sessions/{id}/timings ──────────────────────
@router.post("/sessions/{session_id}/timings", response_model=QuestionTimingResponse)
@router.post("/sessions/{session_id}/timing", response_model=QuestionTimingResponse)
@router.post("/interviews/sessions/{session_id}/timings", response_model=QuestionTimingResponse)
@router.post("/interview-sessions/{session_id}/timings", response_model=QuestionTimingResponse)
async def submit_question_timing(
    session_id: UUID,
    req: SubmitTimingRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Records start_time, answered_at time, and net time_spent (seconds) for a question.
    """
    session_row = await db.fetchrow("SELECT id FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    timing_row = await db.fetchrow(
        """
        INSERT INTO interview_question_timings (
            session_id, question_id, question_number, started_at, answered_at, time_spent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
        """,
        session_id,
        req.question_id,
        req.question_number,
        req.started_at or datetime.utcnow(),
        req.answered_at or datetime.utcnow(),
        req.time_spent,
    )

    return QuestionTimingResponse(
        id=timing_row["id"],
        session_id=timing_row["session_id"],
        question_id=timing_row["question_id"],
        question_number=timing_row["question_number"],
        started_at=timing_row["started_at"],
        answered_at=timing_row["answered_at"],
        time_spent=timing_row["time_spent"],
        created_at=timing_row["created_at"],
    )


# ── 8. REAL AI EVALUATION & SESSION FINALIZATION PIPELINE ─────────────

async def run_finalize_interview_pipeline(session_id: UUID, db: asyncpg.Connection) -> dict:
    """
    Finalizes interview session by executing actual AI evaluation and score calculations:
    1. Sets status COMPLETED and computes total duration.
    2. Retrieves answered questions, actual transcripts, speech analysis, emotion data, eye-tracking events, and proctoring summaries.
    3. Evaluates candidate answers using Gemini AI API with Pydantic validation.
    4. Computes Communication (30%), Confidence (25%), Technical Relevance (30%), and Professionalism (15%) scores.
    5. Calculates unrounded weighted overall score, display score, and performance rating rubric.
    6. Synthesizes performance-grounded AI feedback.
    7. Persists final result to PostgreSQL tables interview_results and interview_question_results.
    """
    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    if session_row.get("is_mock"):
        raise HTTPException(
            status_code=400,
            detail="Mock Interview sessions cannot be evaluated or finalized via official evaluation pipeline.",
        )

    candidate_id = session_row["candidate_id"] or session_row["user_id"]
    total_q = session_row["total_questions"] or session_row["num_questions"] or 5
    job_role = session_row.get("job_role") or "Candidate"
    domain = session_row.get("domain") or "General"
    itype = session_row.get("interview_type") or "Technical Interview"
    difficulty = session_row.get("difficulty") or "Intermediate"

    # Compute duration accurately
    started_at = session_row.get("started_at") or session_row.get("created_at")
    duration_seconds = 0
    if started_at:
        now_ts = datetime.utcnow()
        if started_at.tzinfo is not None:
            now_ts = datetime.now(started_at.tzinfo)
        duration_seconds = max(0, int((now_ts - started_at).total_seconds()))

    # If elapsed time is 0, fallback to sum of question-level timings
    if duration_seconds <= 0:
        try:
            timing_sum = await db.fetchval("SELECT COALESCE(SUM(time_spent), 0) FROM interview_question_timings WHERE session_id = $1", session_id)
            duration_seconds = int(timing_sum or 0)
        except Exception:
            duration_seconds = 0

    if duration_seconds <= 0:
        try:
            q_sum = await db.fetchval("SELECT COALESCE(SUM(time_spent), 0) FROM interview_question_results WHERE session_id = $1", session_id)
            duration_seconds = int(q_sum or 0)
        except Exception:
            duration_seconds = 0

    total_duration = max(session_row.get("duration", 0) or 0, duration_seconds)

    # Mark COMPLETED immediately in database
    await db.execute(
        """
        UPDATE interview_sessions
        SET status = 'COMPLETED',
            ended_at = COALESCE(ended_at, NOW()),
            duration = $1,
            updated_at = NOW()
        WHERE id = $2
        """,
        total_duration, session_id
    )

    # Fetch questions, transcripts, and audio answers
    q_rows = await db.fetch("SELECT * FROM interview_questions WHERE session_id = $1 ORDER BY question_number ASC", session_id)
    trans_rows = await db.fetch("SELECT * FROM interview_transcripts WHERE session_id = $1", session_id)
    audio_rows = await db.fetch("SELECT * FROM interview_audio_answers WHERE session_id = $1", session_id)

    trans_map_id = {str(t["question_id"]): t["transcript"] for t in trans_rows if t.get("question_id")}
    trans_map_num = {t["question_number"]: t["transcript"] for t in trans_rows if t.get("question_number") is not None}
    audio_map_id = {str(a["question_id"]): a for a in audio_rows if a.get("question_id")}
    audio_map_num = {a["question_number"]: a for a in audio_rows if a.get("question_number") is not None}

    # Fetch timings
    try:
        timing_rows = await db.fetch("SELECT question_number, SUM(time_spent) as total_time FROM interview_question_timings WHERE session_id = $1 GROUP BY question_number", session_id)
        timings_map = {t["question_number"]: t["total_time"] for t in timing_rows if t.get("question_number")}
    except Exception:
        timings_map = {}

    # Fetch analysis data from PostgreSQL
    emo_events = await db.fetch("SELECT * FROM interview_emotion_analysis WHERE session_id = $1", session_id)
    eye_events = await db.fetch("SELECT * FROM eye_tracking_events WHERE session_id = $1", session_id)
    proc_summary = await db.fetchrow("SELECT * FROM interview_proctoring_summary WHERE session_id = $1", session_id)
    proc_events = await db.fetch("SELECT * FROM interview_integrity_events WHERE session_id = $1", session_id)

    question_evaluations = []
    answered_count = 0

    # Reset existing question results for re-finalization
    await db.execute("DELETE FROM interview_question_results WHERE session_id = $1", session_id)

    tech_scores = []
    comm_scores = []
    conf_scores = []
    prof_scores = []

    for q in q_rows:
        q_id = q["id"]
        q_num = q["question_number"]
        q_text = q["question_text"]
        user_ans = q.get("user_answer") or trans_map_id.get(str(q_id)) or trans_map_num.get(q_num) or ""
        expected_pts = q.get("expected_answer_points")
        if isinstance(expected_pts, str):
            try: expected_pts = json.loads(expected_pts)
            except Exception: expected_pts = []

        audio_info = audio_map_id.get(str(q_id)) or audio_map_num.get(q_num)
        q_duration = timings_map.get(q_num) or (audio_info.get("duration") if audio_info else 0) or 0
        if q_duration <= 0 and user_ans and user_ans.strip():
            w_cnt = len(re.findall(r"\b[\w']+\b", user_ans))
            q_duration = max(1, round((w_cnt / 135.0) * 60.0))

        # If user_ans is empty but audio file exists, attempt auto-transcription
        if not (user_ans and user_ans.strip()) and audio_info:
            audio_path = audio_info.get("storage_location")
            if audio_path and os.path.exists(audio_path):
                try:
                    with open(audio_path, "rb") as af:
                        audio_bytes = af.read()
                    mime_t = audio_info.get("mime_type") or "audio/webm"
                    tr_res = await AIService.transcribe_audio(audio_bytes, mime_type=mime_t)
                    if tr_res and tr_res.get("transcript"):
                        user_ans = tr_res["transcript"]
                        w_cnt = len(re.findall(r"\b[\w']+\b", user_ans))
                        cand_id_val = session_row.get("candidate_id") or session_row.get("user_id")
                        await db.execute(
                            """
                            INSERT INTO interview_transcripts (
                                session_id, question_id, candidate_id, question_number, transcript, duration, word_count, created_at, updated_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                            ON CONFLICT (session_id, question_id) DO UPDATE SET
                                transcript = EXCLUDED.transcript,
                                duration = EXCLUDED.duration,
                                word_count = EXCLUDED.word_count,
                                updated_at = NOW()
                            """,
                            session_id, q_id, cand_id_val, q_num, user_ans, audio_info.get("duration", 0), w_cnt
                        )
                        await db.execute(
                            "UPDATE interview_questions SET user_answer = $1 WHERE id = $2",
                            user_ans, q_id
                        )
                except Exception as _tr_err:
                    print(f"[SmartHire] Warning transcribing audio for question {q_num}: {_tr_err}")

        # Ensure transcript is saved to interview_transcripts if answered
        cand_id_val = session_row.get("candidate_id") or session_row.get("user_id")
        if user_ans and user_ans.strip():
            w_cnt = len(re.findall(r"\b[\w']+\b", user_ans))
            try:
                await db.execute(
                    """
                    INSERT INTO interview_transcripts (
                        session_id, question_id, candidate_id, question_number, transcript, duration, word_count, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                    ON CONFLICT (session_id, question_id) DO UPDATE SET
                        transcript = EXCLUDED.transcript,
                        duration = EXCLUDED.duration,
                        word_count = EXCLUDED.word_count,
                        updated_at = NOW()
                    """,
                    session_id, q_id, cand_id_val, q_num, user_ans, q_duration, w_cnt
                )
            except Exception as _tr_save_err:
                print(f"[SmartHire] Warning saving transcript: {_tr_save_err}")

        has_answer = bool(user_ans and user_ans.strip())

        if has_answer:
            answered_count += 1

            # 1. Question Communication Analysis
            comm_info = CommunicationService.analyze_communication_quality(user_ans, duration_seconds=q_duration)
            q_comm_score = comm_info.get("communication_score")
            if q_comm_score is not None: comm_scores.append(q_comm_score)

            # Persist into communication_analysis table for this question
            try:
                await db.execute(
                    """
                    INSERT INTO communication_analysis (
                        session_id, question_id, grammar_score, grammar_error_count,
                        grammar_feedback, filler_word_count, filler_words_per_minute, filler_rate,
                        filler_words_list, words_per_minute, speaking_duration, word_count,
                        pace_category, pronunciation_score, pronunciation_status, pronunciation_feedback,
                        communication_score, feedback, strengths, weaknesses, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20::jsonb, NOW(), NOW()
                    )
                    ON CONFLICT (session_id, question_id) DO UPDATE SET
                        grammar_score = EXCLUDED.grammar_score,
                        grammar_error_count = EXCLUDED.grammar_error_count,
                        grammar_feedback = EXCLUDED.grammar_feedback,
                        filler_word_count = EXCLUDED.filler_word_count,
                        filler_words_per_minute = EXCLUDED.filler_words_per_minute,
                        filler_rate = EXCLUDED.filler_rate,
                        filler_words_list = EXCLUDED.filler_words_list,
                        words_per_minute = EXCLUDED.words_per_minute,
                        speaking_duration = EXCLUDED.speaking_duration,
                        word_count = EXCLUDED.word_count,
                        pace_category = EXCLUDED.pace_category,
                        pronunciation_score = EXCLUDED.pronunciation_score,
                        pronunciation_status = EXCLUDED.pronunciation_status,
                        pronunciation_feedback = EXCLUDED.pronunciation_feedback,
                        communication_score = EXCLUDED.communication_score,
                        feedback = EXCLUDED.feedback,
                        strengths = EXCLUDED.strengths,
                        weaknesses = EXCLUDED.weaknesses,
                        updated_at = NOW()
                    """,
                    session_id, q_id,
                    comm_info["grammar_score"], comm_info["grammar_error_count"], comm_info["grammar_feedback"],
                    comm_info["filler_word_count"], comm_info["filler_words_per_minute"], comm_info["filler_rate"],
                    json.dumps(comm_info["filler_words_list"]), comm_info["words_per_minute"], comm_info["speaking_duration"],
                    comm_info["word_count"], comm_info["pace_category"],
                    comm_info["pronunciation_score"] if comm_info.get("pronunciation_score") is not None else 100.0,
                    comm_info["pronunciation_status"], comm_info["pronunciation_feedback"], comm_info["communication_score"],
                    comm_info["feedback"], json.dumps(comm_info["strengths"]), json.dumps(comm_info["weaknesses"])
                )
            except Exception as _ca_err:
                print(f"[SmartHire] Error persisting question communication_analysis: {_ca_err}")

            # 2. Structured AI Evaluation & Technical Sub-metrics
            ai_eval = await AIService.evaluate_answer(
                question_text=q_text,
                user_answer=user_ans,
                interview_type=itype,
                difficulty=difficulty,
                expected_points=expected_pts,
                job_role=job_role,
                domain=domain
            )
            ai_eval["user_answer"] = user_ans
            ai_eval["question_text"] = q_text
            ai_eval["question_number"] = q_num
            question_evaluations.append(ai_eval)

            q_tech_acc = ai_eval.get("technical_accuracy")
            q_kw_rel = ai_eval.get("keyword_relevance")
            q_ps = ai_eval.get("problem_solving")
            q_dom = ai_eval.get("domain_knowledge")
            q_ans_comp = ai_eval.get("answer_completeness")

            q_tech_res = RealAIScoringEngine.calculate_technical_relevance_score(
                technical_accuracy=q_tech_acc,
                keyword_relevance=q_kw_rel,
                problem_solving=q_ps,
                domain_knowledge=q_dom,
                answer_completeness=q_ans_comp,
                evaluation_status=ai_eval.get("status", "completed")
            )
            q_tech_score = q_tech_res.get("score")
            if q_tech_score is not None: tech_scores.append(q_tech_score)

            # Question Confidence & Professionalism Estimates
            q_conf_score = ai_eval.get("confidence_indicators")
            if q_conf_score is not None:
                conf_scores.append(float(q_conf_score))

            q_prof_score = ai_eval.get("professionalism")
            if q_prof_score is not None:
                prof_scores.append(float(q_prof_score))

            # Weighted question overall
            valid_q_comps = [s for s in [q_comm_score, q_conf_score, q_tech_score, q_prof_score] if s is not None]
            q_overall = round(sum(valid_q_comps) / len(valid_q_comps), 2) if valid_q_comps else None

            # Persist question result
            await db.execute(
                """
                INSERT INTO interview_question_results (
                    session_id, question_id, question_number, question_text, answer_status, time_spent,
                    answer_type, user_answer, score, evaluation, communication_score, confidence_score,
                    technical_score, professionalism_score, overall_score, technical_accuracy,
                    keyword_relevance, problem_solving, domain_knowledge, answer_completeness,
                    strengths, weaknesses, improvement_suggestions, created_at
                ) VALUES (
                    $1, $2, $3, $4, 'Answered', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb, NOW()
                )
                """,
                session_id, q_id, q_num, q_text, q_duration,
                q.get("category") or domain, user_ans, q_tech_score,
                json.dumps(ai_eval.get("feedback", "Evaluation complete")),
                q_comm_score, q_conf_score, q_tech_score, q_prof_score, q_overall,
                q_tech_acc, q_kw_rel, q_ps, q_dom, q_ans_comp,
                json.dumps(ai_eval.get("strengths", [])),
                json.dumps(ai_eval.get("weaknesses", [])),
                json.dumps(ai_eval.get("improvement_suggestions", []))
            )
        else:
            # Unanswered question
            await db.execute(
                """
                INSERT INTO interview_question_results (
                    session_id, question_id, question_number, question_text, answer_status, time_spent,
                    answer_type, user_answer, score, evaluation, created_at
                ) VALUES ($1, $2, $3, $4, 'Skipped', $5, $6, '', NULL, 'Unanswered question', NOW())
                """,
                session_id, q_id, q_num, q_text, q_duration, q.get("category") or domain
            )

    # Re-fetch communication_analysis after loop to aggregate session communication score
    comm_rows = await db.fetch("SELECT * FROM communication_analysis WHERE session_id = $1 ORDER BY created_at ASC", session_id)

    # 4 Category Aggregations
    # 1. Technical Relevance Score (30%)
    if tech_scores:
        avg_tech_score = sum(tech_scores) / len(tech_scores)
        tech_eval_res = RealAIScoringEngine.calculate_technical_relevance_score(
            technical_accuracy=avg_tech_score, keyword_relevance=avg_tech_score,
            problem_solving=avg_tech_score, domain_knowledge=avg_tech_score, answer_completeness=avg_tech_score
        )
    else:
        tech_eval_res = RealAIScoringEngine.calculate_technical_relevance_score(evaluation_status="unanswered")

    # 2. Communication Score (30%)
    if comm_rows:
        clarity_scores = [float(c["grammar_score"]) for c in comm_rows if c.get("grammar_score") is not None]
        avg_grammar = sum(clarity_scores) / len(clarity_scores) if clarity_scores else None

        filler_wpms = [float(c["filler_words_per_minute"]) for c in comm_rows if c.get("filler_words_per_minute") is not None]
        avg_fw = sum(filler_wpms) / len(filler_wpms) if filler_wpms else None

        wpms = [float(c["words_per_minute"]) for c in comm_rows if c.get("words_per_minute") is not None and float(c["words_per_minute"]) > 0]
        avg_wpm = sum(wpms) / len(wpms) if wpms else None

        comm_eval_res = RealAIScoringEngine.calculate_communication_score(
            speech_clarity=avg_grammar, grammar_quality=avg_grammar,
            filler_words_per_minute=avg_fw, speaking_pace_wpm=avg_wpm,
            response_completeness=tech_eval_res.get("score"),
            transcript_available=True
        )
    else:
        comm_eval_res = RealAIScoringEngine.calculate_communication_score(transcript_available=bool(trans_rows))

    # 3. Confidence Score (25%)
    if eye_events:
        valid_eye = sum(1 for e in eye_events if e.get("is_looking_at_camera", True))
        eye_dur = valid_eye * 2.0
        total_eye_dur = len(eye_events) * 2.0
    else:
        eye_dur = None; total_eye_dur = None

    beh_row = await db.fetchrow("SELECT * FROM interview_behavior_analysis WHERE session_id = $1", session_id)
    fac_eng = float(beh_row["engagement_score"]) if beh_row and beh_row.get("engagement_score") is not None else None
    attn_breaks = int(beh_row["attention_breaks"]) if beh_row and beh_row.get("attention_breaks") is not None else 0

    conf_eval_res = RealAIScoringEngine.calculate_confidence_score(
        eye_contact_duration=eye_dur, valid_tracking_duration=total_eye_dur,
        attention_break_duration=float(attn_breaks * 3.0),
        facial_engagement_score=fac_eng,
        speaking_confidence_score=sum(conf_scores)/len(conf_scores) if conf_scores else None,
        tracking_available=bool(eye_events or beh_row)
    )

    # 4. Professionalism Score (15%)
    viol_count = proc_summary.get("suspicious_event_count", 0) if proc_summary else len(proc_events)
    prof_eval_res = RealAIScoringEngine.calculate_professionalism_score(
        total_duration_seconds=total_duration,
        proctoring_violations_count=viol_count
    )

    # Overall Score & Performance Rating
    overall_res = RealAIScoringEngine.calculate_overall_score(
        communication_score=comm_eval_res.get("score"),
        confidence_score=conf_eval_res.get("score"),
        technical_relevance_score=tech_eval_res.get("score"),
        professionalism_score=prof_eval_res.get("score")
    )

    # Synthesize AI Feedback (reuse existing only if available with real grounded feedback)
    existing_res = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", session_id)
    ai_feedback = None

    def _parse_list(val):
        if not val: return []
        if isinstance(val, list): return val
        try: return json.loads(val)
        except Exception: return []

    existing_strengths = _parse_list(existing_res.get("strengths")) if existing_res else []
    has_real_strengths = bool(existing_strengths and any(s and str(s).strip().lower() != "insufficient data" for s in existing_strengths))

    if existing_res and existing_res.get("feedback_status") == "available" and has_real_strengths:
        ai_feedback = {
            "status": "available",
            "strengths": existing_strengths,
            "weaknesses": _parse_list(existing_res.get("weaknesses")),
            "improvement_suggestions": _parse_list(existing_res.get("improvement_suggestions")),
            "practice_recommendations": _parse_list(existing_res.get("practice_recommendations")),
            "learning_resources": _parse_list(existing_res.get("learning_resources")),
            "ai_provider": existing_res.get("ai_provider"),
            "ai_model": existing_res.get("ai_model"),
            "generated_at": existing_res.get("feedback_generated_at").isoformat() if existing_res.get("feedback_generated_at") else None
        }
    else:
        try:
            ai_feedback = await AIService.generate_session_feedback(
                job_role=job_role,
                domain=domain,
                interview_type=itype,
                difficulty=difficulty,
                total_duration=total_duration,
                answered_count=answered_count,
                total_questions=total_q,
                question_evaluations=question_evaluations,
                comm_res=comm_eval_res,
                conf_res=conf_eval_res,
                tech_res=tech_eval_res,
                prof_res=prof_eval_res,
                experience_level=session_row.get("experience_level"),
                overall_res=overall_res
            )
        except Exception as _fb_err:
            print(f"[SmartHire] Warning in generate_session_feedback: {_fb_err}")

    if not ai_feedback:
        ai_feedback = {
            "status": "unavailable",
            "strengths": [],
            "weaknesses": [],
            "improvement_suggestions": [],
            "practice_recommendations": [],
            "learning_resources": [],
            "ai_provider": None,
            "ai_model": None,
            "generated_at": None
        }

    feedback_status = ai_feedback.get("status", "unavailable")
    ai_provider = ai_feedback.get("ai_provider")
    ai_model = ai_feedback.get("ai_model")
    fb_gen_at_raw = ai_feedback.get("generated_at")
    fb_gen_at = None
    if fb_gen_at_raw:
        try:
            fb_gen_at = datetime.fromisoformat(fb_gen_at_raw)
        except Exception:
            fb_gen_at = None

    completion_pct = round((answered_count / max(1, total_q)) * 100.0, 2)
    avg_q_time = round(total_duration / max(1, total_q), 2)

    # Upsert into interview_results
    res_row = await db.fetchrow(
        """
        INSERT INTO interview_results (
            session_id, candidate_id, interview_id, total_questions, questions_completed,
            completion_percentage, total_duration, average_question_time,
            technical_score, communication_score, behavioral_score,
            technical_relevance_score, confidence_score, professionalism_score,
            overall_score, performance_rating, recommendation,
            strengths, weaknesses, improvement_suggestions, practice_recommendations, learning_resources,
            feedback_status, ai_provider, ai_model, feedback_generated_at,
            completed_at, created_at, updated_at
        ) VALUES (
            $1, $2, $1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb,
            $22, $23, $24, $25, NOW(), NOW(), NOW()
        )
        ON CONFLICT (session_id) DO UPDATE SET
            candidate_id = EXCLUDED.candidate_id,
            total_questions = EXCLUDED.total_questions,
            questions_completed = EXCLUDED.questions_completed,
            completion_percentage = EXCLUDED.completion_percentage,
            total_duration = EXCLUDED.total_duration,
            average_question_time = EXCLUDED.average_question_time,
            technical_score = EXCLUDED.technical_score,
            communication_score = EXCLUDED.communication_score,
            behavioral_score = EXCLUDED.behavioral_score,
            technical_relevance_score = EXCLUDED.technical_relevance_score,
            confidence_score = EXCLUDED.confidence_score,
            professionalism_score = EXCLUDED.professionalism_score,
            overall_score = EXCLUDED.overall_score,
            performance_rating = EXCLUDED.performance_rating,
            recommendation = EXCLUDED.recommendation,
            strengths = EXCLUDED.strengths,
            weaknesses = EXCLUDED.weaknesses,
            improvement_suggestions = EXCLUDED.improvement_suggestions,
            practice_recommendations = EXCLUDED.practice_recommendations,
            learning_resources = EXCLUDED.learning_resources,
            feedback_status = EXCLUDED.feedback_status,
            ai_provider = EXCLUDED.ai_provider,
            ai_model = EXCLUDED.ai_model,
            feedback_generated_at = EXCLUDED.feedback_generated_at,
            completed_at = NOW(),
            updated_at = NOW()
        RETURNING *
        """,
        session_id, candidate_id, total_q, answered_count,
        completion_pct, total_duration, avg_q_time,
        tech_eval_res.get("score"), comm_eval_res.get("score"), conf_eval_res.get("score"),
        tech_eval_res.get("score"), conf_eval_res.get("score"), prof_eval_res.get("score"),
        overall_res.get("overall_display_score") if overall_res.get("overall_display_score") is not None else 0.0,
        overall_res.get("performance_rating", "Under Review"),
        overall_res.get("performance_rating", "Under Review"),
        json.dumps(ai_feedback.get("strengths", [])),
        json.dumps(ai_feedback.get("weaknesses", [])),
        json.dumps(ai_feedback.get("improvement_suggestions", [])),
        json.dumps(ai_feedback.get("practice_recommendations", [])),
        json.dumps(ai_feedback.get("learning_resources", [])),
        feedback_status,
        ai_provider,
        ai_model,
        fb_gen_at
    )

    # Update session score and status
    await db.execute(
        """
        UPDATE interview_sessions
        SET status = 'completed',
            score = $1,
            completed_questions = $2,
            ended_at = COALESCE(ended_at, NOW()),
            updated_at = NOW()
        WHERE id = $3
        """,
        overall_res.get("overall_display_score", 0.0), answered_count, session_id
    )


    try:
        cand_target = str(candidate_id)
        await NotificationService.create_session_completed_alert(
            db, user_id=cand_target, session_id=str(session_id), job_role=job_role
        )
    except Exception as _nc_err:
        print(f"[SmartHire] Warning triggering completion notification alert: {_nc_err}")

    return dict(res_row)


@router.post("/sessions/{session_id}/finalize")
@router.post("/interviews/sessions/{session_id}/finalize")
@router.post("/sessions/{session_id}/end", response_model=SessionResponse)
@router.post("/interviews/sessions/{session_id}/end", response_model=SessionResponse)
@router.post("/interview-sessions/{session_id}/end", response_model=SessionResponse)
async def finalize_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Finalizes interview session, computes 4-category weighted scores & performance rating,
    generates grounded AI feedback, saves to PostgreSQL, and returns updated session details.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    if role == "candidate" and str(session_row["user_id"]) != str(user_id) and str(session_row["candidate_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to end this session.")

    await run_finalize_interview_pipeline(session_id, db)
    return await get_session(session_id, current_user, db)


# ── 8a. SCORE & FEEDBACK SPECIFIC API ENDPOINTS ───────────────────

@router.get("/interviews/sessions/{session_id}/scores")
@router.get("/sessions/{session_id}/scores")
async def get_session_scores(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns 4 major assessment category scores & overall weighted score.
    """
    res_row = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", session_id)
    if not res_row:
        # Run finalization if not present
        res_row = await run_finalize_interview_pipeline(session_id, db)

    overall_val = float(res_row["overall_score"]) if res_row["overall_score"] is not None else None
    return {
        "session_id": str(session_id),
        "overall_score": overall_val,
        "performance_rating": res_row["performance_rating"] or get_performance_rating(overall_val),
        "category_scores": {
            "communication_score": float(res_row["communication_score"]) if res_row["communication_score"] is not None else None,
            "communication_weight": "30%",
            "confidence_score": float(res_row["confidence_score"]) if res_row["confidence_score"] is not None else None,
            "confidence_weight": "25%",
            "technical_relevance_score": float(res_row["technical_relevance_score"]) if res_row["technical_relevance_score"] is not None else None,
            "technical_relevance_weight": "30%",
            "professionalism_score": float(res_row["professionalism_score"]) if res_row["professionalism_score"] is not None else None,
            "professionalism_weight": "15%",
        }
    }


@router.get("/interviews/sessions/{session_id}/feedback")
@router.get("/sessions/{session_id}/feedback")
async def get_session_feedback(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns performance-grounded AI feedback sections.
    """
    res_row = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", session_id)
    if not res_row:
        res_row = await run_finalize_interview_pipeline(session_id, db)

    def parse_json_field(val):
        if not val: return []
        if isinstance(val, list): return val
        try: return json.loads(val)
        except Exception: return []

    fb_gen_at = res_row.get("feedback_generated_at")
    return {
        "session_id": str(session_id),
        "performance_rating": res_row["performance_rating"],
        "feedback_status": res_row.get("feedback_status") or "unavailable",
        "ai_provider": res_row.get("ai_provider"),
        "ai_model": res_row.get("ai_model"),
        "feedback_generated_at": fb_gen_at.isoformat() if fb_gen_at else None,
        "strengths": parse_json_field(res_row["strengths"]),
        "weaknesses": parse_json_field(res_row["weaknesses"]),
        "improvement_suggestions": parse_json_field(res_row["improvement_suggestions"]),
        "practice_recommendations": parse_json_field(res_row["practice_recommendations"]),
        "learning_resources": parse_json_field(res_row["learning_resources"])
    }


@router.get("/interviews/sessions/{session_id}/question-results")
@router.get("/sessions/{session_id}/question-results")
async def get_question_results(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns question-by-question scoring and analysis breakdown.
    """
    q_rows = await db.fetch("SELECT * FROM interview_question_results WHERE session_id = $1 ORDER BY question_number ASC", session_id)
    results = []
    for q in q_rows:
        qd = dict(q)
        for field in ["strengths", "weaknesses", "improvement_suggestions"]:
            if isinstance(qd.get(field), str):
                try: qd[field] = json.loads(qd[field])
                except Exception: qd[field] = []
        results.append(qd)
    return results



# ── 8a. RECRUITER ANALYTICS & REPORTING ENDPOINTS ───────────────────

@router.get("/recruiter/analytics", response_model=RecruiterAnalyticsResponse)
async def get_recruiter_analytics(
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns analytics card metrics from the database for recruiter dashboard.
    """
    if current_user["role"] not in ("recruiter", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Recruiter authorization required."
        )

    user_id = current_user["id"]
    is_admin = current_user["role"] == "admin"

    if is_admin:
        total_interviews = await db.fetchval("SELECT COUNT(*) FROM interview_sessions") or 0
        completed = await db.fetchval("SELECT COUNT(*) FROM interview_sessions WHERE UPPER(status) = 'COMPLETED'") or 0
        in_progress = await db.fetchval("SELECT COUNT(*) FROM interview_sessions WHERE UPPER(status) = 'IN_PROGRESS'") or 0
        pending = await db.fetchval("SELECT COUNT(*) FROM interview_sessions WHERE UPPER(status) IN ('CREATED', 'PAUSED')") or 0
        avg_score = await db.fetchval("SELECT COALESCE(AVG(overall_score), 0) FROM interview_results") or 0.0
        avg_dur = await db.fetchval("SELECT COALESCE(AVG(total_duration), 0) FROM interview_results") or 0.0

        shortlist_row = await db.fetchrow(
            """
            SELECT 
                COUNT(*) FILTER (WHERE r.overall_score >= 75.0) as recommended,
                COUNT(*) FILTER (WHERE r.overall_score >= 60.0 AND r.overall_score < 75.0) as review_required,
                COUNT(*) FILTER (WHERE r.overall_score < 60.0) as not_recommended,
                COUNT(*) as total_evaluated
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            WHERE UPPER(s.status) = 'COMPLETED' AND r.overall_score IS NOT NULL
            """
        )

        trend_rows = await db.fetch(
            """
            SELECT 
                s.id as session_id,
                COALESCE(r.completed_at, s.ended_at, s.created_at) as completed_at,
                r.overall_score,
                s.job_role,
                s.domain
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            WHERE UPPER(s.status) = 'COMPLETED' AND r.overall_score IS NOT NULL
            ORDER BY COALESCE(r.completed_at, s.ended_at, s.created_at) ASC
            """
        )

        skill_rows = await db.fetch(
            """
            SELECT 
                COALESCE(q.domain, q.category, 'General Skill') as skill,
                AVG(e.score) as score,
                COUNT(e.score) as evaluations_count
            FROM question_evaluations e
            JOIN interview_questions q ON e.question_id = q.id
            JOIN interview_sessions s ON e.session_id = s.id
            WHERE UPPER(s.status) = 'COMPLETED' AND e.score IS NOT NULL
            GROUP BY COALESCE(q.domain, q.category, 'General Skill')
            ORDER BY score DESC
            """
        )
    else:
        total_interviews = await db.fetchval(
            "SELECT COUNT(*) FROM interview_sessions WHERE created_by = $1 OR user_id = $1", user_id
        ) or 0
        completed = await db.fetchval(
            "SELECT COUNT(*) FROM interview_sessions WHERE (created_by = $1 OR user_id = $1) AND UPPER(status) = 'COMPLETED'", user_id
        ) or 0
        in_progress = await db.fetchval(
            "SELECT COUNT(*) FROM interview_sessions WHERE (created_by = $1 OR user_id = $1) AND UPPER(status) = 'IN_PROGRESS'", user_id
        ) or 0
        pending = await db.fetchval(
            "SELECT COUNT(*) FROM interview_sessions WHERE (created_by = $1 OR user_id = $1) AND UPPER(status) IN ('CREATED', 'PAUSED')", user_id
        ) or 0
        avg_score = await db.fetchval(
            """
            SELECT COALESCE(AVG(r.overall_score), 0)
            FROM interview_results r
            JOIN interview_sessions s ON s.id = r.session_id
            WHERE s.created_by = $1 OR s.user_id = $1
            """, user_id
        ) or 0.0
        avg_dur = await db.fetchval(
            """
            SELECT COALESCE(AVG(r.total_duration), 0)
            FROM interview_results r
            JOIN interview_sessions s ON s.id = r.session_id
            WHERE s.created_by = $1 OR s.user_id = $1
            """, user_id
        ) or 0.0

        shortlist_row = await db.fetchrow(
            """
            SELECT 
                COUNT(*) FILTER (WHERE r.overall_score >= 75.0) as recommended,
                COUNT(*) FILTER (WHERE r.overall_score >= 60.0 AND r.overall_score < 75.0) as review_required,
                COUNT(*) FILTER (WHERE r.overall_score < 60.0) as not_recommended,
                COUNT(*) as total_evaluated
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            WHERE UPPER(s.status) = 'COMPLETED' AND r.overall_score IS NOT NULL
              AND (s.created_by = $1 OR s.user_id = $1)
            """, user_id
        )

        trend_rows = await db.fetch(
            """
            SELECT 
                s.id as session_id,
                COALESCE(r.completed_at, s.ended_at, s.created_at) as completed_at,
                r.overall_score,
                s.job_role,
                s.domain
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            WHERE UPPER(s.status) = 'COMPLETED' AND r.overall_score IS NOT NULL
              AND (s.created_by = $1 OR s.user_id = $1)
            ORDER BY COALESCE(r.completed_at, s.ended_at, s.created_at) ASC
            """, user_id
        )

        try:
            skill_rows = await db.fetch(
                """
                SELECT 
                    COALESCE(q.domain, q.category, 'General Skill') as skill,
                    AVG(e.score) as score,
                    COUNT(e.score) as evaluations_count
                FROM question_evaluations e
                JOIN interview_questions q ON e.question_id = q.id
                JOIN interview_sessions s ON e.session_id = s.id
                WHERE UPPER(s.status) = 'COMPLETED' AND e.score IS NOT NULL
                  AND (s.created_by = $1 OR s.user_id = $1)
                GROUP BY COALESCE(q.domain, q.category, 'General Skill')
                ORDER BY score DESC
                """, user_id
            )
        except Exception:
            skill_rows = []

        if not skill_rows:
            try:
                cat_row = await db.fetchrow(
                    """
                    SELECT 
                        AVG(r.technical_relevance_score) as tech,
                        AVG(r.communication_score) as comm,
                        AVG(r.confidence_score) as conf,
                        AVG(r.professionalism_score) as prof,
                        COUNT(*) as eval_cnt
                    FROM interview_results r
                    JOIN interview_sessions s ON r.session_id = s.id
                    WHERE UPPER(s.status) = 'COMPLETED'
                      AND (s.created_by = $1 OR s.user_id = $1)
                    """, user_id
                )
                if cat_row and hasattr(cat_row, 'get'):
                    cat_map = [
                        ("Technical Relevance", cat_row.get("tech")),
                        ("Communication", cat_row.get("comm")),
                        ("Confidence", cat_row.get("conf")),
                        ("Professionalism", cat_row.get("prof")),
                    ]
                    cnt = int(cat_row.get("eval_cnt") or 0)
                    skill_rows = [
                        {"skill": k, "score": float(v), "evaluations_count": cnt}
                        for k, v in cat_map if v is not None and not hasattr(v, '_mock_name')
                    ]
            except Exception:
                skill_rows = []

        shortlisted_rows = await db.fetch(
            """
            SELECT 
                s.id as session_id,
                s.candidate_id,
                COALESCE(u.name, 'Candidate') as candidate_name,
                COALESCE(u.email, '') as candidate_email,
                s.job_role,
                s.status as interview_status,
                r.overall_score,
                r.technical_relevance_score as technical_score,
                r.communication_score,
                r.confidence_score,
                r.professionalism_score,
                COALESCE(r.recommendation, 
                    CASE WHEN r.overall_score >= 75.0 THEN 'Shortlisted' 
                         WHEN r.overall_score >= 60.0 THEN 'Review Required' 
                         ELSE 'Not Recommended' END
                ) as shortlist_status
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            LEFT JOIN users u ON u.id = COALESCE(s.candidate_id, s.user_id)
            WHERE UPPER(s.status) = 'COMPLETED' AND r.overall_score >= 75.0
              AND (s.created_by = $1 OR s.user_id = $1)
            ORDER BY r.overall_score DESC
            """, user_id
        )

    # ── Format Shortlisting Candidates List ──
    shortlisted_candidates = []
    if shortlisted_rows and isinstance(shortlisted_rows, (list, tuple)):
        for r in shortlisted_rows:
            if hasattr(r, 'get'):
                sc_raw = r.get("overall_score")
                overall_val = round(float(sc_raw), 1) if sc_raw is not None and not hasattr(sc_raw, '_mock_name') else None
                
                tech_raw = r.get("technical_score")
                tech_val = round(float(tech_raw), 1) if tech_raw is not None and not hasattr(tech_raw, '_mock_name') else None
                
                comm_raw = r.get("communication_score")
                comm_val = round(float(comm_raw), 1) if comm_raw is not None and not hasattr(comm_raw, '_mock_name') else None

                conf_raw = r.get("confidence_score")
                conf_val = round(float(conf_raw), 1) if conf_raw is not None and not hasattr(conf_raw, '_mock_name') else None

                prof_raw = r.get("professionalism_score")
                prof_val = round(float(prof_raw), 1) if prof_raw is not None and not hasattr(prof_raw, '_mock_name') else None

                shortlisted_candidates.append({
                    "session_id": str(r.get("session_id")),
                    "candidate_id": str(r.get("candidate_id")) if r.get("candidate_id") else None,
                    "candidate_name": str(r.get("candidate_name") or "Candidate"),
                    "candidate_email": str(r.get("candidate_email") or ""),
                    "job_role": str(r.get("job_role") or "Software Engineer"),
                    "overall_score": overall_val,
                    "technical_score": tech_val,
                    "communication_score": comm_val,
                    "confidence_score": conf_val,
                    "professionalism_score": prof_val,
                    "interview_status": str(r.get("interview_status") or "COMPLETED"),
                    "shortlist_status": str(r.get("shortlist_status") or "Shortlisted")
                })

    # ── Format Shortlisting Insights ──
    tot_eval, rec_c, rev_c, not_c = 0, 0, 0, 0
    if shortlist_row and hasattr(shortlist_row, 'get'):
        try:
            v_tot = shortlist_row.get("total_evaluated")
            if isinstance(v_tot, (int, float)): tot_eval = int(v_tot)
            
            v_rec = shortlist_row.get("recommended")
            if isinstance(v_rec, (int, float)): rec_c = int(v_rec)
            
            v_rev = shortlist_row.get("review_required")
            if isinstance(v_rev, (int, float)): rev_c = int(v_rev)
            
            v_not = shortlist_row.get("not_recommended")
            if isinstance(v_not, (int, float)): not_c = int(v_not)
        except Exception:
            tot_eval, rec_c, rev_c, not_c = 0, 0, 0, 0

    if tot_eval > 0:
        rec_pct = round((rec_c / tot_eval) * 100, 1)
        rev_pct = round((rev_c / tot_eval) * 100, 1)
        not_pct = round((not_c / tot_eval) * 100, 1)

        sh_scores = [c["overall_score"] for c in shortlisted_candidates if c.get("overall_score") is not None]
        avg_sh_score = round(sum(sh_scores) / len(sh_scores), 1) if sh_scores else None
        top_score = max(sh_scores) if sh_scores else None

        shortlisting_insights = {
            "total_evaluated": tot_eval,
            "recommended": rec_c,
            "recommended_pct": rec_pct,
            "review_required": rev_c,
            "review_required_pct": rev_pct,
            "not_recommended": not_c,
            "not_recommended_pct": not_pct,
            "shortlisting_rate": f"{rec_pct}%",
            "avg_shortlisted_score": avg_sh_score,
            "top_score": top_score,
            "status": "available"
        }
    else:
        shortlisting_insights = {
            "total_evaluated": 0,
            "recommended": 0,
            "recommended_pct": 0,
            "review_required": 0,
            "review_required_pct": 0,
            "not_recommended": 0,
            "not_recommended_pct": 0,
            "shortlisting_rate": "0%",
            "avg_shortlisted_score": None,
            "top_score": None,
            "status": "insufficient_data"
        }

    # ── Format Performance Trends ──
    performance_trends = []
    if trend_rows and isinstance(trend_rows, (list, tuple)):
        for idx, r in enumerate(trend_rows, 1):
            if hasattr(r, 'get'):
                dt = r.get("completed_at")
                dt_str = dt.strftime("%d %b") if dt and hasattr(dt, 'strftime') else f"Session {idx}"
                sc_raw = r.get("overall_score")
                sc = round(float(sc_raw), 1) if sc_raw is not None and not hasattr(sc_raw, '_mock_name') else 0.0
                performance_trends.append({
                    "session_id": str(r.get("session_id", idx)),
                    "session_label": f"Session {idx}",
                    "date": dt_str,
                    "overall_score": sc,
                    "score": sc,
                    "job_role": r.get("job_role", "Interview")
                })

    # ── Format Skill-wise Analytics ──
    skill_analytics = []
    if skill_rows and isinstance(skill_rows, (list, tuple)):
        for s in skill_rows:
            if hasattr(s, 'get'):
                sk_name = str(s.get("skill") or "General Skill").strip()
                sc_raw = s.get("score")
                sc = round(float(sc_raw), 1) if sc_raw is not None and not hasattr(sc_raw, '_mock_name') else 0.0
                cnt_raw = s.get("evaluations_count")
                eval_cnt = int(cnt_raw) if cnt_raw is not None and not hasattr(cnt_raw, '_mock_name') else 0
                skill_analytics.append({
                    "skill": sk_name,
                    "score": sc,
                    "evaluations_count": eval_cnt
                })

    return RecruiterAnalyticsResponse(
        total_interviews=total_interviews,
        completed_interviews=completed,
        in_progress_interviews=in_progress,
        pending_interviews=pending,
        average_score=round(float(avg_score), 1),
        average_duration=int(round(float(avg_dur))),
        performance_trends=performance_trends,
        skill_analytics=skill_analytics,
        shortlisting_insights=shortlisting_insights,
        shortlisted_candidates=shortlisted_candidates,
    )


@router.get("/recruiter/comparison", response_model=CandidateComparisonResponse)
async def get_candidate_comparison(
    current_user: CurrentUser,
    session_id_a: Optional[str] = Query(None),
    session_id_b: Optional[str] = Query(None),
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Side-by-side candidate performance comparison calculated strictly from PostgreSQL DB records.
    No mock data, random numbers, or fallback demo candidates.
    """
    if current_user["role"] not in ("recruiter", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Recruiter authorization required."
        )

    user_id = current_user["id"]
    is_admin = current_user["role"] == "admin"

    where_clause = "WHERE LOWER(s.status) = 'completed'"
    args = []
    if not is_admin:
        args.append(user_id)
        where_clause += f" AND (s.created_by = ${len(args)} OR s.user_id = ${len(args)})"

    query = f"""
        SELECT 
            s.id as session_id,
            s.candidate_id,
            COALESCE(u.name, 'Candidate') as candidate_name,
            s.job_role,
            s.status,
            r.overall_score,
            r.technical_relevance_score as technical_score,
            r.communication_score,
            r.confidence_score,
            r.professionalism_score,
            r.recommendation
        FROM interview_sessions s
        LEFT JOIN users u ON u.id = COALESCE(s.candidate_id, s.user_id)
        LEFT JOIN interview_results r ON r.session_id = s.id
        {where_clause}
        ORDER BY r.overall_score DESC NULLS LAST
    """

    all_rows = await db.fetch(query, *args)
    if not all_rows or not isinstance(all_rows, (list, tuple)):
        return CandidateComparisonResponse(
            candidate_a=None,
            candidate_b=None,
            comparison=None,
            radar_data=[],
            status="insufficient_data"
        )

    sessions_map = {}
    for r in all_rows:
        if hasattr(r, 'get'):
            sid = str(r.get("session_id"))
            sessions_map[sid] = r

    row_a = None
    row_b = None

    if session_id_a and session_id_a in sessions_map:
        row_a = sessions_map[session_id_a]
    elif len(all_rows) > 0:
        row_a = all_rows[0]

    if session_id_b and session_id_b in sessions_map and row_a and hasattr(row_a, 'get') and str(row_a.get("session_id")) != session_id_b:
        row_b = sessions_map[session_id_b]
    elif len(all_rows) > 1 and row_a and hasattr(row_a, 'get'):
        for r in all_rows:
            if hasattr(r, 'get') and str(r.get("session_id")) != str(row_a.get("session_id")):
                row_b = r
                break

    def build_candidate_detail(row):
        if not row or not hasattr(row, 'get'):
            return None
        c_name = str(row.get("candidate_name") or "Candidate")
        parts = c_name.split()
        initials = "".join([p[0] for p in parts[:2] if p]).upper() if parts else "C"

        overall = row.get("overall_score")
        overall_val = round(float(overall), 1) if overall is not None and not hasattr(overall, '_mock_name') else None

        rec = row.get("recommendation")
        if rec and isinstance(rec, str) and rec.strip() and not hasattr(rec, '_mock_name'):
            status_text = rec.strip()
        elif overall_val is not None:
            if overall_val >= 75.0:
                status_text = "Shortlisted"
            elif overall_val >= 60.0:
                status_text = "Review Required"
            else:
                status_text = "Not Recommended"
        else:
            status_text = "Under Review"

        tech = row.get("technical_score")
        tech_val = round(float(tech), 1) if tech is not None and not hasattr(tech, '_mock_name') else None

        comm = row.get("communication_score")
        comm_val = round(float(comm), 1) if comm is not None and not hasattr(comm, '_mock_name') else None

        conf = row.get("confidence_score")
        conf_val = round(float(conf), 1) if conf is not None and not hasattr(conf, '_mock_name') else None

        prof = row.get("professionalism_score")
        prof_val = round(float(prof), 1) if prof is not None and not hasattr(prof, '_mock_name') else None

        return CandidateComparisonDetail(
            session_id=row.get("session_id"),
            candidate_id=row.get("candidate_id"),
            name=c_name,
            role=row.get("job_role") or "Candidate",
            overall_score=overall_val,
            technical_score=tech_val,
            communication_score=comm_val,
            confidence_score=conf_val,
            professionalism_score=prof_val,
            status=status_text,
            recommendation=str(rec) if rec and not hasattr(rec, '_mock_name') else None,
            initials=initials
        )

    detail_a = build_candidate_detail(row_a)
    detail_b = build_candidate_detail(row_b)

    comp_diff = None
    if detail_a and detail_b:
        def diff(val_a, val_b):
            if val_a is not None and val_b is not None:
                return round(val_a - val_b, 1)
            return None

        comp_diff = ComparisonDifference(
            technical_difference=diff(detail_a.technical_score, detail_b.technical_score),
            confidence_difference=diff(detail_a.confidence_score, detail_b.confidence_score),
            communication_difference=diff(detail_a.communication_score, detail_b.communication_score),
            professionalism_difference=diff(detail_a.professionalism_score, detail_b.professionalism_score),
            overall_difference=diff(detail_a.overall_score, detail_b.overall_score)
        )

    radar_data = []
    if detail_a or detail_b:
        subjects = [
            ("Technical", "technical_score"),
            ("Communication", "communication_score"),
            ("Confidence", "confidence_score"),
            ("Professionalism", "professionalism_score"),
        ]
        for label, key in subjects:
            val_a = getattr(detail_a, key) if detail_a else None
            val_b = getattr(detail_b, key) if detail_b else None
            radar_data.append({
                "subject": label,
                "candidate1": val_a if val_a is not None else 0,
                "candidate2": val_b if val_b is not None else 0,
            })

    return CandidateComparisonResponse(
        candidate_a=detail_a,
        candidate_b=detail_b,
        comparison=comp_diff,
        radar_data=radar_data,
        status="available" if (detail_a or detail_b) else "insufficient_data"
    )


@router.get("/recruiter/interviews", response_model=List[RecruiterCandidateInterviewResponse])
async def list_recruiter_interviews(
    current_user: CurrentUser,
    search: Optional[str] = None,
    job_role: Optional[str] = None,
    domain: Optional[str] = None,
    interview_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_by: Optional[str] = "completed_at",
    sort_order: Optional[str] = "desc",
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Retrieves filtered & sorted list of candidates / interview sessions for Recruiter Dashboard.
    Supports server-side Domain & Interview Type filtering grounded strictly in database records.
    """
    if current_user["role"] not in ("recruiter", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Recruiter authorization required."
        )

    user_id = current_user["id"]
    is_admin = current_user["role"] == "admin"

    query = """
        SELECT 
            s.id as session_id,
            s.id,
            s.candidate_id,
            COALESCE(u.name, 'Candidate') as candidate_name,
            COALESCE(u.email, 'candidate@smarthire.ai') as candidate_email,
            s.job_role,
            s.domain,
            s.interview_type,
            s.difficulty,
            s.experience_level,
            s.status,
            s.total_questions,
            s.completed_questions,
            COALESCE(r.completion_percentage, 
                CASE WHEN s.total_questions > 0 THEN (s.completed_questions::numeric / s.total_questions::numeric * 100) ELSE 0 END
            ) as completion_percentage,
            COALESCE(r.total_duration, s.duration, 0) as duration,
            COALESCE(r.overall_score, s.score, 0) as overall_score,
            COALESCE(r.recommendation, 'Under Review') as recommendation,
            COALESCE(r.completed_at, s.ended_at) as completed_at,
            s.created_at
        FROM interview_sessions s
        LEFT JOIN users u ON u.id = COALESCE(s.candidate_id, s.user_id)
        LEFT JOIN interview_results r ON r.session_id = s.id
        WHERE 1=1
    """
    args = []

    if not is_admin:
        args.append(user_id)
        query += f" AND (s.created_by = ${len(args)} OR s.user_id = ${len(args)})"

    if status_filter and status_filter.strip().lower() not in ("all", "all_statuses"):
        args.append(status_filter.strip().lower())
        query += f" AND LOWER(s.status) = ${len(args)}"

    if domain and domain.strip().lower() not in ("all", "all domains", "all_domains", ""):
        dom_val = domain.strip().lower()
        args.append(f"%{dom_val}%")
        query += f" AND (LOWER(s.domain) LIKE ${len(args)} OR LOWER(s.job_role) LIKE ${len(args)} OR LOWER(s.user_skills) LIKE ${len(args)})"

    if interview_type and interview_type.strip().lower() not in ("all", "all interview types", "all_types", ""):
        itype_val = interview_type.strip().lower()
        args.append(f"%{itype_val}%")
        query += f" AND LOWER(s.interview_type) LIKE ${len(args)}"

    if job_role and job_role.strip().lower() not in ("all", "all roles", "all_roles", ""):
        args.append(f"%{job_role.strip().lower()}%")
        query += f" AND LOWER(s.job_role) LIKE ${len(args)}"

    if search and search.strip():
        args.append(f"%{search.strip().lower()}%")
        query += f" AND (LOWER(u.name) LIKE ${len(args)} OR LOWER(u.email) LIKE ${len(args)} OR LOWER(s.job_role) LIKE ${len(args)} OR LOWER(s.domain) LIKE ${len(args)})"

    # Sorting
    valid_sorts = {
        "completed_at": "completed_at",
        "score": "overall_score",
        "duration": "duration",
        "candidate_name": "candidate_name",
        "created_at": "s.created_at",
    }
    sort_column = valid_sorts.get(sort_by, "completed_at")
    order = "ASC" if sort_order and sort_order.lower() == "asc" else "DESC"
    query += f" ORDER BY {sort_column} {order} NULLS LAST, s.created_at DESC"

    rows = await db.fetch(query, *args)
    
    result = []
    seen_sessions = set()
    for r in rows:
        d = dict(r)
        d["id"] = r["session_id"]
        d["overall_score"] = float(r["overall_score"]) if r["overall_score"] is not None else 0.0
        d["completion_percentage"] = float(r["completion_percentage"]) if r["completion_percentage"] is not None else 0.0

        sess_id = str(d.get("session_id") or d.get("id"))
        if sess_id in seen_sessions:
            continue
        seen_sessions.add(sess_id)

        result.append(d)
    return result


@router.get("/recruiter/interviews/{session_id}/details")
@router.get("/recruiter/interviews/{session_id}/report")
@router.get("/api/recruiter/interviews/{session_id}/report")
async def get_recruiter_interview_details(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns full detailed report of a completed interview session for recruiter view.
    Includes Candidate profile, Session metadata, Result summary, Category scores, and Question analytics.
    """
    if current_user["role"] not in ("recruiter", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Recruiter access required."
        )

    user_id = current_user["id"]
    is_admin = current_user["role"] == "admin"

    # Recruiters and admins can inspect any interview session
    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)

    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    cand_id = session_row["candidate_id"] or session_row["user_id"]
    cand_user = await db.fetchrow("SELECT id, name, email, avatar_url, created_at FROM users WHERE id = $1", cand_id)

    res_row = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", session_id)
    comp_q = session_row.get("completed_questions", 0) or 0
    tot_q = session_row.get("total_questions", 0) or 0
    st_val = (session_row.get("status") or "").lower()

    if not res_row and (st_val == "completed" or (tot_q > 0 and comp_q >= tot_q)):
        try:
            res_row = await run_finalize_interview_pipeline(session_id, db)
            session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
        except Exception as e:
            print(f"[SmartHire] Warning auto-finalizing session {session_id}: {e}")

    q_res_rows = await db.fetch("SELECT * FROM interview_question_results WHERE session_id = $1 ORDER BY question_number ASC", session_id)
    rec_row = await db.fetchrow("SELECT id FROM interview_recordings WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1", session_id)

    audio_rows = await db.fetch("SELECT question_id, id, duration, file_size, mime_type FROM interview_audio_answers WHERE session_id = $1", session_id)
    audio_map = {str(a["question_id"]): a for a in audio_rows}

    # Fallback to interview_questions if interview_question_results not populated yet
    if not q_res_rows:
        q_rows = await db.fetch("SELECT * FROM interview_questions WHERE session_id = $1 ORDER BY question_number ASC", session_id)
        try:
            timing_rows = await db.fetch("SELECT question_number, SUM(time_spent) as total_time FROM interview_question_timings WHERE session_id = $1 GROUP BY question_number", session_id)
            timings_map = {t["question_number"]: t["total_time"] for t in timing_rows if t.get("question_number")}
        except Exception as _t_err:
            print(f"[SmartHire] Warning fetching question timings: {_t_err}")
            timings_map = {}

        q_res_rows = []
        for q in q_rows:
            q_num = q["question_number"]
            u_ans = q["user_answer"]
            q_res_rows.append({
                "id": q["id"],
                "session_id": session_id,
                "result_id": res_row["id"] if res_row else None,
                "question_id": q["id"],
                "question_number": q_num,
                "question_text": q["question_text"],
                "answer_status": "Answered" if (u_ans and u_ans.strip()) else "Skipped",
                "time_spent": timings_map.get(q_num, 0),
                "answer_type": q["category"] or session_row["domain"],
                "user_answer": u_ans,
                "score": float(q["score"]) if q["score"] is not None else None,
                "evaluation": q["feedback"]
            })

    transcripts_rows = await db.fetch("SELECT question_id, question_number, transcript FROM interview_transcripts WHERE session_id = $1", session_id)
    transcripts_by_qid = {str(t["question_id"]): t["transcript"] for t in transcripts_rows if t.get("question_id")}
    transcripts_by_qnum = {t["question_number"]: t["transcript"] for t in transcripts_rows if t.get("question_number")}

    formatted_q_results = []
    for r in q_res_rows:
        item = dict(r)
        q_id_str = str(item.get("question_id") or item.get("id") or "")
        q_num = item.get("question_number")

        cand_transcript = item.get("user_answer") or transcripts_by_qid.get(q_id_str) or transcripts_by_qnum.get(q_num)
        item["user_answer"] = cand_transcript
        item["transcript"] = cand_transcript

        if q_id_str in audio_map:
            item["has_audio"] = True
            item["audio_id"] = str(audio_map[q_id_str]["id"])
            item["audio_duration"] = audio_map[q_id_str]["duration"]
        else:
            item["has_audio"] = False
            item["audio_id"] = None
            item["audio_duration"] = 0

        for s_field in ["score", "communication_score", "confidence_score", "technical_score", "professionalism_score", "overall_score"]:
            if item.get(s_field) is not None:
                try:
                    item[s_field] = float(item[s_field])
                except (ValueError, TypeError):
                    pass

        eval_val = item.get("evaluation")
        if isinstance(eval_val, str) and eval_val.strip().startswith("{"):
            try:
                parsed_eval = json.loads(eval_val)
                if isinstance(parsed_eval, dict):
                    item["evaluation"] = parsed_eval.get("feedback") or parsed_eval.get("evaluation") or eval_val
            except Exception:
                pass

        formatted_q_results.append(item)

    comm_rows = await db.fetch("SELECT * FROM communication_analysis WHERE session_id = $1 ORDER BY created_at ASC", session_id)
    if not comm_rows and formatted_q_results:
        # Auto-generate communication analysis for answered questions if missing
        for q_item in formatted_q_results:
            u_text = q_item.get("transcript") or q_item.get("user_answer") or ""
            q_dur = q_item.get("time_spent", 0) or q_item.get("audio_duration", 0) or 0
            q_id_val = q_item.get("question_id") or q_item.get("id")
            if u_text and u_text.strip() and q_id_val:
                try:
                    c_info = CommunicationService.analyze_communication_quality(u_text, duration_seconds=q_dur)
                    await db.execute(
                        """
                        INSERT INTO communication_analysis (
                            session_id, question_id, grammar_score, grammar_error_count,
                            grammar_feedback, filler_word_count, filler_words_per_minute, filler_rate,
                            filler_words_list, words_per_minute, speaking_duration, word_count,
                            pace_category, pronunciation_score, pronunciation_status, pronunciation_feedback,
                            communication_score, feedback, strengths, weaknesses, created_at, updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20::jsonb, NOW(), NOW()
                        )
                        ON CONFLICT (session_id, question_id) DO UPDATE SET
                            grammar_score = EXCLUDED.grammar_score,
                            communication_score = EXCLUDED.communication_score,
                            words_per_minute = EXCLUDED.words_per_minute,
                            filler_word_count = EXCLUDED.filler_word_count,
                            updated_at = NOW()
                        """,
                        session_id, q_id_val,
                        c_info["grammar_score"], c_info["grammar_error_count"], c_info["grammar_feedback"],
                        c_info["filler_word_count"], c_info["filler_words_per_minute"], c_info["filler_rate"],
                        json.dumps(c_info["filler_words_list"]), c_info["words_per_minute"], c_info["speaking_duration"],
                        c_info["word_count"], c_info["pace_category"], c_info["pronunciation_score"],
                        c_info["pronunciation_status"], c_info["pronunciation_feedback"], c_info["communication_score"],
                        c_info["feedback"], json.dumps(c_info["strengths"]), json.dumps(c_info["weaknesses"])
                    )
                except Exception as _ca_err:
                    print(f"[SmartHire] Error auto-generating communication_analysis: {_ca_err}")
        comm_rows = await db.fetch("SELECT * FROM communication_analysis WHERE session_id = $1 ORDER BY created_at ASC", session_id)
    beh_row = await db.fetchrow("SELECT * FROM interview_behavior_analysis WHERE session_id = $1", session_id)

    formatted_comm = []
    for c in comm_rows:
        cd = dict(c)
        if isinstance(cd.get("filler_words_list"), str):
            cd["filler_words_list"] = json.loads(cd["filler_words_list"])
        if isinstance(cd.get("strengths"), str):
            cd["strengths"] = json.loads(cd["strengths"])
        if isinstance(cd.get("weaknesses"), str):
            cd["weaknesses"] = json.loads(cd["weaknesses"])
        formatted_comm.append(cd)

    beh_dict = dict(beh_row) if beh_row else None
    if beh_dict and isinstance(beh_dict.get("behavior_events"), str):
        beh_dict["behavior_events"] = json.loads(beh_dict["behavior_events"])

    proctoring_data = await ProctoringService.get_summary_and_timeline(db, session_id)

    # Fetch emotion frame events from database (try interview_emotion_analysis first, then emotion_analysis_events, fallback to emotion_analysis_results)
    iea_rows = await db.fetch("SELECT * FROM interview_emotion_analysis WHERE session_id = $1 ORDER BY timestamp ASC", session_id)
    if iea_rows:
        event_rows = []
        for r in iea_rows:
            probs = {
                "angry": float(r["angry_probability"] or 0.0),
                "disgust": float(r["disgust_probability"] or 0.0),
                "fear": float(r["fear_probability"] or 0.0),
                "happy": float(r["happy_probability"] or 0.0),
                "neutral": float(r["neutral_probability"] or 0.0),
                "sad": float(r["sad_probability"] or 0.0),
                "surprise": float(r["surprise_probability"] or 0.0),
            }
            event_rows.append({
                "id": r["id"],
                "session_id": r["session_id"],
                "captured_at": r["timestamp"],
                "face_detected": r["face_detected"],
                "face_event": "face_detected" if r["face_detected"] else ("no_face_detected" if r["face_count"] == 0 else "multiple_faces_detected"),
                "detected_emotion": r["emotion"],
                "confidence_score": r["confidence"],
                "probabilities": probs,
                "model_version": r["model_version"]
            })
    else:
        event_rows = await db.fetch("SELECT * FROM emotion_analysis_events WHERE session_id = $1 ORDER BY captured_at ASC", session_id)
        if not event_rows:
            fallback_rows = await db.fetch("SELECT * FROM emotion_analysis_results WHERE session_id = $1 ORDER BY timestamp ASC", session_id)
            if fallback_rows:
                event_rows = []
                for fr in fallback_rows:
                    event_rows.append({
                        "id": fr["id"],
                        "session_id": fr["session_id"],
                        "question_id": fr["question_id"],
                        "captured_at": fr["timestamp"],
                        "face_detected": fr["face_detected"],
                        "face_event": "face_detected" if fr["face_detected"] else "no_face_detected",
                        "detected_emotion": fr["dominant_emotion"] if fr["dominant_emotion"] != "no_face" else None,
                        "confidence_score": fr["model_confidence"] if fr["face_detected"] else 0.0,
                        "probabilities": fr["emotion_scores"],
                        "model_version": fr["model_version"]
                    })

    model_status = EmotionService.get_status()
    model_version_val = event_rows[-1].get("model_version", "1.0.0") if event_rows else (model_status.get("model_version") or "1.0.0")
    model_name_val = "SmartHire-EmotionNet-EmotionCNN"

    if not event_rows:
        emotion_detection = EmotionService.generate_fallback_emotion_detection(str(session_id))
        emotion_data = EmotionService.generate_fallback_emotion_result(str(session_id))
    else:
        timeline = []
        emotion_counts = {}
        valid_face_count = 0
        no_face_count = 0
        multiple_face_count = 0
        total_conf = 0.0

        for r in event_rows:
            probs = r.get("probabilities")
            if isinstance(probs, str):
                try:
                    probs = json.loads(probs)
                except Exception:
                    probs = {}
            elif not probs:
                probs = {}

            face_det = bool(r.get("face_detected"))
            face_ev = r.get("face_event") or ("face_detected" if face_det else "no_face_detected")
            dom_emo = r.get("detected_emotion")
            conf = float(r.get("confidence_score") or 0.0) if r.get("confidence_score") is not None else 0.0

            if face_det and dom_emo and str(dom_emo).lower() not in ("no_face", "none", "unknown"):
                valid_face_count += 1
                emotion_counts[dom_emo] = emotion_counts.get(dom_emo, 0) + 1
                total_conf += conf
            elif face_ev == "multiple_faces_detected":
                multiple_face_count += 1
            else:
                no_face_count += 1

            captured_ts = r.get("captured_at") or r.get("created_at") or r.get("timestamp")
            ts_str = captured_ts.isoformat() if captured_ts and hasattr(captured_ts, 'isoformat') else str(captured_ts or "")

            timeline.append({
                "timestamp": ts_str,
                "question_id": str(r["question_id"]) if r.get("question_id") else None,
                "face_detected": face_det,
                "face_event": face_ev,
                "dominant_emotion": dom_emo if face_det else None,
                "emotion_scores": probs,
                "confidence": round(conf, 4) if conf else 0.0
            })

        if valid_face_count == 0:
            emotion_detection = EmotionService.generate_fallback_emotion_detection(str(session_id))
            emotion_data = EmotionService.generate_fallback_emotion_result(str(session_id))
        else:
            most_dominant = max(emotion_counts, key=emotion_counts.get)
            avg_conf = round(total_conf / valid_face_count, 4)

            distribution_list = []
            for emo, count in sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True):
                distribution_list.append({
                    "emotion": emo.title(),
                    "count": count,
                    "percentage": round((count / valid_face_count) * 100, 1)
                })

            emotion_detection = {
                "available": True,
                "data_source": "model",
                "dominant_emotion": most_dominant.title(),
                "distribution": distribution_list,
                "samples_analyzed": len(event_rows),
                "valid_face_samples": valid_face_count,
                "no_face_samples": no_face_count,
                "multiple_face_samples": multiple_face_count,
                "average_confidence": avg_conf,
                "timeline": timeline,
                "model_name": model_name_val,
                "model_version": model_version_val
            }
            emotion_data = {
                "status": "completed",
                "data_source": "model",
                "dominant_emotion": most_dominant.title(),
                "emotion_timeline": timeline,
                "class_distribution": emotion_counts,
                "model_confidence": avg_conf,
                "total_frames_analyzed": len(event_rows),
                "valid_face_frames": valid_face_count,
                "no_face_frames": no_face_count,
                "multiple_face_events": multiple_face_count,
                "model_version": model_version_val
            }


    formatted_result = None
    if res_row:
        formatted_result = dict(res_row)
        for fld in ["strengths", "weaknesses", "improvement_suggestions", "practice_recommendations", "learning_resources"]:
            val = formatted_result.get(fld)
            if not val:
                formatted_result[fld] = []
            elif isinstance(val, str):
                try:
                    parsed = json.loads(val)
                    formatted_result[fld] = parsed if isinstance(parsed, list) else [parsed]
                except Exception:
                    formatted_result[fld] = [val]
    category_scores = {
        "communication": float(res_row["communication_score"]) if res_row and res_row.get("communication_score") is not None else None,
        "confidence": float(res_row["confidence_score"]) if res_row and res_row.get("confidence_score") is not None else None,
        "technical_relevance": float(res_row["technical_relevance_score"]) if res_row and res_row.get("technical_relevance_score") is not None else (float(res_row["technical_score"]) if res_row and res_row.get("technical_score") is not None else None),
        "professionalism": float(res_row["professionalism_score"]) if res_row and res_row.get("professionalism_score") is not None else None,
    }

    fb_gen_at = res_row.get("feedback_generated_at") if res_row else None
    feedback_payload = {
        "status": res_row.get("feedback_status", "unavailable") if res_row else "unavailable",
        "ai_provider": res_row.get("ai_provider") if res_row else None,
        "ai_model": res_row.get("ai_model") if res_row else None,
        "feedback_generated_at": fb_gen_at.isoformat() if fb_gen_at else None,
        "strengths": formatted_result.get("strengths", []) if formatted_result else [],
        "weaknesses": formatted_result.get("weaknesses", []) if formatted_result else [],
        "improvement_suggestions": formatted_result.get("improvement_suggestions", []) if formatted_result else [],
        "practice_recommendations": formatted_result.get("practice_recommendations", []) if formatted_result else [],
        "learning_resources": formatted_result.get("learning_resources", []) if formatted_result else []
    }

    speech_summary = None
    if comm_rows:
        wpm_list = [float(c["words_per_minute"]) for c in comm_rows if c.get("words_per_minute") is not None]
        filler_counts = [int(c["filler_word_count"]) for c in comm_rows if c.get("filler_word_count") is not None]
        grammar_scores = [float(c["grammar_score"]) for c in comm_rows if c.get("grammar_score") is not None]
        pronun_scores = [float(c["pronunciation_score"]) for c in comm_rows if c.get("pronunciation_score") is not None]
        durations = [float(c["speaking_duration"]) for c in comm_rows if c.get("speaking_duration") is not None]

        speech_summary = {
            "status": "available",
            "average_wpm": round(sum(wpm_list) / len(wpm_list), 1) if wpm_list else None,
            "total_filler_words": sum(filler_counts) if filler_counts else 0,
            "average_grammar_score": round(sum(grammar_scores) / len(grammar_scores), 1) if grammar_scores else None,
            "average_pronunciation_score": round(sum(pronun_scores) / len(pronun_scores), 1) if pronun_scores else None,
            "total_speaking_duration": round(sum(durations), 1) if durations else 0,
            "pace_category": comm_rows[0].get("pace_category") if comm_rows and comm_rows[0].get("pace_category") else "Normal",
            "total_analyzed_answers": len(comm_rows)
        }
    else:
        speech_summary = {
            "status": "unavailable",
            "reason": "No speech analysis data collected for this session",
            "average_wpm": None,
            "total_filler_words": None,
            "average_grammar_score": None,
            "average_pronunciation_score": None,
            "total_speaking_duration": None,
            "pace_category": None,
            "total_analyzed_answers": 0
        }

    return {
        "candidate": dict(cand_user) if cand_user else {"id": str(cand_id), "name": "Candidate", "email": "candidate@smarthire.ai"},
        "session": dict(session_row),
        "result": formatted_result,
        "category_scores": category_scores,
        "feedback": feedback_payload,
        "question_results": formatted_q_results,
        "communication_analysis": formatted_comm,
        "speech_analysis_summary": speech_summary,
        "behavior_analysis": beh_dict,
        "emotion_analysis": emotion_data,
        "emotion_detection": emotion_detection,
        "proctoring_summary": proctoring_data["summary"],
        "integrity_events": proctoring_data["timeline"],
        "has_recording": rec_row is not None,
        "recording_id": rec_row["id"] if rec_row else None,
    }


@router.post("/recruiter/interviews/{session_id}/regenerate-feedback")
@router.post("/api/recruiter/interviews/{session_id}/regenerate-feedback")
@router.post("/recruiter/interviews/{session_id}/generate-feedback")
@router.post("/api/recruiter/interviews/{session_id}/generate-feedback")
async def regenerate_session_feedback_endpoint(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Controlled endpoint to generate or regenerate grounded AI feedback for a session.
    Persists feedback to PostgreSQL and returns the updated recruiter report details.
    """
    if current_user["role"] not in ("recruiter", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Recruiter access required."
        )

    # Force re-finalization of feedback
    await run_finalize_interview_pipeline(session_id, db)
    return await get_recruiter_interview_details(session_id, current_user, db)


# ── 8b. POST /api/sessions/{id}/recording ────────────────────
@router.post("/sessions/{session_id}/recording", response_model=RecordingResponse)
@router.post("/sessions/{session_id}/recordings", response_model=RecordingResponse)
@router.post("/interviews/sessions/{session_id}/recording", response_model=RecordingResponse)
@router.post("/interviews/sessions/{session_id}/recordings", response_model=RecordingResponse)
@router.post("/interview-sessions/{session_id}/recording", response_model=RecordingResponse)
@router.post("/interview-sessions/{session_id}/recordings", response_model=RecordingResponse)
async def upload_recording(
    session_id: UUID,
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Uploads recorded candidate interview video+audio.
    Associates file with session, candidate, and created timestamp.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    if role in ("recruiter", "admin"):
        session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    else:
        session_row = await db.fetchrow(
            "SELECT * FROM interview_sessions WHERE id = $1 AND (user_id = $2 OR candidate_id = $2 OR created_by = $2)",
            session_id,
            user_id,
        )

    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    contents = await file.read()
    file_size = len(contents)
    if file_size == 0:
        logger.warning(f"[SmartHire Video Upload] Rejected zero-byte recording upload for session: {session_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot upload empty (0-byte) recording file.",
        )

    mime_type = file.content_type or "video/webm"
    ext = ".mp4" if "mp4" in mime_type.lower() else ".webm"
    filename = f"{session_id}_{uuid.uuid4().hex[:8]}{ext}"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    candidate_id = session_row["candidate_id"] or session_row["user_id"]
    duration_val = session_row.get("duration", 0) or 0

    rec_row = await db.fetchrow(
        """
        INSERT INTO interview_recordings (
            session_id, candidate_id, interview_id, recording_type,
            storage_location, mime_type, file_size, duration, created_at
        ) VALUES ($1, $2, $1, 'video_audio', $3, $4, $5, $6, NOW())
        RETURNING *
        """,
        session_id,
        candidate_id,
        file_path,
        mime_type,
        file_size,
        duration_val,
    )

    logger.info(
        f"[SmartHire Video Upload] Success! Recording stored for session '{session_id}': "
        f"rec_id='{rec_row['id']}', size={file_size} bytes, mime='{mime_type}', path='{file_path}'"
    )

    try:
        from app.routers.analysis import process_and_store_video_emotions
        await process_and_store_video_emotions(session_id, file_path, db)
    except Exception as _vid_err:
        logger.warning(f"[SmartHire] Warning processing video emotions on upload: {_vid_err}")

    return RecordingResponse(
        id=rec_row["id"],
        session_id=rec_row["session_id"],
        candidate_id=rec_row["candidate_id"],
        interview_id=rec_row["interview_id"],
        recording_type=rec_row["recording_type"],
        mime_type=rec_row["mime_type"],
        file_size=rec_row["file_size"],
        duration=rec_row["duration"],
        created_at=rec_row["created_at"],
    )


def create_ranged_media_response(file_path: str, mime_type: str, range_header: str | None = None) -> Response:
    """
    Returns HTTP 206 Partial Content or HTTP 200 FileResponse to support cross-browser HTML video/audio element streaming.
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Media file not found.")

    file_size = os.path.getsize(file_path)
    if not range_header or not range_header.startswith("bytes="):
        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=os.path.basename(file_path),
            headers={"Accept-Ranges": "bytes"}
        )

    try:
        range_val = range_header.replace("bytes=", "").strip()
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        end = min(end, file_size - 1)
        if start > end or start >= file_size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        chunk_size = end - start + 1

        def _iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                bytes_left = chunk_size
                while bytes_left > 0:
                    read_size = min(64 * 1024, bytes_left)
                    data = f.read(read_size)
                    if not data:
                        break
                    bytes_left -= len(data)
                    yield data

        return StreamingResponse(
            _iter_file(),
            status_code=206,
            media_type=mime_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
            }
        )
    except Exception:
        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=os.path.basename(file_path),
            headers={"Accept-Ranges": "bytes"}
        )


# ── 8c. GET /api/sessions/{id}/recording ─────────────────────
@router.get("/sessions/{session_id}/recording")
@router.get("/sessions/{session_id}/recordings")
@router.get("/sessions/{session_id}/recordings/{recording_id}")
@router.get("/interviews/sessions/{session_id}/recording")
@router.get("/interviews/sessions/{session_id}/recordings")
@router.get("/interviews/sessions/{session_id}/recordings/{recording_id}")
@router.get("/interview-sessions/{session_id}/recording")
@router.get("/interview-sessions/{session_id}/recordings")
@router.get("/interview-sessions/{session_id}/recordings/{recording_id}")
async def get_recording(
    session_id: UUID,
    recording_id: Optional[UUID] = None,
    current_user: CurrentUser = None,
    range_header: Optional[str] = Header(None, alias="Range"),
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Downloads / Streams interview recording.
    Requires role-based authorization: candidate (own recording), recruiter (assigned/managed candidate), admin.
    Returns HTTP 403 Forbidden for unauthorized access.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    is_candidate_owner = str(session_row["user_id"]) == str(user_id) or str(session_row["candidate_id"]) == str(user_id)
    is_creator = str(session_row["created_by"]) == str(user_id) if session_row["created_by"] else False
    is_admin = role == "admin"
    is_recruiter = role == "recruiter"

    if not (is_candidate_owner or is_creator or is_recruiter or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Access denied. You are not authorized to view this interview recording.",
        )

    if recording_id:
        rec_row = await db.fetchrow(
            "SELECT * FROM interview_recordings WHERE id = $1 AND session_id = $2",
            recording_id,
            session_id,
        )
    else:
        rec_row = await db.fetchrow(
            "SELECT * FROM interview_recordings WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1",
            session_id,
        )

    if not rec_row:
        raise HTTPException(status_code=404, detail="No recording found for this session.")

    file_path = rec_row["storage_location"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Recording file not found on storage server.")

    return create_ranged_media_response(file_path, rec_row["mime_type"], range_header)


# ── 8d. POST /api/sessions/{id}/answers/audio ───────────────
@router.post("/sessions/{session_id}/answers/audio", response_model=AudioAnswerResponse)
@router.post("/interviews/sessions/{session_id}/answers/audio", response_model=AudioAnswerResponse)
@router.post("/interview-sessions/{session_id}/answers/audio", response_model=AudioAnswerResponse)
async def upload_audio_answer(
    session_id: UUID,
    audio_file: UploadFile = File(...),
    question_id: UUID = Form(...),
    question_number: int = Form(...),
    duration: int = Form(0),
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Accepts multipart form data (audio_file, question_id, question_number, duration).
    Validates candidate authentication and session ownership, then saves audio file in uploads/audio_answers/.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    if role in ("recruiter", "admin"):
        session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    else:
        session_row = await db.fetchrow(
            "SELECT * FROM interview_sessions WHERE id = $1 AND (user_id = $2 OR candidate_id = $2 OR created_by = $2)",
            session_id,
            user_id,
        )

    if not session_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

    contents = await audio_file.read()
    file_size = len(contents)
    mime_type = audio_file.content_type or "audio/webm"

    ext = ".mp4" if "mp4" in mime_type.lower() else (".wav" if "wav" in mime_type.lower() else ".webm")
    filename = f"audio_{session_id}_{question_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(AUDIO_UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    candidate_id = session_row["candidate_id"] or session_row["user_id"]

    ans_row = await db.fetchrow(
        """
        INSERT INTO interview_audio_answers (
            session_id, candidate_id, question_id, question_number,
            storage_location, mime_type, file_size, duration, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (session_id, question_id) DO UPDATE SET
            storage_location = EXCLUDED.storage_location,
            mime_type = EXCLUDED.mime_type,
            file_size = EXCLUDED.file_size,
            duration = EXCLUDED.duration,
            question_number = EXCLUDED.question_number,
            updated_at = NOW()
        RETURNING *
        """,
        session_id,
        candidate_id,
        question_id,
        question_number,
        file_path,
        mime_type,
        file_size,
        duration,
    )

    return dict(ans_row)


# ── 8e. GET /api/sessions/{id}/answers/audio/{question_id} ─
@router.get("/sessions/{session_id}/answers/audio/{question_id}")
@router.get("/interviews/sessions/{session_id}/answers/audio/{question_id}")
@router.get("/interview-sessions/{session_id}/answers/audio/{question_id}")
@router.get("/interview-sessions/{session_id}/questions/{question_id}/audio")
@router.get("/sessions/{session_id}/questions/{question_id}/audio")
async def get_audio_answer(
    session_id: UUID,
    question_id: UUID,
    current_user: CurrentUser = None,
    range_header: Optional[str] = Header(None, alias="Range"),
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Protected audio streaming endpoint enforcing role-based authorization (Candidate owner, assigned Recruiter, Admin).
    Returns HTTP 403 Forbidden for unauthorized requests.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

    is_candidate_owner = str(session_row["user_id"]) == str(user_id) or str(session_row["candidate_id"]) == str(user_id)
    is_creator = str(session_row["created_by"]) == str(user_id) if session_row.get("created_by") else False
    is_admin = role == "admin"
    is_recruiter = role == "recruiter"

    if not (is_candidate_owner or is_creator or is_recruiter or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="403 Forbidden: Access denied. You are not authorized to access this audio answer.",
        )

    ans_row = await db.fetchrow(
        "SELECT * FROM interview_audio_answers WHERE session_id = $1 AND question_id = $2",
        session_id,
        question_id,
    )

    if not ans_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio answer not found for this question.")

    file_path = ans_row["storage_location"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio answer file not found on storage server.")

    return create_ranged_media_response(file_path, ans_row["mime_type"], range_header)


# ── 8f. POST /api/sessions/{id}/transcript ─────────────────
@router.post("/sessions/{session_id}/transcript", response_model=TranscriptResponse)
@router.post("/interviews/sessions/{session_id}/transcript", response_model=TranscriptResponse)
@router.post("/interview-sessions/{session_id}/transcript", response_model=TranscriptResponse)
async def submit_transcript(
    session_id: UUID,
    req: SubmitTranscriptRequest,
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Saves or updates real-time speech-to-text transcript associated with session, candidate, and question.
    """
    user_id = current_user["id"]
    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    candidate_id = session_row["candidate_id"] or session_row["user_id"]
    w_count = req.word_count if req.word_count > 0 else len(re.findall(r"\b[\w']+\b", req.transcript or ""))

    tr_row = await db.fetchrow(
        """
        INSERT INTO interview_transcripts (
            session_id, question_id, candidate_id, question_number, transcript, duration, word_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (session_id, question_id) DO UPDATE SET
            transcript = EXCLUDED.transcript,
            duration = EXCLUDED.duration,
            word_count = EXCLUDED.word_count,
            updated_at = NOW()
        RETURNING *
        """,
        session_id,
        req.question_id,
        candidate_id,
        req.question_number,
        req.transcript,
        req.duration,
        w_count,
    )
    return dict(tr_row)


# ── 8g. POST /api/sessions/{id}/communication-analysis ──────
@router.post("/sessions/{session_id}/communication-analysis", response_model=CommunicationAnalysisResponse)
@router.post("/interviews/sessions/{session_id}/communication-analysis", response_model=CommunicationAnalysisResponse)
@router.post("/interview-sessions/{session_id}/communication-analysis", response_model=CommunicationAnalysisResponse)
async def analyze_communication(
    session_id: UUID,
    req: SubmitCommunicationAnalysisRequest,
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Performs speech pace, filler word, grammar, and communication quality analysis on candidate transcript.
    """
    user_id = current_user["id"]
    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    candidate_id = session_row["candidate_id"] or session_row["user_id"]
    w_count = len(re.findall(r"\b[\w']+\b", req.transcript or ""))

    # Fallback to audio answer duration if req.duration is <= 0
    effective_duration = req.duration
    if effective_duration <= 0:
        audio_row = await db.fetchrow(
            "SELECT duration FROM interview_audio_answers WHERE session_id = $1 AND question_id = $2",
            session_id, req.question_id
        )
        if audio_row and audio_row["duration"] and audio_row["duration"] > 0:
            effective_duration = audio_row["duration"]

    # 1. Upsert transcript
    tr_row = await db.fetchrow(
        """
        INSERT INTO interview_transcripts (
            session_id, question_id, candidate_id, question_number, transcript, duration, word_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (session_id, question_id) DO UPDATE SET
            transcript = EXCLUDED.transcript,
            duration = EXCLUDED.duration,
            word_count = EXCLUDED.word_count,
            updated_at = NOW()
        RETURNING *
        """,
        session_id, req.question_id, candidate_id, req.question_number, req.transcript, effective_duration, w_count
    )

    # 2. Analyze communication metrics
    comm_res = CommunicationService.analyze_communication_quality(
        text=req.transcript,
        duration_seconds=effective_duration,
        confidence_score=req.confidence_score
    )

    logger.info(
        f"[SmartHire] Communication analysis calculated for candidate {candidate_id}, session {session_id}, question {req.question_id}: "
        f"words={w_count}, duration={effective_duration}s, WPM={comm_res['words_per_minute']}, "
        f"fillers={comm_res['filler_word_count']} ({comm_res['filler_rate']}%), grammar={comm_res['grammar_score']}, "
        f"comm_score={comm_res['communication_score']}"
    )

    # 3. Upsert communication_analysis
    ca_row = await db.fetchrow(
        """
        INSERT INTO communication_analysis (
            session_id, question_id, transcript_id, grammar_score, grammar_error_count,
            grammar_feedback, filler_word_count, filler_words_per_minute, filler_rate,
            filler_words_list, words_per_minute, speaking_duration, word_count,
            pace_category, pronunciation_score, pronunciation_status, pronunciation_feedback,
            communication_score, feedback, strengths, weaknesses, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, NOW(), NOW()
        )
        ON CONFLICT (session_id, question_id) DO UPDATE SET
            transcript_id = EXCLUDED.transcript_id,
            grammar_score = EXCLUDED.grammar_score,
            grammar_error_count = EXCLUDED.grammar_error_count,
            grammar_feedback = EXCLUDED.grammar_feedback,
            filler_word_count = EXCLUDED.filler_word_count,
            filler_words_per_minute = EXCLUDED.filler_words_per_minute,
            filler_rate = EXCLUDED.filler_rate,
            filler_words_list = EXCLUDED.filler_words_list,
            words_per_minute = EXCLUDED.words_per_minute,
            speaking_duration = EXCLUDED.speaking_duration,
            word_count = EXCLUDED.word_count,
            pace_category = EXCLUDED.pace_category,
            pronunciation_score = EXCLUDED.pronunciation_score,
            pronunciation_status = EXCLUDED.pronunciation_status,
            pronunciation_feedback = EXCLUDED.pronunciation_feedback,
            communication_score = EXCLUDED.communication_score,
            feedback = EXCLUDED.feedback,
            strengths = EXCLUDED.strengths,
            weaknesses = EXCLUDED.weaknesses,
            updated_at = NOW()
        RETURNING *
        """,
        session_id, req.question_id, tr_row["id"],
        comm_res["grammar_score"], comm_res["grammar_error_count"], comm_res["grammar_feedback"],
        comm_res["filler_word_count"], comm_res["filler_words_per_minute"], comm_res["filler_rate"],
        json.dumps(comm_res["filler_words_list"]), comm_res["words_per_minute"], comm_res["speaking_duration"],
        comm_res["word_count"], comm_res["pace_category"], comm_res["pronunciation_score"],
        comm_res["pronunciation_status"], comm_res["pronunciation_feedback"], comm_res["communication_score"],
        comm_res["feedback"], json.dumps(comm_res["strengths"]), json.dumps(comm_res["weaknesses"])
    )

    res = dict(ca_row)
    if isinstance(res.get("filler_words_list"), str):
        res["filler_words_list"] = json.loads(res["filler_words_list"])
    if isinstance(res.get("strengths"), str):
        res["strengths"] = json.loads(res["strengths"])
    if isinstance(res.get("weaknesses"), str):
        res["weaknesses"] = json.loads(res["weaknesses"])

    res["candidate_id"] = candidate_id
    res["speech_pace"] = comm_res.get("speech_pace")
    res["filler_words"] = comm_res.get("filler_words")
    res["grammar"] = comm_res.get("grammar")
    res["overall_communication_quality"] = comm_res.get("overall_communication_quality")

    return res


# ── 8h. POST /api/sessions/{id}/behavior-analysis ───────────
@router.post("/sessions/{session_id}/behavior-analysis", response_model=BehaviorAnalysisResponse)
@router.post("/interviews/sessions/{session_id}/behavior-analysis", response_model=BehaviorAnalysisResponse)
@router.post("/interview-sessions/{session_id}/behavior-analysis", response_model=BehaviorAnalysisResponse)
async def analyze_behavior(
    session_id: UUID,
    req: SubmitBehaviorAnalysisRequest,
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Saves candidate eye contact %, attention breaks, observed facial/behavioral indicators, and timestamped events.
    """
    user_id = current_user["id"]
    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    candidate_id = session_row["candidate_id"] or session_row["user_id"]

    # Fetch stored emotion events for session to pass to BehaviorAnalysisService
    emo_rows = await db.fetch("SELECT * FROM emotion_analysis_results WHERE session_id = $1", session_id)
    emo_events = [dict(r) for r in emo_rows]

    # Fetch communication analysis summary
    comm_row = await db.fetchrow("SELECT * FROM communication_analysis WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1", session_id)
    comm_data = dict(comm_row) if comm_row else None

    beh_eval = BehaviorAnalysisService.calculate_behavioral_metrics(
        eye_contact_ratio=req.eye_contact_percentage,
        looking_away_duration=req.looking_away_duration,
        attention_break_count=req.attention_breaks,
        face_visible_ratio=100.0 if req.eye_contact_status == "Available" else 50.0,
        emotion_events=emo_events,
        communication_data=comm_data
    )

    summary_msg = req.engagement_summary or f"Engagement Score: {beh_eval['engagement_score']}%. Eye Contact: {beh_eval['eye_contact_percentage']}%. Status: {req.eye_contact_status}."

    beh_row = await db.fetchrow(
        """
        INSERT INTO interview_behavior_analysis (
            session_id, candidate_id, eye_contact_percentage, looking_away_duration,
            attention_breaks, eye_contact_status, observed_emotion, confidence_indicator,
            engagement_score, engagement_summary, behavior_score, behavior_events, feedback,
            face_visible_ratio, frustration_indicator, tension_indicator, reliability, evidence,
            created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18::jsonb, NOW(), NOW()
        )
        ON CONFLICT (session_id) DO UPDATE SET
            candidate_id = EXCLUDED.candidate_id,
            eye_contact_percentage = EXCLUDED.eye_contact_percentage,
            looking_away_duration = EXCLUDED.looking_away_duration,
            attention_breaks = EXCLUDED.attention_breaks,
            eye_contact_status = EXCLUDED.eye_contact_status,
            observed_emotion = EXCLUDED.observed_emotion,
            confidence_indicator = EXCLUDED.confidence_indicator,
            engagement_score = EXCLUDED.engagement_score,
            engagement_summary = EXCLUDED.engagement_summary,
            behavior_score = EXCLUDED.behavior_score,
            behavior_events = EXCLUDED.behavior_events,
            feedback = EXCLUDED.feedback,
            face_visible_ratio = EXCLUDED.face_visible_ratio,
            frustration_indicator = EXCLUDED.frustration_indicator,
            tension_indicator = EXCLUDED.tension_indicator,
            reliability = EXCLUDED.reliability,
            evidence = EXCLUDED.evidence,
            updated_at = NOW()
        RETURNING *
        """,
        session_id, candidate_id, beh_eval["eye_contact_percentage"], req.looking_away_duration,
        req.attention_breaks, req.eye_contact_status, beh_eval["observed_emotion"],
        beh_eval["confidence_indicator"], beh_eval["engagement_score"],
        summary_msg, beh_eval["behavior_score"], json.dumps(req.behavior_events or []),
        beh_eval.get("feedback", summary_msg),
        beh_eval["face_visible_ratio"], beh_eval["frustration_indicator"],
        beh_eval["tension_indicator"], beh_eval["reliability"], json.dumps(beh_eval["evidence"])
    )

    res = dict(beh_row)
    if isinstance(res.get("behavior_events"), str):
        res["behavior_events"] = json.loads(res["behavior_events"])
    if isinstance(res.get("evidence"), str):
        res["evidence"] = json.loads(res["evidence"])
    return res


# ── 8i. GET /api/sessions/{id}/analysis ──────────────────────
@router.get("/sessions/{session_id}/analysis")
@router.get("/interviews/sessions/{session_id}/analysis")
@router.get("/interview-sessions/{session_id}/analysis")
async def get_session_analysis(
    session_id: UUID,
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns full communication and behavioral analysis for candidate & recruiter dashboards.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    is_owner = str(session_row["user_id"]) == str(user_id) or str(session_row["candidate_id"]) == str(user_id)
    if role not in ("recruiter", "admin") and not is_owner:
        raise HTTPException(status_code=403, detail="403 Forbidden: Access denied.")

    tr_rows = await db.fetch("SELECT * FROM interview_transcripts WHERE session_id = $1 ORDER BY question_number ASC", session_id)
    comm_rows = await db.fetch("SELECT * FROM communication_analysis WHERE session_id = $1 ORDER BY created_at ASC", session_id)
    beh_row = await db.fetchrow("SELECT * FROM interview_behavior_analysis WHERE session_id = $1", session_id)

    formatted_comm = []
    for c in comm_rows:
        cd = dict(c)
        if isinstance(cd.get("filler_words_list"), str):
            cd["filler_words_list"] = json.loads(cd["filler_words_list"])
        if isinstance(cd.get("strengths"), str):
            cd["strengths"] = json.loads(cd["strengths"])
        if isinstance(cd.get("weaknesses"), str):
            cd["weaknesses"] = json.loads(cd["weaknesses"])
        formatted_comm.append(cd)

    beh_dict = dict(beh_row) if beh_row else None
    if beh_dict and isinstance(beh_dict.get("behavior_events"), str):
        beh_dict["behavior_events"] = json.loads(beh_dict["behavior_events"])

    return {
        "session_id": str(session_id),
        "transcripts": [dict(t) for t in tr_rows],
        "communication_analysis": formatted_comm,
        "behavior_analysis": beh_dict
    }


# ── 8j. GET /api/sessions/{id}/results ───────────────────────
@router.get("/sessions/{session_id}/results")
@router.get("/interviews/sessions/{session_id}/results")
@router.get("/interview-sessions/{session_id}/results")
async def get_session_results(
    session_id: UUID,
    current_user: CurrentUser = None,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns full interview results including scores, recommendation, strengths, weaknesses, and question breakdown.
    """
    user_id = current_user["id"]
    role = current_user["role"]

    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    is_owner = str(session_row["user_id"]) == str(user_id) or str(session_row["candidate_id"]) == str(user_id)
    if role not in ("recruiter", "admin") and not is_owner:
        raise HTTPException(status_code=403, detail="403 Forbidden: Access denied.")

    res_row = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", session_id)
    comp_q = session_row.get("completed_questions", 0) or 0
    tot_q = session_row.get("total_questions", 0) or 0
    st_val = (session_row.get("status") or "").lower()

    if not res_row and (st_val == "completed" or (tot_q > 0 and comp_q >= tot_q)):
        try:
            res_row = await run_finalize_interview_pipeline(session_id, db)
            session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
        except Exception as e:
            print(f"[SmartHire] Warning auto-finalizing session {session_id}: {e}")

    q_res_rows = await db.fetch("SELECT * FROM interview_question_results WHERE session_id = $1 ORDER BY question_number ASC", session_id)

    return {
        "session": dict(session_row),
        "result": dict(res_row) if res_row else None,
        "question_results": [dict(q) for q in q_res_rows]
    }


# ── 9. GET /api/history ──────────────────────────────────────
@router.get("/history", response_model=List[SessionResponse])
async def get_interview_history(
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Get full candidate interview history including questions and scores.
    """
    if current_user["role"] == "candidate":
        sessions = await db.fetch(
            """
            SELECT * FROM interview_sessions
            WHERE candidate_id = $1 OR user_id = $1
            ORDER BY created_at DESC
            """,
            current_user["id"],
        )
    else:
        sessions = await db.fetch(
            """
            SELECT * FROM interview_sessions
            WHERE created_by = $1 OR user_id = $1 OR candidate_id IS NOT NULL
            ORDER BY created_at DESC
            """,
            current_user["id"],
        )

    history = []
    for s in sessions:
        s_id = s["id"]
        q_rows = await db.fetch(
            "SELECT * FROM interview_questions WHERE session_id = $1 ORDER BY question_number ASC",
            s_id,
        )
        questions = []
        for q in q_rows:
            pts = q["expected_answer_points"]
            if isinstance(pts, str):
                pts = json.loads(pts)
            questions.append(
                QuestionResponse(
                    id=q["id"],
                    session_id=q["session_id"],
                    question_number=q["question_number"],
                    question_text=q["question_text"],
                    interview_type=q["interview_type"],
                    domain=q["domain"],
                    difficulty=q["difficulty"],
                    expected_answer_points=pts or [],
                    category=q["category"],
                    user_answer=q["user_answer"],
                    sample_answer=q["sample_answer"],
                    feedback=q["feedback"],
                    score=float(q["score"]) if q["score"] is not None else None,
                )
            )

        sd = dict(s)
        res_row = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", s_id)
        comp_q = sd.get("completed_questions", 0) or 0
        tot_q = sd.get("total_questions", 0) or 0
        st_val = (sd.get("status") or "").lower()

        if not res_row and (st_val == "completed" or (tot_q > 0 and comp_q >= tot_q)):
            try:
                res_row = await run_finalize_interview_pipeline(s_id, db)
            except Exception as e:
                print(f"[SmartHire] Warning auto-finalizing history session {s_id}: {e}")

        if res_row:
            sd["result"] = dict(res_row)
            if res_row.get("overall_score") is not None:
                sd["score"] = float(res_row["overall_score"])
        elif sd.get("score") is not None:
            sd["score"] = float(sd["score"])
        else:
            sd["score"] = None

        sd["questions"] = questions
        sd["report_download_url"] = f"/api/interviews/sessions/{s_id}/report/download" if (sd.get("status") or "").lower() == "completed" else None
        history.append(sd)

    return history


# ── 15. PROCTORING & INTEGRITY ROUTES ────────────────────────

@router.post("/interviews/{session_id}/proctoring/events")
@router.post("/sessions/{session_id}/proctoring/events")
async def record_proctoring_events(
    session_id: UUID,
    req: BatchIntegrityEventsRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Batch records proctoring & integrity events generated during interview execution.
    """
    session = await db.fetchrow("SELECT id FROM interview_sessions WHERE id = $1", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    raw_events = [e.model_dump() for e in req.events]
    saved_events = await ProctoringService.record_events(db, session_id, raw_events)
    summary = await ProctoringService.calculate_and_save_summary(db, session_id)

    try:
        cand_target = str(session.get("candidate_id") or session.get("user_id") or current_user["id"])
        has_warning = any(e.get("severity") in ("warning", "high", "critical") or e.get("status") == "warning" for e in raw_events)
        if has_warning:
            await NotificationService.create_proctoring_warning_alert(
                db, user_id=cand_target, session_id=str(session_id),
                event_name="Proctoring Warning", description="Integrity/Proctoring anomaly recorded during session"
            )
    except Exception as _pw_err:
        print(f"[SmartHire] Warning triggering proctoring alert: {_pw_err}")

    return {
        "success": True,
        "recorded_count": len(saved_events),
        "integrity_score": summary["integrity_score"],
        "final_status": summary["final_status"],
    }


@router.post("/interviews/{session_id}/proctoring/summary", response_model=ProctoringSummaryResponse)
@router.post("/sessions/{session_id}/proctoring/summary", response_model=ProctoringSummaryResponse)
async def submit_proctoring_summary(
    session_id: UUID,
    req: SubmitProctoringSummaryRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Calculates, updates and returns final proctoring summary when interview session finishes.
    """
    session = await db.fetchrow("SELECT id FROM interview_sessions WHERE id = $1", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    override_data = req.model_dump()
    summary = await ProctoringService.calculate_and_save_summary(db, session_id, override_data=override_data)
    return summary


@router.get("/interviews/{session_id}/proctoring")
@router.get("/sessions/{session_id}/proctoring")
async def get_proctoring_details(
    session_id: UUID,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Fetches proctoring summary and integrity event timeline for session.
    """
    session = await db.fetchrow("SELECT id FROM interview_sessions WHERE id = $1", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    data = await ProctoringService.get_summary_and_timeline(db, session_id)
    return data


# ── 16. CANDIDATE ANALYTICS & DOWNLOADABLE REPORTS ───────────────

@router.get("/candidate/performance-analytics")
@router.get("/candidate/analytics")
@router.get("/analytics/candidate")
async def get_candidate_analytics_endpoint(
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Returns candidate performance analytics isolated strictly to current_user["id"].
    """
    cand_id = str(current_user["id"])
    return await CandidateAnalyticsService.get_candidate_analytics(db, candidate_id=cand_id)


@router.get("/candidate/interviews/{session_id}/report.pdf")
@router.get("/candidate/interviews/{session_id}/report/download")
@router.get("/interviews/sessions/{session_id}/report.pdf")
@router.get("/interviews/sessions/{session_id}/report/download")
@router.get("/sessions/{session_id}/report.pdf")
@router.get("/sessions/{session_id}/report/download")
@router.get("/reports/{session_id}/download")
async def download_candidate_report(
    session_id: UUID,
    current_user: CurrentUser,
    format: Optional[str] = Query("pdf", description="Format: 'pdf' or 'json'"),
    db: asyncpg.Connection = Depends(get_db),
):

    """
    Generates and returns downloadable candidate performance PDF report.
    Candidates can download their OWN COMPLETED report. Recruiters/Admins can download authorized candidate reports.
    Strictly omits recruiter-only fields from the candidate report.
    """
    session_row = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session_row:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    cand_id = str(session_row["candidate_id"] or session_row["user_id"])
    user_id = str(current_user["id"])
    role = current_user["role"]

    # Security check 1: Candidate ownership
    if role == "candidate" and user_id != cand_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not authorized to access or download another candidate's report."
        )

    # Security check 2: Only COMPLETED sessions can generate report
    sess_status = (session_row.get("status") or "").lower()
    if sess_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report PDF generation is only allowed for COMPLETED interview sessions. Current status: '{session_row.get('status')}'."
        )

    # Fetch candidate info
    cand_user = await db.fetchrow("SELECT name, email FROM users WHERE id = $1", UUID(cand_id))
    cand_name = cand_user["name"] if (cand_user and cand_user.get("name")) else "Candidate"
    cand_email = cand_user["email"] if (cand_user and cand_user.get("email")) else ""

    res_row = await db.fetchrow("SELECT * FROM interview_results WHERE session_id = $1", session_id)
    if not res_row:
        try:
            res_row = await run_finalize_interview_pipeline(session_id, db)
        except Exception as e:
            logger.warning(f"Finalize pipeline failed for report PDF: {e}")
            res_row = None

    q_rows = await db.fetch("SELECT user_answer FROM interview_questions WHERE session_id = $1 ORDER BY question_number ASC", session_id)
    total_q = len(q_rows)
    answered_q = sum(1 for q in q_rows if q.get("user_answer") and str(q.get("user_answer")).strip() != "")

    # Sanitize candidate name for filename: e.g. SmartHire_Avanthika_Interview_Report.pdf
    first_name = cand_name.strip().split()[0] if cand_name else "Candidate"
    safe_name = "".join(c for c in first_name if c.isalnum() or c in ('_', '-')) or "Candidate"

    format_str = format.default if hasattr(format, "default") else format
    if not isinstance(format_str, str):
        format_str = "pdf"

    if format_str.lower() == "json":
        # Legacy JSON response format
        def _parse(val):
            if not val: return []
            if isinstance(val, list): return val
            try: return json.loads(val)
            except Exception: return []

        report_data = {
            "title": "SmartHire AI Candidate Performance Report",
            "candidate": {"name": cand_name, "email": cand_email, "id": cand_id},
            "session": {
                "session_id": str(session_id),
                "job_role": session_row["job_role"],
                "domain": session_row["domain"],
                "interview_type": session_row["interview_type"],
                "difficulty": session_row["difficulty"],
                "completed_at": res_row["completed_at"].isoformat() if (res_row and res_row.get("completed_at")) else None,
                "total_duration_seconds": res_row["total_duration"] if res_row else 0
            },
            "scores": {
                "overall_score": float(res_row["overall_score"]) if (res_row and res_row.get("overall_score") is not None) else None,
                "performance_rating": res_row["performance_rating"] if res_row else "Under Review",
                "category_breakdown": {
                    "communication_score": float(res_row["communication_score"]) if (res_row and res_row.get("communication_score") is not None) else None,
                    "confidence_score": float(res_row["confidence_score"]) if (res_row and res_row.get("confidence_score") is not None) else None,
                    "technical_relevance_score": float(res_row["technical_relevance_score"]) if (res_row and res_row.get("technical_relevance_score") is not None) else None,
                    "professionalism_score": float(res_row["professionalism_score"]) if (res_row and res_row.get("professionalism_score") is not None) else None,
                }
            },
            "ai_feedback": {
                "strengths": _parse(res_row.get("strengths")) if res_row else [],
                "weaknesses": _parse(res_row.get("weaknesses")) if res_row else [],
                "improvement_suggestions": _parse(res_row.get("improvement_suggestions")) if res_row else [],
                "practice_recommendations": _parse(res_row.get("practice_recommendations")) if res_row else [],
                "learning_resources": _parse(res_row.get("learning_resources")) if res_row else []
            }
        }
        from fastapi.responses import JSONResponse
        res = JSONResponse(content=report_data)
        res.headers["Content-Disposition"] = f'attachment; filename="SmartHire_{safe_name}_Interview_Report.json"'
        return res

    # Generate Professional PDF Report
    pdf_bytes = CandidatePDFGenerator.generate_pdf(
        candidate_info={"name": cand_name, "email": cand_email},
        session_info=dict(session_row),
        result_info=dict(res_row) if res_row else {},
        questions_summary={"completed": answered_q, "total": total_q}
    )

    filename = f"SmartHire_{safe_name}_Interview_Report.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


