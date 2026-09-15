# ============================================================
#  scoring_engine.py — SmartHire Deterministic AI Scoring Engine
# ============================================================
import logging
import math
from typing import Dict, Any, List, Optional

logger = logging.getLogger("smarthire.scoring")


def get_performance_rating(score: Optional[float]) -> str:
    """
    Returns performance rating string based on actual score using exact rubric:
    90–100 → Excellent
    75–89 → Good
    60–74 → Average
    40–59 → Needs Improvement
    Below 40 → Poor
    """
    if score is None:
        return "Insufficient Data"
    
    val = float(score)
    if val >= 90.0:
        return "Excellent"
    elif val >= 75.0:
        return "Good"
    elif val >= 60.0:
        return "Average"
    elif val >= 40.0:
        return "Needs Improvement"
    else:
        return "Poor"


class RealAIScoringEngine:
    """
    Deterministic scoring engine implementing the 4 major assessment categories:
    1. Communication Score (30%)
    2. Confidence Score (25%)
    3. Technical Relevance Score (30%)
    4. Professionalism Score (15%)
    
    Weights: 0.30, 0.25, 0.30, 0.15.
    Calculates weighted unrounded score and applies rounding to display value (0-100).
    Returns 'Insufficient Data' / 'Unavailable' when data is missing.
    """

    WEIGHT_COMMUNICATION     = 0.30
    WEIGHT_CONFIDENCE        = 0.25
    WEIGHT_TECHNICAL          = 0.30
    WEIGHT_PROFESSIONALISM   = 0.15

    # ── 1. Communication Score (30%) ──────────────────────────────

    @classmethod
    def calculate_communication_score(
        cls,
        speech_clarity: Optional[float] = None,
        grammar_quality: Optional[float] = None,
        filler_words_per_minute: Optional[float] = None,
        speaking_pace_wpm: Optional[float] = None,
        response_completeness: Optional[float] = None,
        transcript_available: bool = True
    ) -> Dict[str, Any]:
        """
        Calculates Communication Score (0-100) from actual interview speech/transcript data.
        Parameters:
        A. Speech Clarity
        B. Grammar Quality
        C. Filler-word Frequency
        D. Speaking Pace
        E. Response Completeness
        """
        if not transcript_available and speech_clarity is None:
            return {
                "score": None,
                "status": "Insufficient Data",
                "speech_clarity": None,
                "grammar_quality": None,
                "filler_word_score": None,
                "speaking_pace_score": None,
                "response_completeness": None,
                "filler_words_per_minute": None,
                "speaking_pace_wpm": None,
                "feedback": "Insufficient communication data collected."
            }

        # Sub-metric 1: Speech Clarity (0-100)
        clarity_val = max(0.0, min(100.0, float(speech_clarity))) if speech_clarity is not None else None

        # Sub-metric 2: Grammar Quality (0-100)
        grammar_val = max(0.0, min(100.0, float(grammar_quality))) if grammar_quality is not None else None

        # Sub-metric 3: Filler-word Frequency (0-100)
        # Optimal: 0-2 fillers/min -> 100, 3-5 -> 80, 6-10 -> 60, >10 -> max(20, 100 - fw * 7)
        if filler_words_per_minute is not None:
            fw_wpm = max(0.0, float(filler_words_per_minute))
            filler_score = max(0.0, min(100.0, 100.0 - (fw_wpm * 6.5)))
        else:
            filler_score = None

        # Sub-metric 4: Speaking Pace Score (0-100)
        # Target: 110 - 160 WPM -> 90-100 score. <80 -> 50, >180 -> 50
        if speaking_pace_wpm is not None and speaking_pace_wpm > 0:
            wpm = float(speaking_pace_wpm)
            if 110 <= wpm <= 160:
                pace_score = 100.0 - (abs(wpm - 135) * 0.4)
            elif wpm < 110:
                pace_score = max(30.0, 50.0 + (wpm / 110.0) * 40.0)
            else:
                pace_score = max(30.0, 100.0 - ((wpm - 160) * 0.75))
            pace_score = max(0.0, min(100.0, pace_score))
        else:
            pace_score = None

        # Sub-metric 5: Response Completeness (0-100)
        completeness_val = max(0.0, min(100.0, float(response_completeness))) if response_completeness is not None else None

        # Calculate average of available components
        valid_components = [
            v for v in [clarity_val, grammar_val, filler_score, pace_score, completeness_val]
            if v is not None
        ]

        if not valid_components:
            return {
                "score": None,
                "status": "Insufficient Data",
                "speech_clarity": None,
                "grammar_quality": None,
                "filler_word_score": None,
                "speaking_pace_score": None,
                "response_completeness": None,
                "filler_words_per_minute": filler_words_per_minute,
                "speaking_pace_wpm": speaking_pace_wpm,
                "feedback": "Insufficient data to compute communication score."
            }

        raw_comm_score = sum(valid_components) / len(valid_components)

        return {
            "score": raw_comm_score,
            "status": "Available",
            "speech_clarity": clarity_val,
            "grammar_quality": grammar_val,
            "filler_word_score": filler_score,
            "speaking_pace_score": pace_score,
            "response_completeness": completeness_val,
            "filler_words_per_minute": filler_words_per_minute,
            "speaking_pace_wpm": speaking_pace_wpm,
            "feedback": f"Communication score computed at {raw_comm_score:.1f}/100 across {len(valid_components)} measured indicators."
        }

    # ── 2. Confidence Score (25%) ─────────────────────────────────

    @classmethod
    def calculate_confidence_score(
        cls,
        eye_contact_duration: Optional[float] = None,
        valid_tracking_duration: Optional[float] = None,
        attention_break_duration: Optional[float] = None,
        response_hesitation_seconds: Optional[float] = None,
        facial_engagement_score: Optional[float] = None,
        speaking_confidence_score: Optional[float] = None,
        tracking_available: bool = True
    ) -> Dict[str, Any]:
        """
        Calculates Confidence Score (0-100) using Observable Confidence Indicators.
        Parameters:
        A. Eye-contact consistency (eye_contact_duration / valid_tracking_duration)
        B. Facial engagement (face visibility & facial-expression signals)
        C. Response hesitation (delay before answer begins)
        D. Speaking confidence (measurable speech/behavior signals)
        E. Attention level (1 - attention_break_duration / valid_tracking_duration)
        """
        if not tracking_available and facial_engagement_score is None and speaking_confidence_score is None:
            return {
                "score": None,
                "status": "Insufficient Data",
                "eye_contact_consistency": None,
                "facial_engagement": None,
                "response_hesitation": None,
                "speaking_confidence": None,
                "attention_level": None,
                "confidence_indicator": "Insufficient data",
                "feedback": "Insufficient tracking data for observable confidence analysis."
            }

        # A. Eye contact consistency (0-100)
        if eye_contact_duration is not None and valid_tracking_duration is not None and valid_tracking_duration > 0:
            eye_contact_pct = min(100.0, max(0.0, (eye_contact_duration / valid_tracking_duration) * 100.0))
        else:
            eye_contact_pct = None

        # B. Facial engagement (0-100)
        eng_val = max(0.0, min(100.0, float(facial_engagement_score))) if facial_engagement_score is not None else None

        # C. Response hesitation (0-100)
        # Delay <= 2s -> 100, 3-5s -> 80, 6-10s -> 60, >10s -> 40
        if response_hesitation_seconds is not None:
            hes = float(response_hesitation_seconds)
            if hes <= 2.0:
                hesitation_score = 100.0
            elif hes <= 5.0:
                hesitation_score = max(50.0, 100.0 - (hes - 2.0) * 10.0)
            else:
                hesitation_score = max(20.0, 70.0 - (hes - 5.0) * 5.0)
        else:
            hesitation_score = None

        # D. Speaking confidence (0-100)
        spk_conf_val = max(0.0, min(100.0, float(speaking_confidence_score))) if speaking_confidence_score is not None else None

        # E. Attention level (0-100)
        if attention_break_duration is not None and valid_tracking_duration is not None and valid_tracking_duration > 0:
            attn_ratio = max(0.0, min(1.0, 1.0 - (attention_break_duration / valid_tracking_duration)))
            attention_level_pct = attn_ratio * 100.0
        else:
            attention_level_pct = None

        valid_components = [
            v for v in [eye_contact_pct, eng_val, hesitation_score, spk_conf_val, attention_level_pct]
            if v is not None
        ]

        if not valid_components:
            return {
                "score": None,
                "status": "Insufficient Data",
                "eye_contact_consistency": None,
                "facial_engagement": None,
                "response_hesitation": None,
                "speaking_confidence": None,
                "attention_level": None,
                "confidence_indicator": "Insufficient data",
                "feedback": "Insufficient camera and timing data for observable confidence indicators."
            }

        raw_conf_score = sum(valid_components) / len(valid_components)

        if raw_conf_score >= 80.0:
            indicator_text = "High Observed Confidence"
        elif raw_conf_score >= 60.0:
            indicator_text = "Moderate Observed Confidence"
        else:
            indicator_text = "Varied Attention / Hesitant"

        return {
            "score": raw_conf_score,
            "status": "Available",
            "eye_contact_consistency": eye_contact_pct,
            "facial_engagement": eng_val,
            "response_hesitation": hesitation_score,
            "speaking_confidence": spk_conf_val,
            "attention_level": attention_level_pct,
            "confidence_indicator": indicator_text,
            "feedback": f"Observable confidence indicators show an estimated index of {raw_conf_score:.1f}/100 based on measured posture, attention, and response timing."
        }

    # ── 3. Technical Relevance Score (30%) ────────────────────────

    @classmethod
    def calculate_technical_relevance_score(
        cls,
        technical_accuracy: Optional[float] = None,
        keyword_relevance: Optional[float] = None,
        problem_solving: Optional[float] = None,
        domain_knowledge: Optional[float] = None,
        answer_completeness: Optional[float] = None,
        evaluation_status: str = "completed"
    ) -> Dict[str, Any]:
        """
        Calculates Technical Relevance Score (0-100).
        Parameters:
        A. Technical Accuracy
        B. Keyword Relevance
        C. Problem-solving Ability
        D. Domain Knowledge
        E. Answer Completeness
        Formula: (accuracy + keyword + problem_solving + domain + completeness) / 5
        """
        if evaluation_status in ("unavailable", "unanswered") or all(v is None for v in [technical_accuracy, keyword_relevance, problem_solving, domain_knowledge, answer_completeness]):
            return {
                "score": None,
                "status": "Insufficient Data" if evaluation_status != "unanswered" else "Unanswered",
                "technical_accuracy": None,
                "keyword_relevance": None,
                "problem_solving": None,
                "domain_knowledge": None,
                "answer_completeness": None,
                "feedback": "Technical relevance analysis unavailable or question left unanswered."
            }

        valid_vals = [
            max(0.0, min(100.0, float(v))) for v in [
                technical_accuracy, keyword_relevance, problem_solving, domain_knowledge, answer_completeness
            ] if v is not None
        ]

        if not valid_vals:
            return {
                "score": None,
                "status": "Insufficient Data",
                "technical_accuracy": None,
                "keyword_relevance": None,
                "problem_solving": None,
                "domain_knowledge": None,
                "answer_completeness": None,
                "feedback": "Insufficient technical evaluation parameters available."
            }

        raw_tech_score = sum(valid_vals) / len(valid_vals)

        return {
            "score": raw_tech_score,
            "status": "Available",
            "technical_accuracy": max(0.0, min(100.0, float(technical_accuracy))) if technical_accuracy is not None else None,
            "keyword_relevance": max(0.0, min(100.0, float(keyword_relevance))) if keyword_relevance is not None else None,
            "problem_solving": max(0.0, min(100.0, float(problem_solving))) if problem_solving is not None else None,
            "domain_knowledge": max(0.0, min(100.0, float(domain_knowledge))) if domain_knowledge is not None else None,
            "answer_completeness": max(0.0, min(100.0, float(answer_completeness))) if answer_completeness is not None else None,
            "feedback": f"Technical relevance score evaluated at {raw_tech_score:.1f}/100 across domain concepts and accuracy."
        }

    # ── 4. Professionalism Score (15%) ────────────────────────────

    @classmethod
    def calculate_professionalism_score(
        cls,
        total_duration_seconds: int = 0,
        expected_duration_seconds: int = 1800,
        unnecessary_delays_count: int = 0,
        transcript_clarity_score: Optional[float] = None,
        unprofessional_words_detected: int = 0,
        proctoring_violations_count: int = 0,
        system_errors_count: int = 0
    ) -> Dict[str, Any]:
        """
        Calculates Professionalism Score (0-100).
        Parameters:
        A. Time management (total duration, delays, inactivity)
        B. Response organization (transcript structure & clarity)
        C. Professional communication (inappropriate/unprofessional language check)
        D. Interview etiquette (proctoring events without penalizing system errors)
        """
        # A. Time management (0-100)
        time_score = 100.0 - (unnecessary_delays_count * 10.0)
        if expected_duration_seconds > 0 and total_duration_seconds > 0:
            ratio = total_duration_seconds / expected_duration_seconds
            if ratio > 1.5:  # excessive length
                time_score -= (ratio - 1.5) * 20.0
        time_score = max(30.0, min(100.0, time_score))

        # B. Response organization (0-100)
        org_score = max(0.0, min(100.0, float(transcript_clarity_score))) if transcript_clarity_score is not None else 85.0

        # C. Professional communication (0-100)
        comm_prof_score = max(0.0, min(100.0, 100.0 - (unprofessional_words_detected * 25.0)))

        # D. Interview etiquette (0-100) - ignore system errors
        genuine_violations = max(0, proctoring_violations_count - system_errors_count)
        etiquette_score = max(30.0, min(100.0, 100.0 - (genuine_violations * 8.0)))

        prof_score = round(
            (time_score * 0.25) +
            (org_score * 0.25) +
            (comm_prof_score * 0.25) +
            (etiquette_score * 0.25),
            2
        )

        return {
            "score": prof_score,
            "status": "Available",
            "time_management": time_score,
            "response_organization": org_score,
            "professional_communication": comm_prof_score,
            "interview_etiquette": etiquette_score,
            "feedback": f"Professionalism score evaluated at {prof_score:.1f}/100 considering time management, structure, and etiquette."
        }

    # ── 5. Overall Score & Aggregation ─────────────────────────────

    @classmethod
    def calculate_overall_score(
        cls,
        communication_score: Optional[float],
        confidence_score: Optional[float],
        technical_relevance_score: Optional[float],
        professionalism_score: Optional[float]
    ) -> Dict[str, Any]:
        """
        Calculates final weighted overall score:
        Overall Score = (Communication × 0.30) + (Confidence × 0.25) + (Technical Relevance × 0.30) + (Professionalism × 0.15)
        Does NOT round individual component values prematurely.
        Only rounds the final display value.
        """
        valid_components = []

        if communication_score is not None:
            valid_components.append(("communication", float(communication_score), cls.WEIGHT_COMMUNICATION))

        if confidence_score is not None:
            valid_components.append(("confidence", float(confidence_score), cls.WEIGHT_CONFIDENCE))

        if technical_relevance_score is not None:
            valid_components.append(("technical", float(technical_relevance_score), cls.WEIGHT_TECHNICAL))

        if professionalism_score is not None:
            valid_components.append(("professionalism", float(professionalism_score), cls.WEIGHT_PROFESSIONALISM))

        if len(valid_components) < 2:
            return {
                "overall_score": None,
                "overall_display_score": None,
                "performance_rating": "Insufficient Data",
                "communication_score": communication_score,
                "confidence_score": confidence_score,
                "technical_relevance_score": technical_relevance_score,
                "professionalism_score": professionalism_score,
                "feedback": "Insufficient category data collected to calculate a reliable overall score (minimum 2 categories required)."
            }

        # Calculate exact weighted sum dynamically adjusting weights if any component is missing
        total_weight = sum(w for _, _, w in valid_components)
        unrounded_overall = sum(val * w for _, val, w in valid_components) / total_weight

        # Bounded between 0 and 100
        bounded_overall = max(0.0, min(100.0, unrounded_overall))
        display_overall = round(bounded_overall, 2)

        rating = get_performance_rating(display_overall)

        comm_w = round((communication_score or 0) * cls.WEIGHT_COMMUNICATION, 2)
        conf_w = round((confidence_score or 0) * cls.WEIGHT_CONFIDENCE, 2)
        tech_w = round((technical_relevance_score or 0) * cls.WEIGHT_TECHNICAL, 2)
        prof_w = round((professionalism_score or 0) * cls.WEIGHT_PROFESSIONALISM, 2)

        return {
            "overall_score": bounded_overall,
            "overall_display_score": display_overall,
            "status": "Available",
            "performance_rating": rating,
            "communication_score": communication_score,
            "communication_weighted": comm_w,
            "confidence_score": confidence_score,
            "confidence_weighted": conf_w,
            "technical_relevance_score": technical_relevance_score,
            "technical_relevance_weighted": tech_w,
            "professionalism_score": professionalism_score,
            "professionalism_weighted": prof_w,
            "feedback": f"Overall weighted candidate score calculated at {display_overall}/100 with a rating of '{rating}'."
        }

    # ── 6. Synthesize AI Feedback ──────────────────────────────────

    @classmethod
    def synthesize_ai_feedback(
        cls,
        question_evaluations: List[Dict[str, Any]],
        comm_res: Dict[str, Any],
        conf_res: Dict[str, Any],
        tech_res: Dict[str, Any],
        prof_res: Dict[str, Any],
        domain: str = "General",
        job_role: str = "Candidate"
    ) -> Dict[str, List[str]]:
        """
        Generates structured AI feedback referencing actual candidate interview performance:
        1. Strengths
        2. Weaknesses
        3. Improvement Suggestions
        4. Practice Recommendations
        5. Learning Resources
        """
        strengths = []
        weaknesses = []
        suggestions = []
        practice = []
        resources = []

        # Check if candidate provided any actual transcript / answers
        has_answers = False
        for q_ev in question_evaluations:
            u_ans = q_ev.get("user_answer") or q_ev.get("transcript") or ""
            if u_ans and u_ans.strip():
                has_answers = True

        # Collect from question-level evaluations
        for q_ev in question_evaluations:
            for s in q_ev.get("strengths", []):
                if s and s != "Insufficient Data" and s not in strengths: strengths.append(s)
            for w in q_ev.get("weaknesses", []):
                if w and w != "Insufficient Data" and w not in weaknesses: weaknesses.append(w)
            for imp in q_ev.get("improvement_suggestions", []):
                if imp and imp != "Insufficient Data" and imp not in suggestions: suggestions.append(imp)
            for pr in q_ev.get("practice_recommendations", []):
                if pr and pr != "Insufficient Data" and pr not in practice: practice.append(pr)
            for res in q_ev.get("learning_resources", []):
                if res and res != "Insufficient Data" and res not in resources: resources.append(res)

        # Synthesize metric-level insights
        comm_score = comm_res.get("score") if comm_res else None
        if comm_score is not None:
            if comm_score >= 80.0:
                strengths.append(f"Demonstrated clear verbal communication with solid speaking pace ({comm_res.get('speaking_pace_wpm', 130)} WPM).")
            elif comm_score < 65.0:
                weaknesses.append(f"Elevated filler-word usage ({comm_res.get('filler_words_per_minute', 0)} fillers/min) affected delivery clarity.")
                suggestions.append("Practice structured pause techniques to eliminate vocal filler words during technical explanations.")

        conf_score = conf_res.get("score") if conf_res else None
        if conf_score is not None:
            if conf_score >= 80.0:
                strengths.append("Maintained consistent webcam eye contact and steady camera engagement throughout responses.")
            elif conf_score < 65.0:
                weaknesses.append("Observable eye contact and attention indicators showed frequent pauses and looking-away events.")
                suggestions.append("Maintain direct eye contact with the camera lens when presenting core technical concepts.")

        tech_score = tech_res.get("score") if tech_res else None
        if tech_score is not None:
            if tech_score >= 80.0:
                strengths.append(f"Displayed strong technical accuracy and domain depth across key {domain} topics.")
            elif tech_score < 65.0:
                weaknesses.append(f"Technical responses lacked depth in edge-case handling and {domain} system architecture details.")
                suggestions.append(f"Review core {domain} concepts and practice step-by-step technical problem solving.")

        # Ensure fallback feedback items reference actual domain if arrays are sparse
        if not strengths:
            if has_answers and tech_score is not None and tech_score >= 70:
                strengths.append(f"Answered assigned {domain} questions within expected time constraints with clear intent.")
            else:
                strengths.append("Insufficient Data")

        if not weaknesses:
            if has_answers and tech_score is not None and tech_score < 75:
                weaknesses.append(f"Answers could be enhanced by including more specific real-world {domain} system examples.")
            else:
                weaknesses.append("Insufficient Data")

        if not suggestions:
            if has_answers and weaknesses and weaknesses[0] != "Insufficient Data":
                suggestions.append(f"Practice 5 target {domain} interview questions using the STAR framework.")
            else:
                suggestions.append("Insufficient Data")

        if not practice:
            if has_answers:
                practice.append(f"Practice technical explanations for {job_role} / {domain} concepts with mock interview sessions.")
            else:
                practice.append("Insufficient Data")

        if not resources:
            if has_answers and domain and domain != "General":
                resources.append(f"Official {domain} Documentation & Technical Best Practices")
            else:
                resources.append("Insufficient Data")

        return {
            "strengths": strengths[:5],
            "weaknesses": weaknesses[:5],
            "improvement_suggestions": suggestions[:5],
            "practice_recommendations": practice[:5],
            "learning_resources": resources[:5]
        }


# Alias for backward compatibility
DeterministicScoringEngine = RealAIScoringEngine

