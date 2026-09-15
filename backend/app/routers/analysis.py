# ============================================================
#  analysis.py — Emotion & Candidate Analytics FastAPI Router
# ============================================================
import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import asyncpg

from app.database import get_db
from app.dependencies import get_current_user
from app.services.emotion_service import EmotionService
from app.services.speech_analysis_service import SpeechAnalysisService
from app.services.behavior_analysis_service import BehaviorAnalysisService

logger = logging.getLogger("smarthire.analysis_router")

router = APIRouter(tags=["Candidate Analytics & Emotion Pipeline"])


# ── Pydantic Request & Response Models ───────────────────────

class EmotionFrameRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded video frame image")
    question_id: Optional[UUID] = Field(None, description="Current interview question ID")
    smoothing_window: int = Field(5, ge=1, le=20)

class EmotionFrameResponse(BaseModel):
    status: str
    face_detected: bool
    dominant_emotion: Optional[str]
    emotion_scores: Dict[str, float]
    model_confidence: float
    model_version: Optional[str]
    timestamp: str


# ── 1. Real-Time Emotion Frame Analysis Endpoint ────────────

@router.post(
    "/interviews/sessions/{session_id}/emotion-frame",
    response_model=EmotionFrameResponse,
    summary="Process live webcam frame with PyTorch Emotion Model"
)
@router.post("/sessions/{session_id}/emotion-frame", response_model=EmotionFrameResponse)
@router.post("/interviews/{session_id}/emotion/analyze-frame", response_model=EmotionFrameResponse)
@router.post("/interviews/{session_id}/emotion-frame", response_model=EmotionFrameResponse)
@router.post("/analysis/session/{session_id}/emotion-frame", response_model=EmotionFrameResponse)
async def analyze_emotion_frame(
    session_id: UUID,
    req: EmotionFrameRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Receives live webcam video frame base64 string during interview,
    authenticates user & validates active session status,
    runs PyTorch facial emotion recognition inference, applies face detection & temporal smoothing,
    and persists frame metadata and emotion probabilities to PostgreSQL database tables.
    """
    logger.info(f"[Emotion] Frame received | session={session_id}")

    # ── Session Ownership & Security Validation ─────────────────────────────
    session = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    user_role = (current_user.get("role") or "").lower()
    user_id = str(current_user.get("id") or "")

    if user_role not in ("recruiter", "admin"):
        cand_target = str(session.get("candidate_id") or session.get("user_id") or "")
        if user_id != cand_target:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to send emotion frames for this session."
            )

    status_str = (session.get("status") or "").upper()
    if status_str in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot process emotion frames for interview session in status '{status_str}'."
        )

    # ── Deduplication Guard (prevent frames faster than 400ms) ───────────────
    last_frame_ts = await db.fetchval(
        "SELECT created_at FROM interview_emotion_analysis WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1",
        session_id
    )
    if last_frame_ts:
        elapsed = (datetime.utcnow() - last_frame_ts.replace(tzinfo=None)).total_seconds()
        if elapsed < 0.4:
            logger.debug(f"[Emotion] Frame deduplicated (elapsed {elapsed:.2f}s) | session={session_id}")
            return EmotionFrameResponse(
                status="success",
                face_detected=False,
                dominant_emotion=None,
                emotion_scores={},
                model_confidence=0.0,
                model_version="1.0.0",
                timestamp=datetime.utcnow().isoformat() + "Z"
            )

    # 1. Run PyTorch Real Model Inference
    result = EmotionService.analyze_frame(
        image_base64=req.image_base64,
        session_id=str(session_id),
        question_id=str(req.question_id) if req.question_id else None,
        smoothing_window=req.smoothing_window
    )

    result_status = result["status"]  # 'success' | 'unavailable' | 'failed'
    face_detected = bool(result["face_detected"])
    face_event = result.get("face_event", "face_detected" if face_detected else "no_face_detected")
    dominant_emotion = result.get("dominant_emotion")
    confidence = result.get("model_confidence", 0.0)
    frame_status = result.get("frame_processing_status", "UNKNOWN")

    if face_detected:
        face_count = 1
    elif face_event == "multiple_faces_detected":
        face_count = 2
    else:
        face_count = 0

    if result_status == "unavailable":
        return EmotionFrameResponse(
            status="unavailable",
            face_detected=False,
            dominant_emotion=None,
            emotion_scores={},
            model_confidence=0.0,
            model_version=None,
            timestamp=result.get("timestamp", "")
        )

    if result_status == "failed":
        EmotionService.log_session_summary(str(session_id), db_rows_inserted=0, status="frame_error")
        return EmotionFrameResponse(
            status="failed",
            face_detected=False,
            dominant_emotion=None,
            emotion_scores={},
            model_confidence=0.0,
            model_version=result.get("model_version"),
            timestamp=result.get("timestamp", "")
        )

    # 2. Persist real frame event into PostgreSQL database tables
    db_rows_inserted = 0
    try:
        probs = result.get("emotion_scores", {}) or {}

        # Table 1: interview_emotion_analysis
        await db.execute(
            """
            INSERT INTO interview_emotion_analysis (
                session_id, timestamp, emotion, confidence,
                angry_probability, disgust_probability, fear_probability,
                happy_probability, neutral_probability, sad_probability,
                surprise_probability, face_detected, face_count, model_version, created_at
            )
            VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            """,
            session_id,
            dominant_emotion,
            confidence,
            probs.get("angry", 0.0),
            probs.get("disgust", 0.0),
            probs.get("fear", 0.0),
            probs.get("happy", 0.0),
            probs.get("neutral", 0.0),
            probs.get("sad", 0.0),
            probs.get("surprise", 0.0),
            face_detected,
            face_count,
            result.get("model_version", "1.0.0")
        )
        db_rows_inserted += 1

        # Table 2: emotion_analysis_events
        await db.execute(
            """
            INSERT INTO emotion_analysis_events (
                session_id, question_id, face_detected, face_event,
                detected_emotion, confidence_score, probabilities,
                model_name, model_version, frame_processing_status, error_message
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
            """,
            session_id,
            req.question_id,
            face_detected,
            face_event,
            dominant_emotion,
            confidence if face_detected else None,
            json.dumps(probs),
            result.get("model_name", "SmartHire-EmotionNet-EmotionCNN"),
            result.get("model_version", "1.0.0"),
            frame_status,
            result.get("reason")
        )
        db_rows_inserted += 1

        # Table 3: emotion_analysis_results
        await db.execute(
            """
            INSERT INTO emotion_analysis_results (
                session_id, question_id, face_detected, dominant_emotion,
                emotion_scores, model_confidence, smoothing_window, model_version
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
            """,
            session_id,
            req.question_id,
            face_detected,
            dominant_emotion or "no_face",
            json.dumps(probs),
            confidence,
            result.get("smoothing_window_size", 5),
            result.get("model_version", "1.0.0")
        )
        db_rows_inserted += 1

        session_total = EmotionService._session_stats.get(str(session_id), {}).get("total_frames", 0)
        if session_total % 10 == 0:
            EmotionService.log_session_summary(str(session_id), db_rows_inserted=db_rows_inserted)

    except Exception as e:
        logger.error(
            f"[Emotion] DB write FAILED | session={session_id} | error={type(e).__name__}: {e}"
        )

    return EmotionFrameResponse(
        status=result_status,
        face_detected=face_detected,
        dominant_emotion=dominant_emotion,
        emotion_scores=result.get("emotion_scores", {}),
        model_confidence=confidence,
        model_version=result.get("model_version"),
        timestamp=result.get("timestamp", "")
    )


# ── 2. Full Session Candidate Analytics Endpoint ─────────────

@router.get(
    "/interviews/sessions/{session_id}/analysis",
    summary="Get aggregated emotion, speech & behavioral analytics"
)
@router.get("/sessions/{session_id}/analysis")
async def get_session_analysis(
    session_id: UUID,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns full session analytics including PyTorch emotion model outputs,
    communication metrics, eye contact, and derived indicators without mock scores.

    Access control:
    - Candidates: can only access their OWN COMPLETED session. Response is filtered to
      exclude recruiter-only fields.
    - Recruiter / Admin: full response, all sessions.
    """
    session = await db.fetchrow("SELECT * FROM interview_sessions WHERE id = $1", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    user_role = (current_user.get("role") or "").lower()
    user_id = str(current_user.get("id") or "")

    if user_role == "candidate":
        session_candidate_id = str(session.get("candidate_id") or session.get("user_id") or "")
        if user_id != session_candidate_id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You are not authorized to access this session's analysis."
            )
        session_status = (session.get("status") or "").upper()
        if session_status != "COMPLETED":
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Interview report is only accessible after the session is COMPLETED."
            )

    # Fetch emotion frame events from DB
    event_rows = await db.fetch(
        "SELECT * FROM emotion_analysis_events WHERE session_id = $1 ORDER BY captured_at ASC",
        session_id
    )

    if not event_rows:
        iea_rows = await db.fetch(
            "SELECT * FROM interview_emotion_analysis WHERE session_id = $1 ORDER BY timestamp ASC",
            session_id
        )
        if iea_rows:
            event_rows = []
            for fr in iea_rows:
                probs = {
                    "angry": float(fr.get("angry_probability", 0.0) or 0.0),
                    "disgust": float(fr.get("disgust_probability", 0.0) or 0.0),
                    "fear": float(fr.get("fear_probability", 0.0) or 0.0),
                    "happy": float(fr.get("happy_probability", 0.0) or 0.0),
                    "neutral": float(fr.get("neutral_probability", 0.0) or 0.0),
                    "sad": float(fr.get("sad_probability", 0.0) or 0.0),
                    "surprise": float(fr.get("surprise_probability", 0.0) or 0.0),
                }
                event_rows.append({
                    "id": fr["id"],
                    "session_id": fr["session_id"],
                    "question_id": None,
                    "captured_at": fr["created_at"],
                    "face_detected": fr["face_detected"],
                    "face_event": "face_detected" if fr["face_detected"] else ("no_face_detected" if fr.get("face_count", 1) == 0 else "multiple_faces_detected"),
                    "detected_emotion": fr["emotion"] if fr["emotion"] != "no_face" else None,
                    "confidence_score": float(fr.get("confidence", 0.0) or 0.0) if fr["face_detected"] else 0.0,
                    "probabilities": probs,
                    "model_version": fr.get("model_version", "1.0.0")
                })
        else:
            fallback_rows = await db.fetch(
                "SELECT * FROM emotion_analysis_results WHERE session_id = $1 ORDER BY timestamp ASC",
                session_id
            )
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

    # Fetch communication analysis records
    comm_rows = await db.fetch(
        "SELECT * FROM communication_analysis WHERE session_id = $1 ORDER BY created_at ASC",
        session_id
    )

    # Fetch behavior analysis record
    beh_row = await db.fetchrow(
        "SELECT * FROM interview_behavior_analysis WHERE session_id = $1",
        session_id
    )

    # Format Emotion Analysis
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
            probs = r["probabilities"]
            if isinstance(probs, str):
                try:
                    probs = json.loads(probs)
                except Exception:
                    probs = {}
            elif not probs:
                probs = {}

            face_det = bool(r["face_detected"])
            face_ev = r.get("face_event") or ("face_detected" if face_det else "no_face_detected")
            dom_emo = r["detected_emotion"]
            conf = float(r["confidence_score"]) if r["confidence_score"] is not None else 0.0

            if face_det and dom_emo:
                valid_face_count += 1
                emotion_counts[dom_emo] = emotion_counts.get(dom_emo, 0) + 1
                total_conf += conf
            elif face_ev == "multiple_faces_detected":
                multiple_face_count += 1
            else:
                no_face_count += 1

            captured_ts = r.get("captured_at") or r.get("created_at")
            timeline.append({
                "timestamp": captured_ts.isoformat() if captured_ts else "",
                "question_id": str(r["question_id"]) if r["question_id"] else None,
                "face_detected": face_det,
                "face_event": face_ev,
                "dominant_emotion": dom_emo,
                "emotion_scores": probs,
                "confidence": conf
            })

        model_version_val = event_rows[-1].get("model_version", "1.0.0") if event_rows else "1.0.0"
        model_name_val = "SmartHire-EmotionNet-EmotionCNN"

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

    # Format Communication Analysis
    formatted_comm = []
    for r in comm_rows:
        comm_dict = dict(r)
        if isinstance(comm_dict.get("filler_words_list"), str):
            comm_dict["filler_words_list"] = json.loads(comm_dict["filler_words_list"])
        if isinstance(comm_dict.get("strengths"), str):
            comm_dict["strengths"] = json.loads(comm_dict["strengths"])

        if isinstance(comm_dict.get("weaknesses"), str):
            comm_dict["weaknesses"] = json.loads(comm_dict["weaknesses"])
        formatted_comm.append(comm_dict)

    # Format Behavior & Derived Indicators
    if beh_row:
        beh_dict = dict(beh_row)
        if isinstance(beh_dict.get("evidence"), str):
            beh_dict["evidence"] = json.loads(beh_dict["evidence"])
        if isinstance(beh_dict.get("behavior_events"), str):
            beh_dict["behavior_events"] = json.loads(beh_dict["behavior_events"])
    else:
        beh_dict = {
            "eye_contact_percentage": 0.0,
            "looking_away_duration": 0,
            "attention_breaks": 0,
            "face_visible_ratio": 0.0,
            "observed_emotion": "Unavailable",
            "confidence_indicator": "Insufficient data for confidence analysis",
            "frustration_indicator": "Insufficient Data",
            "tension_indicator": "Insufficient Data",
            "reliability": "Insufficient Data",
            "evidence": {"reason": "Webcam behavior tracking data was not recorded for this session."}
        }

    full_response = {
        "session_id": str(session_id),
        "status": session["status"],
        "emotion_analysis": emotion_data,
        "emotion_detection": emotion_detection,
        "communication_analysis": formatted_comm,
        "behavior_analysis": beh_dict
    }

    # Candidate privacy filter: strip recruiter-only metrics
    if user_role == "candidate":
        return {
            "session_id": str(session_id),
            "status": session["status"]
        }

    return full_response


# ── 3. Emotion Analysis Specific Endpoint ────────────────────

@router.get("/interviews/sessions/{session_id}/emotion-analysis")
@router.get("/sessions/{session_id}/emotion-analysis")
@router.get("/interviews/{session_id}/emotion-analysis")
@router.get("/recruiter/interviews/{session_id}/emotion-analysis")
async def get_emotion_analysis(
    session_id: UUID,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    res = await get_session_analysis(session_id, db, current_user)
    return res["emotion_analysis"]


# ── 4. Communication Analysis Specific Endpoint ──────────────

@router.get("/interviews/sessions/{session_id}/communication-analysis")
@router.get("/sessions/{session_id}/communication-analysis")
async def get_communication_analysis(
    session_id: UUID,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    res = await get_session_analysis(session_id, db, current_user)
    return res["communication_analysis"]


# ── 5. Behavioral Analysis Specific Endpoint ─────────────────

@router.get("/interviews/sessions/{session_id}/behavior-analysis")
@router.get("/sessions/{session_id}/behavior-analysis")
async def get_behavior_analysis(
    session_id: UUID,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    res = await get_session_analysis(session_id, db, current_user)
    return res["behavior_analysis"]


# ── 6. Question-by-Question Analysis Endpoint ────────────────

@router.get("/interviews/sessions/{session_id}/question-analysis")
@router.get("/sessions/{session_id}/question-analysis")
async def get_question_analysis(
    session_id: UUID,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    q_rows = await db.fetch(
        "SELECT * FROM interview_questions WHERE session_id = $1 ORDER BY question_number ASC",
        session_id
    )
    return [dict(q) for q in q_rows]
