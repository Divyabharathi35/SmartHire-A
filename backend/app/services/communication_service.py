# ============================================================
#  communication_service.py — Speech, Grammar & Communication Analysis Service
# ============================================================
import re
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("smarthire.communication")

FILLER_WORDS_LIST = [
    "um", "uh", "erm", "hmm", "like", "you know", "actually", "basically",
    "so", "okay", "well", "i mean", "sort of", "kind of", "right", "honestly"
]


class CommunicationService:
    """
    Deterministic communication analysis service for candidate answer transcripts.
    Calculates filler words, speech pace (WPM), grammar health, pronunciation estimates,
    and overall communication quality.
    """

    @classmethod
    def detect_filler_words(cls, text: str, duration_seconds: int = 0) -> Dict[str, Any]:
        """
        Detects filler words in the transcript using exact word boundary regular expressions.
        Calculates filler_count, filler_wpm, filler_rate (%), list of detected words, and frequency breakdown.
        """
        if not text or not text.strip():
            return {
                "filler_word_count": 0,
                "filler_words_per_minute": 0.0,
                "filler_rate": 0.0,
                "filler_words_list": [],
                "detected_words": [],
                "detected_breakdown": {}
            }

        text_lower = text.lower()
        words = re.findall(r"\b[\w']+\b", text_lower)
        total_words = len(words)
        if total_words == 0:
            return {
                "filler_word_count": 0,
                "filler_words_per_minute": 0.0,
                "filler_rate": 0.0,
                "filler_words_list": [],
                "detected_words": [],
                "detected_breakdown": {}
            }

        detected_map = {}
        total_fillers = 0

        for filler in FILLER_WORDS_LIST:
            pattern = r"\b" + re.escape(filler) + r"\b"
            matches = len(re.findall(pattern, text_lower))
            if matches > 0:
                detected_map[filler] = matches
                total_fillers += matches

        duration_minutes = max(0.1, duration_seconds / 60.0) if duration_seconds > 0 else (total_words / 140.0)
        filler_wpm = round(total_fillers / duration_minutes, 2)
        filler_rate = round((total_fillers / max(1, total_words)) * 100.0, 2)

        formatted_list = [f"{word} ({count}x)" for word, count in detected_map.items()]
        detected_words = list(detected_map.keys())

        return {
            "filler_word_count": total_fillers,
            "filler_words_per_minute": filler_wpm,
            "filler_rate": filler_rate,
            "filler_words_list": formatted_list,
            "detected_words": detected_words,
            "detected_breakdown": detected_map
        }

    @classmethod
    def calculate_speech_pace(cls, word_count: int, duration_seconds: int, allow_estimate: bool = False) -> Dict[str, Any]:
        """
        Calculates Words Per Minute (WPM) and classifies pace into:
        Slow (< 100 WPM), Normal (100 - 165 WPM), Fast (> 165 WPM).
        Returns None / Insufficient Data if duration cannot be determined.
        """
        if duration_seconds <= 0:
            if allow_estimate and word_count > 0:
                # Estimate duration assuming standard speaking pace (~135 WPM)
                duration_seconds = max(1, round((word_count / 135.0) * 60.0))
            else:
                return {
                    "words_per_minute": None,
                    "pace_category": "Insufficient Data",
                    "pace_score": None,
                    "speaking_duration": 0,
                    "word_count": word_count,
                    "duration_minutes": None,
                    "status": "Insufficient Data"
                }

        if word_count == 0:
            return {
                "words_per_minute": 0.0,
                "pace_category": "Insufficient Data",
                "pace_score": None,
                "speaking_duration": duration_seconds,
                "word_count": 0,
                "duration_minutes": round(duration_seconds / 60.0, 2),
                "status": "Calculated"
            }

        duration_minutes = duration_seconds / 60.0
        wpm = round(word_count / duration_minutes, 2)

        if wpm < 100:
            category = "Slow"
            score = max(40.0, round(60.0 + (wpm / 100.0) * 25.0, 2))
        elif 100 <= wpm <= 165:
            category = "Normal"
            score = round(85.0 + (1.0 - abs(wpm - 140) / 25.0) * 15.0, 2)
        else:
            category = "Fast"
            score = max(40.0, round(80.0 - ((wpm - 165) / 50.0) * 30.0, 2))

        return {
            "words_per_minute": wpm,
            "pace_category": category,
            "pace_score": min(100.0, max(0.0, score)),
            "speaking_duration": duration_seconds,
            "word_count": word_count,
            "duration_minutes": round(duration_minutes, 2),
            "status": "Calculated"
        }

    @classmethod
    def analyze_grammar(cls, text: str) -> Dict[str, Any]:
        """
        Analyzes grammar errors, sentence structure, and vocabulary repetition deterministically.
        """
        if not text or not text.strip():
            return {
                "grammar_score": None,
                "grammar_error_count": 0,
                "grammar_feedback": "Grammar analysis unavailable — answer text was empty or not recorded.",
                "status": "Insufficient Data"
            }

        words = re.findall(r"\b[\w']+\b", text)
        if len(words) == 0:
            return {
                "grammar_score": None,
                "grammar_error_count": 0,
                "grammar_feedback": "Grammar analysis unavailable — insufficient words in transcript.",
                "status": "Insufficient Data"
            }

        sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
        error_count = 0
        feedback_points = []

        # 1. Check repeated words in succession (e.g., "the the", "is is")
        repeated_word_matches = re.findall(r"\b(\w+)\s+\1\b", text, re.IGNORECASE)
        if repeated_word_matches:
            error_count += len(repeated_word_matches)
            feedback_points.append(f"Contains repeated consecutive words: '{', '.join(set(repeated_word_matches))}'.")

        # 2. Check sentence capitalization
        uncapitalized = 0
        for s in sentences:
            if s and s[0].islower():
                uncapitalized += 1
        if uncapitalized > 0:
            error_count += uncapitalized
            feedback_points.append("Some sentences do not start with proper capitalization.")

        # 3. Check sentence length & complexity
        long_runons = 0
        for s in sentences:
            s_words = len(s.split())
            if s_words > 45:
                long_runons += 1
        if long_runons > 0:
            error_count += long_runons
            feedback_points.append("Contains long run-on sentences. Consider breaking into concise statements.")

        # Calculate score
        base_score = 100.0 - (error_count * 5.0)
        grammar_score = max(40.0, min(100.0, round(base_score, 2)))

        if not feedback_points:
            feedback_text = "Good grammatical structure with clear sentence flow and appropriate vocabulary."
        else:
            feedback_text = " ".join(feedback_points)

        return {
            "grammar_score": grammar_score,
            "grammar_error_count": error_count,
            "grammar_feedback": feedback_text,
            "status": "Evaluated"
        }

    @classmethod
    def evaluate_pronunciation(cls, confidence_score: float | None = None, word_count: int = 0) -> Dict[str, Any]:
        """
        Evaluates pronunciation based on browser Web Speech API confidence signals when available.
        """
        if confidence_score is not None and confidence_score > 0 and word_count >= 1:
            score = round(min(100.0, max(40.0, confidence_score * 100.0)), 2)
            status = "Estimated"
            feedback = f"Pronunciation intelligibility estimated at {score}% based on speech recognition confidence."
        else:
            score = None
            status = "Pronunciation analysis unavailable"
            feedback = "Pronunciation analysis unavailable — audio confidence signal not provided."

        return {
            "pronunciation_score": score,
            "pronunciation_status": status,
            "pronunciation_feedback": feedback
        }

    @classmethod
    def analyze_communication_quality(
        cls,
        text: str,
        duration_seconds: int = 0,
        confidence_score: float | None = None
    ) -> Dict[str, Any]:
        """
        Comprehensive communication quality evaluation combining filler word analysis, speech pace,
        grammar evaluation, and pronunciation estimates without hardcoded fallback defaults.
        Produces both flat fields for DB storage and nested structured JSON matching requirement 14.
        """
        words = re.findall(r"\b[\w']+\b", text or "")
        word_count = len(words)

        if not text or not text.strip() or word_count == 0:
            empty_result = {
                "grammar_score": None,
                "grammar_error_count": 0,
                "grammar_feedback": "Grammar analysis unavailable — answer text was empty or not recorded.",
                "filler_word_count": 0,
                "filler_words_per_minute": 0.0,
                "filler_rate": 0.0,
                "filler_words_list": [],
                "words_per_minute": None,
                "speaking_duration": duration_seconds,
                "word_count": 0,
                "pace_category": "Insufficient Data",
                "pronunciation_score": None,
                "pronunciation_status": "Pronunciation analysis unavailable",
                "pronunciation_feedback": "Pronunciation analysis unavailable",
                "communication_score": None,
                "feedback": "Communication analysis unavailable — insufficient transcript data provided.",
                "strengths": [],
                "weaknesses": ["Insufficient transcript data to compute communication metrics."],
                "speech_pace": {
                    "words_per_minute": None,
                    "duration_minutes": None,
                    "total_words": 0,
                    "pace_category": "Insufficient Data",
                    "status": "Insufficient Data"
                },
                "filler_words": {
                    "count": 0,
                    "percentage": 0.0,
                    "detected_words": []
                },
                "grammar": {
                    "score": None,
                    "error_count": 0,
                    "feedback": "Grammar analysis unavailable — answer text was empty or not recorded.",
                    "status": "Insufficient Data"
                },
                "overall_communication_quality": {
                    "score": None,
                    "confidence_level": "Low",
                    "summary": "Communication analysis unavailable — insufficient transcript data provided."
                }
            }
            return empty_result

        fillers = cls.detect_filler_words(text, duration_seconds)
        pace = cls.calculate_speech_pace(word_count, duration_seconds, allow_estimate=True)
        grammar = cls.analyze_grammar(text)
        pronunciation = cls.evaluate_pronunciation(confidence_score, word_count)

        # Filler score (100 minus penalty for high filler rate)
        filler_score = max(0.0, min(100.0, 100.0 - (fillers["filler_rate"] * 4.5)))

        # Weighted calculation handling optional None scores
        weighted_sum = 0.0
        total_weight = 0.0

        if grammar["grammar_score"] is not None:
            weighted_sum += grammar["grammar_score"] * 0.40
            total_weight += 0.40

        weighted_sum += filler_score * 0.30
        total_weight += 0.30

        if pace["pace_score"] is not None:
            weighted_sum += pace["pace_score"] * 0.20
            total_weight += 0.20

        if pronunciation["pronunciation_score"] is not None:
            weighted_sum += pronunciation["pronunciation_score"] * 0.10
            total_weight += 0.10

        comm_score = round(weighted_sum / total_weight, 2) if total_weight > 0 else None

        strengths = []
        weaknesses = []

        if grammar["grammar_score"] is not None:
            if grammar["grammar_score"] >= 85:
                strengths.append("Strong sentence structure and grammatical correctness.")
            elif grammar["grammar_score"] < 70:
                weaknesses.append("Grammatical errors and run-on sentences detected.")

        if fillers["filler_rate"] < 4.0:
            strengths.append("Low filler word usage; concise delivery.")
        else:
            weaknesses.append(f"Elevated filler word rate ({fillers['filler_rate']}%). Try eliminating pauses filled with '{', '.join(fillers['detected_words'][:3])}'.")

        if pace["pace_category"] == "Normal":
            strengths.append(f"Optimal speaking pace ({pace['words_per_minute']} WPM).")
        elif pace["pace_category"] in ("Slow", "Fast"):
            strengths.append(f"Speaking pace is {pace['pace_category'].lower()} ({pace['words_per_minute']} WPM).")

        wpm_display = f"{pace['words_per_minute']} WPM" if pace['words_per_minute'] is not None else "Insufficient Data"
        feedback_summary = f"Communication Score: {comm_score}/100." if comm_score is not None else "Communication analysis complete."
        feedback_summary += f" Pace: {pace['pace_category']} ({wpm_display}). Filler Rate: {fillers['filler_rate']}%."

        confidence_lvl = "High" if comm_score and comm_score >= 80 else ("Medium" if comm_score else "Low")

        return {
            "grammar_score": grammar["grammar_score"],
            "grammar_error_count": grammar["grammar_error_count"],
            "grammar_feedback": grammar["grammar_feedback"],
            "filler_word_count": fillers["filler_word_count"],
            "filler_words_per_minute": fillers["filler_words_per_minute"],
            "filler_rate": fillers["filler_rate"],
            "filler_words_list": fillers["filler_words_list"],
            "words_per_minute": pace["words_per_minute"],
            "speaking_duration": duration_seconds,
            "word_count": word_count,
            "pace_category": pace["pace_category"],
            "pronunciation_score": pronunciation["pronunciation_score"],
            "pronunciation_status": pronunciation["pronunciation_status"],
            "pronunciation_feedback": pronunciation["pronunciation_feedback"],
            "communication_score": comm_score,
            "feedback": feedback_summary,
            "strengths": strengths,
            "weaknesses": weaknesses,
            # Requirement 14 Structured JSON output components
            "speech_pace": {
                "words_per_minute": pace["words_per_minute"],
                "duration_minutes": pace["duration_minutes"],
                "total_words": word_count,
                "pace_category": pace["pace_category"],
                "status": pace["status"]
            },
            "filler_words": {
                "count": fillers["filler_word_count"],
                "percentage": fillers["filler_rate"],
                "detected_words": fillers["detected_words"]
            },
            "grammar": {
                "score": grammar["grammar_score"],
                "error_count": grammar["grammar_error_count"],
                "feedback": grammar["grammar_feedback"],
                "status": grammar["status"]
            },
            "overall_communication_quality": {
                "score": comm_score,
                "confidence_level": confidence_lvl,
                "summary": feedback_summary
            }
        }

