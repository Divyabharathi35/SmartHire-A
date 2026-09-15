# ============================================================
#  speech_analysis_service.py — Audio Transcript & Speech Processing
# ============================================================
import re
import json
import logging
from typing import Dict, Any, Optional
from uuid import UUID

from app.services.communication_service import CommunicationService

logger = logging.getLogger("smarthire.speech_analysis")

class SpeechAnalysisService:
    """
    Service for integrating real audio transcriptions, analyzing speaking pace (WPM),
    filler word rates, answer duration, and generating communication metrics.
    """

    @classmethod
    def process_speech_answer(
        cls,
        transcript: str,
        duration_seconds: int,
        confidence_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Processes actual microphone recording transcript:
        - Calculates word count and speaking duration.
        - Runs CommunicationService quality evaluation.
        - Returns structured real metrics without placeholder fake numbers.
        """
        cleaned_transcript = (transcript or "").strip()
        words = re.findall(r"\b[\w']+\b", cleaned_transcript)
        word_count = len(words)

        if not cleaned_transcript or word_count == 0:
            return {
                "transcript": cleaned_transcript,
                "word_count": 0,
                "speaking_duration": duration_seconds,
                "words_per_minute": 0.0,
                "pace_category": "Insufficient Data",
                "filler_word_count": 0,
                "filler_words_per_minute": 0.0,
                "filler_rate": 0.0,
                "filler_words_list": [],
                "grammar_score": None,
                "grammar_error_count": 0,
                "grammar_feedback": "Grammar analysis unavailable — answer text was empty or not recorded.",
                "pronunciation_score": None,
                "pronunciation_status": "Unavailable",
                "pronunciation_feedback": "Pronunciation analysis unavailable — audio confidence signal not provided.",
                "communication_score": None,
                "reliability": "Insufficient Data",
                "status": "insufficient_data"
            }

        # Calculate communication analysis metrics using CommunicationService
        comm_eval = CommunicationService.analyze_communication_quality(
            text=cleaned_transcript,
            duration_seconds=duration_seconds,
            confidence_score=confidence_score
        )

        reliability = "High" if word_count >= 15 else "Moderate"

        return {
            "transcript": cleaned_transcript,
            "word_count": word_count,
            "speaking_duration": duration_seconds,
            "words_per_minute": comm_eval["words_per_minute"],
            "pace_category": comm_eval["pace_category"],
            "filler_word_count": comm_eval["filler_word_count"],
            "filler_words_per_minute": comm_eval["filler_words_per_minute"],
            "filler_rate": comm_eval["filler_rate"],
            "filler_words_list": comm_eval["filler_words_list"],
            "grammar_score": comm_eval["grammar_score"],
            "grammar_error_count": comm_eval["grammar_error_count"],
            "grammar_feedback": comm_eval["grammar_feedback"],
            "pronunciation_score": comm_eval["pronunciation_score"],
            "pronunciation_status": comm_eval["pronunciation_status"],
            "pronunciation_feedback": comm_eval["pronunciation_feedback"],
            "communication_score": comm_eval["communication_score"],
            "feedback": comm_eval["feedback"],
            "strengths": comm_eval["strengths"],
            "weaknesses": comm_eval["weaknesses"],
            "reliability": reliability,
            "status": "completed"
        }
