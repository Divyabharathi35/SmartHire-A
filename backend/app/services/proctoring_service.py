# ============================================================
#  proctoring_service.py — Proctoring & Integrity Engine Service
# ============================================================
import json
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
import asyncpg


class ProctoringService:
    """
    Proctoring & Integrity scoring service.
    Calculates integrity score dynamically from stored events.
    """

    DEDUCTIONS = {
        "MULTIPLE_FACES": 15.0,
        "MOBILE_DEVICE_DETECTED": 15.0,
        "POSSIBLE_PHONE": 10.0,
        "POSSIBLE_PHONE_USAGE": 15.0,
        "TAB_SWITCH": 8.0,
        "FULLSCREEN_EXIT": 5.0,
        "LOOKING_AWAY": 3.0,
        "CAMERA_DISCONNECTED": 10.0,
        "MIC_DISCONNECTED": 10.0,
        "SCREEN_SHARE_STOPPED": 10.0,
        "FACE_NOT_VISIBLE": 5.0,
        "FACE_NOT_DETECTED": 5.0,
        "LOW_LIGHT": 3.0,
        "CAMERA_OBSTRUCTED": 5.0,
        "LOW_AUDIO": 2.0,
        "AUDIO_INTERRUPTION": 3.0,
        "SUSPICIOUS_ACTIVITY": 10.0,
    }

    @classmethod
    def calculate_score(cls, events: List[Dict]) -> Dict:
        """
        Calculates integrity score (0-100) and final status from a list of events.
        """
        score = 100.0
        event_counts = {k: 0 for k in cls.DEDUCTIONS.keys()}
        total_looking_away_duration = 0

        for ev in events:
            ev_type = ev.get("event_type", "").upper()
            if ev_type in cls.DEDUCTIONS:
                deduction = cls.DEDUCTIONS[ev_type]
                score -= deduction
                event_counts[ev_type] = event_counts.get(ev_type, 0) + 1
            if ev_type == "LOOKING_AWAY":
                total_looking_away_duration += int(ev.get("duration", 0))

        score = max(0.0, min(100.0, round(score, 2)))

        if score >= 85.0:
            final_status = "GOOD"
        elif score >= 70.0:
            final_status = "REVIEW"
        else:
            final_status = "HIGH RISK"

        return {
            "integrity_score": score,
            "final_status": final_status,
            "counts": event_counts,
            "looking_away_duration": total_looking_away_duration,
        }

    @classmethod
    async def record_events(
        cls, db: asyncpg.Connection, session_id: UUID, events: List[Dict]
    ) -> List[Dict]:
        """
        Inserts multiple integrity events into PostgreSQL database.
        """
        saved_events = []
        for ev in events:
            ts = ev.get("timestamp")
            if not ts:
                ts = datetime.utcnow()
            elif isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    ts = datetime.utcnow()

            metadata = ev.get("metadata", {})
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}

            row = await db.fetchrow(
                """
                INSERT INTO interview_integrity_events
                  (session_id, event_type, severity, message, timestamp, duration, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                RETURNING id, session_id, event_type, severity, message, timestamp, duration, metadata, created_at
                """,
                session_id,
                ev.get("event_type", "SUSPICIOUS_ACTIVITY"),
                ev.get("severity", "LOW").upper(),
                ev.get("message", "Integrity warning recorded"),
                ts,
                int(ev.get("duration", 0)),
                json.dumps(metadata),
            )
            saved = dict(row)
            if isinstance(saved.get("metadata"), str):
                saved["metadata"] = json.loads(saved["metadata"])
            saved_events.append(saved)

        return saved_events

    @classmethod
    async def calculate_and_save_summary(
        cls,
        db: asyncpg.Connection,
        session_id: UUID,
        override_data: Optional[Dict] = None,
    ) -> Dict:
        """
        Aggregates all integrity events for session_id from DB,
        computes score, and upserts interview_proctoring_summary.
        """
        rows = await db.fetch(
            "SELECT * FROM interview_integrity_events WHERE session_id = $1 ORDER BY timestamp ASC",
            session_id,
        )
        events = [dict(r) for r in rows]

        calc = cls.calculate_score(events)

        multiple_face_cnt = calc["counts"].get("MULTIPLE_FACES", 0)
        looking_away_cnt = calc["counts"].get("LOOKING_AWAY", 0)
        looking_away_dur = calc["looking_away_duration"]
        tab_switch_cnt = calc["counts"].get("TAB_SWITCH", 0)
        fullscreen_exit_cnt = calc["counts"].get("FULLSCREEN_EXIT", 0)
        screen_share_stop_cnt = calc["counts"].get("SCREEN_SHARE_STOPPED", 0)
        possible_phone_cnt = calc["counts"].get("POSSIBLE_PHONE", 0) + calc["counts"].get("POSSIBLE_PHONE_USAGE", 0) + calc["counts"].get("MOBILE_DEVICE_DETECTED", 0)
        camera_disconnect_cnt = calc["counts"].get("CAMERA_DISCONNECTED", 0)
        mic_disconnect_cnt = calc["counts"].get("MIC_DISCONNECTED", 0)
        suspicious_cnt = len(events)

        face_verification_status = "PASSED"
        if (calc["counts"].get("FACE_NOT_DETECTED", 0) + calc["counts"].get("FACE_NOT_VISIBLE", 0)) > 3:
            face_verification_status = "WARNING"

        # Calculate face presence percentage (estimated from face missing duration)
        total_missing_dur = sum(
            e.get("duration", 0)
            for e in events
            if e.get("event_type") in ("FACE_NOT_DETECTED", "FACE_NOT_VISIBLE")
        )
        face_presence_pct = max(0.0, min(100.0, 100.0 - (total_missing_dur * 0.5)))

        if override_data:
            if "face_verification_status" in override_data:
                face_verification_status = override_data["face_verification_status"]
            if "face_presence_percentage" in override_data:
                face_presence_pct = override_data["face_presence_percentage"]

        score = (
            override_data.get("integrity_score")
            if (override_data and override_data.get("integrity_score") is not None)
            else calc["integrity_score"]
        )
        final_status = (
            "GOOD" if score >= 85.0 else ("REVIEW" if score >= 70.0 else "HIGH RISK")
        )

        summary_row = await db.fetchrow(
            """
            INSERT INTO interview_proctoring_summary (
                session_id, face_verification_status, face_presence_percentage,
                multiple_face_count, looking_away_count, looking_away_duration,
                tab_switch_count, fullscreen_exit_count, screen_share_stop_count,
                possible_phone_count, camera_disconnect_count, mic_disconnect_count,
                suspicious_event_count, integrity_score, final_status, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            ON CONFLICT (session_id) DO UPDATE SET
                face_verification_status = EXCLUDED.face_verification_status,
                face_presence_percentage = EXCLUDED.face_presence_percentage,
                multiple_face_count = EXCLUDED.multiple_face_count,
                looking_away_count = EXCLUDED.looking_away_count,
                looking_away_duration = EXCLUDED.looking_away_duration,
                tab_switch_count = EXCLUDED.tab_switch_count,
                fullscreen_exit_count = EXCLUDED.fullscreen_exit_count,
                screen_share_stop_count = EXCLUDED.screen_share_stop_count,
                possible_phone_count = EXCLUDED.possible_phone_count,
                camera_disconnect_count = EXCLUDED.camera_disconnect_count,
                mic_disconnect_count = EXCLUDED.mic_disconnect_count,
                suspicious_event_count = EXCLUDED.suspicious_event_count,
                integrity_score = EXCLUDED.integrity_score,
                final_status = EXCLUDED.final_status,
                updated_at = NOW()
            RETURNING *
            """,
            session_id,
            face_verification_status,
            float(face_presence_pct),
            multiple_face_cnt,
            looking_away_cnt,
            looking_away_dur,
            tab_switch_cnt,
            fullscreen_exit_cnt,
            screen_share_stop_cnt,
            possible_phone_cnt,
            camera_disconnect_cnt,
            mic_disconnect_cnt,
            suspicious_cnt,
            float(score),
            final_status,
        )

        res = dict(summary_row)
        res["integrity_score"] = float(res["integrity_score"])
        res["face_presence_percentage"] = float(res["face_presence_percentage"])
        return res

    @classmethod
    async def get_summary_and_timeline(
        cls, db: asyncpg.Connection, session_id: UUID
    ) -> Dict:
        """
        Fetches proctoring summary and timeline of events for session_id.
        Returns summary=None and status="no_data" if monitoring data was not collected.
        """
        events_rows = await db.fetch(
            "SELECT * FROM interview_integrity_events WHERE session_id = $1 ORDER BY timestamp ASC",
            session_id,
        )
        timeline = []
        for r in events_rows:
            ev = dict(r)
            if isinstance(ev.get("metadata"), str):
                try:
                    ev["metadata"] = json.loads(ev["metadata"])
                except Exception:
                    ev["metadata"] = {}
            timeline.append(ev)

        summary_row = await db.fetchrow(
            "SELECT * FROM interview_proctoring_summary WHERE session_id = $1",
            session_id,
        )
        if not summary_row:
            if len(events_rows) > 0:
                summary = await cls.calculate_and_save_summary(db, session_id)
            else:
                summary = None
        else:
            summary = dict(summary_row)
            summary["integrity_score"] = float(summary["integrity_score"])
            summary["face_presence_percentage"] = float(
                summary["face_presence_percentage"]
            )

        return {
            "summary": summary,
            "timeline": timeline,
            "status": "active" if summary else "no_data",
        }
