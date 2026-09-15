# ============================================================
#  behavior_analysis_service.py — Eye Tracking & Derived Indicators
# ============================================================
"""
Deterministic behavioral analysis engine:
- Processes face visibility, looking away events, attention breaks, and eye contact.
- Computes observable derived indicators:
  1. Observable Confidence Indicator
  2. Possible Frustration Signals
  3. Tension Signals
- Generates evidence breakdown and reliability ratings without psychological diagnosis claims.
"""
import json
from typing import Dict, Any, List, Optional

class BehaviorAnalysisService:

    @classmethod
    def calculate_behavioral_metrics(
        cls,
        eye_contact_ratio: float = 0.0,
        looking_away_duration: int = 0,
        attention_break_count: int = 0,
        face_visible_ratio: float = 0.0,
        emotion_events: Optional[List[Dict[str, Any]]] = None,
        communication_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Calculates behavior metrics, derived indicators, evidence list, and reliability rating based strictly on recorded evidence.
        """
        # Ensure values bounded
        eye_contact = max(0.0, min(100.0, float(eye_contact_ratio)))
        face_visibility = max(0.0, min(100.0, float(face_visible_ratio)))
        looking_away_dur = max(0, int(looking_away_duration))
        breaks = max(0, int(attention_break_count))

        # Check total sample count / facial data availability
        total_samples = len(emotion_events) if emotion_events else 0
        has_facial_data = total_samples > 0 or (eye_contact > 0.0 and face_visibility > 0.0)
        has_comm_data = bool(communication_data and (communication_data.get("word_count", 0) > 0 or communication_data.get("filler_rate") is not None))

        if not has_facial_data and not has_comm_data:
            return {
                "eye_contact_percentage": 0.0 if not has_facial_data else eye_contact,
                "looking_away_duration": looking_away_dur,
                "attention_breaks": breaks,
                "face_visible_ratio": 0.0,
                "eye_contact_status": "Unavailable — no camera tracking data",
                "observed_emotion": "Unavailable — no facial frames recorded",
                "confidence_indicator": "Unavailable — no facial frames recorded",
                "frustration_indicator": "Unavailable — no facial frames recorded",
                "tension_indicator": "Unavailable — no facial frames recorded",
                "engagement_score": None,
                "behavior_score": None,
                "reliability": "Insufficient Data",
                "evidence": {
                    "reason": "No facial emotion frame data or speech response data recorded for this interview session."
                }
            }

        # ── 1. Analyze Facial Emotion Trends ──────────────────────
        angry_count = 0
        sad_count = 0
        fear_count = 0
        happy_count = 0
        neutral_count = 0
        dominant_emotions = []

        if emotion_events and total_samples > 0:
            for ev in emotion_events:
                dom = ev.get("dominant_emotion", "").lower()
                dominant_emotions.append(dom)
                if dom == "angry": angry_count += 1
                elif dom == "sad": sad_count += 1
                elif dom == "fear": fear_count += 1
                elif dom == "happy": happy_count += 1
                elif dom == "neutral": neutral_count += 1

            most_frequent_emotion = max(set(dominant_emotions), key=dominant_emotions.count).title() if dominant_emotions else "Unavailable — no facial frames recorded"
            neg_emotion_pct = round(((angry_count + sad_count + fear_count) / max(1, total_samples)) * 100.0, 2)
        else:
            most_frequent_emotion = "Unavailable — no facial frames recorded"
            neg_emotion_pct = 0.0

        # ── 2. Speech & Communication Inputs ──────────────────────
        filler_rate = communication_data.get("filler_rate") if communication_data else None
        wpm = communication_data.get("words_per_minute") if communication_data else None
        pace_category = communication_data.get("pace_category") if communication_data else None

        # ── 3. Derived Confidence Indicator Formula ───────────────
        if not has_facial_data and filler_rate is None:
            confidence_indicator = "Unavailable — no facial frames recorded"
            frustration_indicator = "Unavailable — no facial frames recorded"
            tension_indicator = "Unavailable — no facial frames recorded"
            conf_score = None
            frustration_evidence = []
            tension_evidence = []
        else:
            pace_score = 90.0 if pace_category in ("Good", "Moderate", "Normal") else 60.0
            filler_score = max(0.0, 100.0 - ((filler_rate or 0.0) * 5.0))
            
            # If no facial data, base observable confidence only on speech pace & filler stability
            if has_facial_data:
                conf_score = round(
                    (eye_contact * 0.40) +
                    (face_visibility * 0.30) +
                    (pace_score * 0.15) +
                    (filler_score * 0.15),
                    2
                )
            else:
                conf_score = round((pace_score * 0.50) + (filler_score * 0.50), 2)

            if conf_score >= 80.0:
                confidence_indicator = "High Observable Confidence Indicators" if not has_facial_data else "High Observed Confidence"
            elif conf_score >= 60.0:
                confidence_indicator = "Moderate Observable Confidence Indicators" if not has_facial_data else "Moderate Observed Confidence"
            else:
                confidence_indicator = "Varied Speech Attention / Hesitant"

            # ── 4. Derived Frustration Indicator ──────────────────────
            frustration_evidence = []
            if total_samples > 0 and (angry_count > 2 or neg_emotion_pct >= 25.0):
                frustration_evidence.append(f"Facial expression analysis detected negative expression trends ({neg_emotion_pct}% negative frames).")
            if filler_rate and filler_rate >= 8.0:
                frustration_evidence.append(f"Elevated filler word frequency ({filler_rate}% rate).")
            if pace_category in ("Slow", "Fast", "Too Slow", "Too Fast"):
                frustration_evidence.append(f"Unstable speaking pace ({wpm} WPM).")

            if len(frustration_evidence) >= 2:
                frustration_indicator = "Elevated Possible Frustration Indicators"
            elif len(frustration_evidence) == 1:
                frustration_indicator = "Moderate Possible Frustration Indicators"
            else:
                frustration_indicator = "Low Frustration Signals" if has_facial_data or len(frustration_evidence) > 0 else "Unavailable — insufficient evidence"

            # ── 5. Derived Tension / Stress-Like Indicator ────────────
            tension_evidence = []
            if has_facial_data and (looking_away_dur > 20 or breaks > 3):
                tension_evidence.append(f"Frequent face orientation changes / looking away ({looking_away_dur}s duration).")
            if total_samples > 0 and (fear_count + sad_count) > 2:
                tension_evidence.append("Observed tension in facial micro-expressions.")
            if filler_rate and filler_rate >= 6.0:
                tension_evidence.append(f"Pause / filler word rate elevated ({filler_rate}%).")

            if len(tension_evidence) >= 2:
                tension_indicator = "Elevated Observable Tension Indicators"
            elif len(tension_evidence) == 1:
                tension_indicator = "Moderate Observable Tension Indicators"
            else:
                tension_indicator = "Low Tension Signals" if has_facial_data or len(tension_evidence) > 0 else "Unavailable — insufficient evidence"

        # ── 6. Overall Behavior Score & Data Reliability ─────────
        if has_facial_data:
            behavior_score = max(0.0, min(100.0, round(
                (eye_contact * 0.4) + (face_visibility * 0.4) - (breaks * 3.0), 2
            )))
        else:
            behavior_score = None

        # Reliability based on actual sample volume & signal availability
        if total_samples >= 15 and has_comm_data:
            reliability = "High"
        elif total_samples >= 5 or has_comm_data:
            reliability = "Moderate"
        else:
            reliability = "Insufficient Data"

        evidence_payload = {
            "eye_contact_ratio": eye_contact if has_facial_data else None,
            "face_visible_ratio": face_visibility if has_facial_data else None,
            "looking_away_duration_sec": looking_away_dur,
            "attention_breaks": breaks,
            "most_frequent_facial_expression": most_frequent_emotion,
            "negative_expression_percentage": neg_emotion_pct if total_samples > 0 else None,
            "confidence_calculation_score": conf_score,
            "frustration_evidence_logs": frustration_evidence,
            "tension_evidence_logs": tension_evidence,
            "disclaimer": "Derived indicators reflect observable behavioral & speech patterns only and do not constitute psychological diagnosis."
        }

        return {
            "eye_contact_percentage": eye_contact if has_facial_data else None,
            "looking_away_duration": looking_away_dur,
            "attention_breaks": breaks,
            "face_visible_ratio": face_visibility if has_facial_data else None,
            "eye_contact_status": "Available" if (has_facial_data and eye_contact > 0) else "Insufficient camera analysis data",
            "observed_emotion": most_frequent_emotion,
            "confidence_indicator": confidence_indicator,
            "frustration_indicator": frustration_indicator,
            "tension_indicator": tension_indicator,
            "engagement_score": behavior_score,
            "behavior_score": behavior_score,
            "reliability": reliability,
            "evidence": evidence_payload
        }
