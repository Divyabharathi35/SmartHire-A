# ============================================================
#  ai_service.py — AI Interview Question & Evaluation Service
# ============================================================
import json
import logging
import random
import httpx
from typing import Any, Dict, List
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger("smarthire.ai")

# ── Centralized Gemini Model Configuration ────────────────────
# Ordered working-first. gemini-3.6-flash is confirmed working with status 200.
# The model loop tries each in order.
GEMINI_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
]


class AIService:
    """
    Reusable AI service powered exclusively by Google Gemini.
    """
    _last_gemini_status: str | None = None
    _last_gemini_model: str | None = None

    @classmethod
    def get_gemini_api_key(cls) -> str:
        """
        Retrieves Gemini API key from admin configuration, settings, or environment variables.
        """
        import os
        admin_key = ""
        try:
            from app.routers.admin import _ai_config
            if isinstance(_ai_config, dict):
                admin_key = _ai_config.get("gemini_api_key", "")
        except Exception:
            pass

        key = (
            admin_key or
            settings.GEMINI_API_KEY or 
            os.environ.get("GEMINI_API_KEY", "") or 
            os.environ.get("GOOGLE_API_KEY", "") or 
            ""
        ).strip()
        return key


    @classmethod
    async def check_gemini_health(cls) -> Dict[str, Any]:
        """
        Checks status and reachability of primary Gemini provider.
        """
        key = cls.get_gemini_api_key()
        preferred_model = GEMINI_MODELS[0]

        if not key:
            return {
                "configured": False,
                "reachable": False,
                "current_model": preferred_model,
                "last_error_category": cls._last_gemini_status or "API_KEY_MISSING",
                "status": "not_configured"
            }

        if cls._last_gemini_status and cls._last_gemini_status != "operational":
            return {
                "configured": True,
                "reachable": False,
                "current_model": cls._last_gemini_model or preferred_model,
                "last_error_category": cls._last_gemini_status,
                "status": cls._last_gemini_status.lower()
            }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{preferred_model}?key={key}"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    cls._last_gemini_status = "operational"
                    cls._last_gemini_model = preferred_model
                    return {
                        "configured": True,
                        "reachable": True,
                        "current_model": preferred_model,
                        "last_error_category": None,
                        "status": "operational"
                    }
                else:
                    err_cat = cls._classify_gemini_error(res.status_code, res.text) or "API_ERROR"
                    cls._last_gemini_status = err_cat
                    return {
                        "configured": True,
                        "reachable": False,
                        "current_model": preferred_model,
                        "last_error_category": err_cat,
                        "status": err_cat.lower()
                    }
        except Exception as e:
            cls._last_gemini_status = "NETWORK_ERROR"
            return {
                "configured": True,
                "reachable": False,
                "current_model": preferred_model,
                "last_error_category": "NETWORK_ERROR",
                "status": "network_error"
            }

    @classmethod
    def _filter_hr_questions_if_needed(cls, questions: List[Dict[str, Any]], interview_type: str, num_questions: int) -> List[Dict[str, Any]]:
        if interview_type == "HR Interview" or "hr" in interview_type.lower():
            tech_keywords = [
                "coding", "programming", "algorithm", "data structure", "system design",
                "sql", "database", "api", "react", "javascript", "python", "memory leak",
                "memory management", "debugging", "microservice", "architecture", "restful",
                "async i/o", "concurrency", "thread", "process", "compiler", "query optimization"
            ]
            valid_questions = []
            for q in questions:
                q_text = q.get("question_text", "").lower()
                if not any(kw in q_text for kw in tech_keywords):
                    valid_questions.append(q)
                else:
                    logger.warning(f"[AI Service] Filtered out technical question from HR interview: {q.get('question_text')}")

            for idx, q in enumerate(valid_questions, 1):
                q["question_number"] = idx
                q["interview_type"] = "HR Interview"
            return valid_questions[:num_questions]
        return questions

    @classmethod
    def _classify_gemini_error(cls, status_code: int, response_text: str) -> str | None:
        """
        Classify a Gemini API error into a safe, user-facing error category.
        Returns one of: QUOTA_EXCEEDED, AUTHENTICATION_FAILED, MODEL_UNAVAILABLE,
        API_ERROR, or None (for 404/503 model-not-found/overloaded which should trigger next model).
        """
        text_lower = response_text.lower() if response_text else ""
        if status_code == 429 or any(kw in text_lower for kw in ["quota", "rate limit", "resource_exhausted", "resourceexhausted"]):
            return "QUOTA_EXCEEDED"
        if status_code in (401, 403) or any(kw in text_lower for kw in ["unauthorized", "forbidden", "invalid api key", "api key not valid"]):
            return "AUTHENTICATION_FAILED"
        if status_code == 404:
            # 404 means model-not-found — try next model in priority order
            return None
        if status_code == 503 and any(kw in text_lower for kw in ["high demand", "overloaded"]):
            # 503 with high demand means this specific model is overloaded — try next model
            return None
        if status_code == 400:
            if "api key" in text_lower or "key" in text_lower:
                return "AUTHENTICATION_FAILED"
            return "API_ERROR"

        return "API_ERROR"

    @classmethod
    async def generate_interview_questions(
        cls,
        job_role: str,
        domain: str,
        interview_type: str,
        difficulty: str,
        num_questions: int = 5,
        user_skills: str | None = None,
        job_description: str | None = None,
        resume_text: str | None = None,
        generation_seed: str | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate interview questions using Gemini (sole LLM provider).
        Raises 503 Service Unavailable if Gemini fails.
        """
        gemini_key = cls.get_gemini_api_key()
        gemini_error_category = None

        # 0. Check if API key is configured at all
        if not gemini_key:
            gemini_error_category = "API_KEY_MISSING"
            logger.warning("[AIService] No Gemini API key configured.")
        else:
            # 1. Try Gemini API
            try:
                questions, error_cat = await cls._generate_with_gemini(
                    job_role, domain, interview_type, difficulty, num_questions, user_skills, job_description, resume_text, gemini_key, generation_seed
                )
                if questions and len(questions) > 0:
                    filtered = cls._filter_hr_questions_if_needed(questions, interview_type, num_questions)
                    for q in filtered:
                        q["provider"] = "gemini"
                        q["ai_provider"] = "gemini"
                        q["ai_model"] = q.get("model", GEMINI_MODELS[0])
                        q["fallback_used"] = False
                    return filtered
                gemini_error_category = error_cat or "MODEL_UNAVAILABLE"
            except Exception as e:
                logger.warning(f"[AIService] Gemini question generation failed: {e}")
                gemini_error_category = "API_ERROR"

        error_messages = {
            "QUOTA_EXCEEDED": "AI quota exceeded. Gemini API rate limit reached. Please wait a few minutes and try again.",
            "AUTHENTICATION_FAILED": "AI authentication failed. The Gemini API key is invalid or has been revoked. Please update the API key in Admin settings.",
            "API_KEY_MISSING": "AI API key missing. No Gemini API key is configured. Please add a valid API key in Admin AI settings.",
            "MODEL_UNAVAILABLE": "AI model unavailable. None of the configured Gemini models are accessible. Please check your API plan or contact support.",
            "TIMEOUT": "AI service timeout. The Gemini API did not respond in time. Please try again.",
            "NETWORK_ERROR": "AI network error. Could not connect to the Gemini API. Please check your internet connection.",
            "API_ERROR": "AI service error. The Gemini API returned an unexpected error. Please try again later.",
        }
        detail = error_messages.get(gemini_error_category, "AI service error. Please try again later.")

        logger.error(f"[AIService] Gemini AI provider failed: {gemini_error_category}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )

    @classmethod
    async def evaluate_answer(
        cls,
        question_text: str,
        user_answer: str,
        interview_type: str,
        difficulty: str,
        expected_points: List[str] | None = None,
        job_role: str | None = None,
        domain: str | None = None,
    ) -> Dict[str, Any]:
        """
        Evaluates candidate answer using Gemini AI API (sole provider).
        Validates response strictly with Pydantic StructuredAIEvaluation.
        Returns 'AI evaluation unavailable' status if Gemini fails.
        """
        from app.schemas import StructuredAIEvaluation

        if not user_answer or not user_answer.strip():
            return {
                "status": "unanswered",
                "message": "Unanswered question — score not calculated",
                "technical_accuracy": None,
                "keyword_relevance": None,
                "problem_solving": None,
                "domain_knowledge": None,
                "answer_completeness": None,
                "communication": None,
                "confidence_indicators": None,
                "professionalism": None,
                "strengths": [],
                "weaknesses": ["Question was left unanswered by the candidate."],
                "improvement_suggestions": [],
                "practice_recommendations": [],
                "learning_resources": []
            }

        prompt = f"""Evaluate this interview answer based strictly on candidate performance.
Question: {question_text}
Candidate Answer: {user_answer}
Job Role: {job_role or 'General'}
Domain: {domain or 'General'}
Interview Type: {interview_type}
Difficulty: {difficulty}
Expected Key Points: {json.dumps(expected_points or [])}

Evaluate candidate performance and output ONLY a valid JSON object matching this exact schema:
{{
  "technical_accuracy": <number 0-100>,
  "keyword_relevance": <number 0-100>,
  "problem_solving": <number 0-100>,
  "domain_knowledge": <number 0-100>,
  "answer_completeness": <number 0-100>,
  "communication": <number 0-100>,
  "confidence_indicators": <number 0-100>,
  "professionalism": <number 0-100>,
  "strengths": ["<specific strength point referencing answer>"],
  "weaknesses": ["<specific weakness point referencing answer>"],
  "improvement_suggestions": ["<actionable suggestion>"],
  "practice_recommendations": ["<specific topic practice task>"],
  "learning_resources": ["<specific technical learning resource>"]
}}"""

        gemini_key = cls.get_gemini_api_key()

        # Try Gemini API
        if gemini_key:
            try:
                for model_name in GEMINI_MODELS:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    async with httpx.AsyncClient(timeout=20.0) as client:
                        res = await client.post(url, json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"response_mime_type": "application/json"}
                        })
                        if res.status_code == 200:
                            data = res.json()
                            candidates = data.get("candidates", [])
                            if candidates and "content" in candidates[0]:
                                parts = candidates[0]["content"].get("parts", [])
                                if parts and "text" in parts[0]:
                                    raw_text = parts[0]["text"].replace("```json", "").replace("```", "").strip()
                                    parsed = json.loads(raw_text)
                                    validated = StructuredAIEvaluation.model_validate(parsed)
                                    result_dict = validated.model_dump()
                                    result_dict["status"] = "completed"
                                    result_dict["provider"] = f"gemini ({model_name})"
                                    result_dict["ai_provider"] = "gemini"
                                    result_dict["ai_model"] = model_name
                                    result_dict["fallback_used"] = False
                                    result_dict["user_answer"] = user_answer
                                    result_dict["question_text"] = question_text
                                    cls._last_gemini_status = "operational"
                                    cls._last_gemini_model = model_name
                                    return result_dict
                        else:
                            error_cat = cls._classify_gemini_error(res.status_code, res.text)
                            if error_cat:  # Hard error — stop trying Gemini models
                                cls._last_gemini_status = error_cat
                                logger.warning(f"[AIService] Gemini {error_cat} on evaluate_answer ({model_name}): {res.text[:150]}")
                                break
                            logger.info(f"[AIService] Model '{model_name}' not available for evaluate_answer, trying next...")
            except httpx.TimeoutException:
                cls._last_gemini_status = "TIMEOUT"
                logger.warning("[AIService] Gemini evaluation timed out.")
            except httpx.ConnectError:
                cls._last_gemini_status = "NETWORK_ERROR"
                logger.warning("[AIService] Gemini evaluation network error.")
            except Exception as e:
                cls._last_gemini_status = "API_ERROR"
                logger.warning(f"[AIService] Gemini evaluation failed: {e}")

        # If Gemini fails or is unconfigured
        logger.error(f"[AIService] Gemini AI evaluation unavailable. Status: {cls._last_gemini_status}")
        return {
            "status": "unavailable",
            "provider": "unavailable",
            "ai_provider": None,
            "ai_model": None,
            "fallback_used": False,
            "error": f"AI service unavailable ({cls._last_gemini_status or 'UNAVAILABLE'})",
            "message": "AI evaluation unavailable.",
            "technical_accuracy": None,
            "keyword_relevance": None,
            "problem_solving": None,
            "domain_knowledge": None,
            "answer_completeness": None,
            "communication": None,
            "confidence_indicators": None,
            "professionalism": None,
            "strengths": [],
            "weaknesses": ["AI evaluation service was unavailable during assessment."],
            "improvement_suggestions": [],
            "practice_recommendations": [],
            "learning_resources": [],
            "user_answer": user_answer,
            "question_text": question_text
        }

    @classmethod
    async def generate_session_feedback(
        cls,
        job_role: str,
        domain: str,
        interview_type: str,
        difficulty: str,
        total_duration: int,
        answered_count: int,
        total_questions: int,
        question_evaluations: List[Dict[str, Any]],
        comm_res: Dict[str, Any] | None = None,
        conf_res: Dict[str, Any] | None = None,
        tech_res: Dict[str, Any] | None = None,
        prof_res: Dict[str, Any] | None = None,
        experience_level: str | None = None,
        overall_res: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Generates holistic, performance-grounded AI feedback for an entire interview session.
        Uses Gemini API as sole LLM provider.
        Returns structured dict with keys: status ('available'/'unavailable'), strengths, weaknesses,
        improvement_suggestions, practice_recommendations, learning_resources, ai_provider, ai_model, generated_at.
        Returns status 'unavailable' if no candidate transcript/answer evidence is available or if Gemini fails.
        """
        from datetime import datetime, timezone

        unavailable_response = {
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

        # Check if candidate provided any actual answer text
        has_transcript_evidence = False
        answers_summary = []
        for idx, q_ev in enumerate(question_evaluations, 1):
            u_ans = q_ev.get("user_answer") or q_ev.get("transcript") or ""
            if u_ans and u_ans.strip():
                has_transcript_evidence = True
                q_text = q_ev.get("question_text", f"Question {idx}")
                score = q_ev.get("score") or q_ev.get("technical_accuracy") or "N/A"
                strengths_q = q_ev.get("strengths", [])
                weaknesses_q = q_ev.get("weaknesses", [])
                answers_summary.append(
                    f"Q{idx} ({q_text}):\nCandidate Transcript: \"{u_ans.strip()}\"\nScore: {score}\nEvaluated Strengths: {json.dumps(strengths_q)}\nEvaluated Weaknesses: {json.dumps(weaknesses_q)}"
                )

        if not has_transcript_evidence or answered_count == 0:
            return unavailable_response

        answers_text = "\n\n".join(answers_summary)
        comm_score = comm_res.get("score") if comm_res else "N/A"
        wpm = comm_res.get("speaking_pace_wpm") if comm_res else "N/A"
        fillers = comm_res.get("filler_words_per_minute") if comm_res else "N/A"
        grammar = comm_res.get("grammar_quality") if comm_res else "N/A"
        conf_score = conf_res.get("score") if conf_res else "N/A"
        eye_contact = conf_res.get("eye_contact_consistency") if conf_res else "N/A"
        tech_score = tech_res.get("score") if tech_res else "N/A"
        prof_score = prof_res.get("score") if prof_res else "N/A"
        overall_display = overall_res.get("overall_display_score") if overall_res else "N/A"
        rating = overall_res.get("performance_rating") if overall_res else "N/A"

        prompt = f"""You are an expert AI Technical Interviewer evaluating candidate performance based strictly on actual interview evidence.

Session Metadata:
- Target Job Role: {job_role}
- Domain: {domain}
- Experience Level: {experience_level or 'Not specified'}
- Interview Type: {interview_type} (Difficulty: {difficulty})
- Total Duration: {total_duration} seconds
- Questions Completed: {answered_count} / {total_questions}
- Overall Display Score: {overall_display}% (Rating: {rating})

Category Breakdown & Measured Metrics:
- Communication Score: {comm_score}/100 (Pace: {wpm} WPM, Fillers: {fillers}/min, Grammar: {grammar}/100)
- Confidence Score: {conf_score}/100 (Eye Contact Consistency: {eye_contact}%)
- Technical Relevance Score: {tech_score}/100
- Professionalism Score: {prof_score}/100

Candidate Transcripts & Question Analytics:
{answers_text}

STRICT GROUNDING INSTRUCTIONS:
1. Do not invent candidate behavior, skills, or achievements.
2. Only make claims supported by the supplied interview evidence, transcripts, and scores.
3. If evidence is insufficient for any feedback category, return an empty array [] for that category.
4. Output ONLY a valid JSON object matching this exact schema:
{{
  "strengths": ["<grounded strength item>"],
  "weaknesses": ["<grounded weakness item>"],
  "improvement_suggestions": ["<actionable suggestion>"],
  "practice_recommendations": ["<practice topic task>"],
  "learning_resources": ["<specific resource for domain {domain}>"]
}}"""

        gemini_key = cls.get_gemini_api_key()

        # 1. Primary: Try Gemini API
        if gemini_key:
            try:
                for model_name in GEMINI_MODELS:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    async with httpx.AsyncClient(timeout=20.0) as client:
                        res = await client.post(url, json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"response_mime_type": "application/json"}
                        })
                        if res.status_code == 200:
                            data = res.json()
                            candidates = data.get("candidates", [])
                            if candidates and "content" in candidates[0]:
                                parts = candidates[0]["content"].get("parts", [])
                                if parts and "text" in parts[0]:
                                    raw_text = parts[0]["text"].replace("```json", "").replace("```", "").strip()
                                    parsed = json.loads(raw_text)
                                    if isinstance(parsed, dict) and "strengths" in parsed:
                                        now_iso = datetime.now(timezone.utc).isoformat()
                                        cls._last_gemini_status = "operational"
                                        cls._last_gemini_model = model_name
                                        return {
                                            "status": "available",
                                            "strengths": [str(s) for s in parsed.get("strengths", []) if s and str(s).strip().lower() != "insufficient data"],
                                            "weaknesses": [str(w) for w in parsed.get("weaknesses", []) if w and str(w).strip().lower() != "insufficient data"],
                                            "improvement_suggestions": [str(i) for i in parsed.get("improvement_suggestions", []) if i and str(i).strip().lower() != "insufficient data"],
                                            "practice_recommendations": [str(p) for p in parsed.get("practice_recommendations", []) if p and str(p).strip().lower() != "insufficient data"],
                                            "learning_resources": [str(r) for r in parsed.get("learning_resources", []) if r and str(r).strip().lower() != "insufficient data"],
                                            "ai_provider": "gemini",
                                            "ai_model": model_name,
                                            "fallback_used": False,
                                            "generated_at": now_iso
                                        }
                        else:
                            error_cat = cls._classify_gemini_error(res.status_code, res.text)
                            if error_cat:  # Hard error — stop trying Gemini models
                                cls._last_gemini_status = error_cat
                                logger.warning(f"[AIService] Gemini {error_cat} on session_feedback ({model_name}): {res.text[:150]}")
                                break
                            logger.info(f"[AIService] Model '{model_name}' not available for session_feedback, trying next...")
            except httpx.TimeoutException:
                cls._last_gemini_status = "TIMEOUT"
                logger.warning("[AIService] Gemini session feedback timed out.")
            except httpx.ConnectError:
                cls._last_gemini_status = "NETWORK_ERROR"
                logger.warning("[AIService] Gemini session feedback network error.")
            except Exception as e:
                cls._last_gemini_status = "API_ERROR"
                logger.warning(f"[AIService] Gemini session feedback generation failed: {e}")

        return unavailable_response



    @classmethod
    async def transcribe_audio(
        cls,
        audio_bytes: bytes,
        mime_type: str = "audio/webm"
    ) -> Dict[str, Any]:
        """
        Transcribes candidate audio recording using Gemini AI API with base64 inline audio data.
        Returns dict with keys: transcript, transcription_status ('completed'/'failed'/'unavailable'), word_count, confidence_score.
        """
        if not audio_bytes or len(audio_bytes) < 100:
            return {
                "transcript": "",
                "transcription_status": "unavailable",
                "word_count": 0,
                "confidence_score": 0.0
            }

        gemini_key = cls.get_gemini_api_key()
        if not gemini_key:
            return {
                "transcript": "",
                "transcription_status": "unavailable",
                "word_count": 0,
                "confidence_score": 0.0
            }

        import base64
        try:
            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            clean_mime = mime_type.split(";")[0].strip() if mime_type else "audio/webm"

            prompt_text = "Transcribe the spoken candidate answer accurately. Return JSON format strictly: {\"transcript\": \"<exact spoken text>\", \"confidence_score\": 0.95}. Do not include Markdown blocks."
            payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "inline_data": {
                                    "mime_type": clean_mime,
                                    "data": b64_audio
                                }
                            },
                            {"text": prompt_text}
                        ]
                    }
                ],
                "generationConfig": {"response_mime_type": "application/json"}
            }

            for model_name in GEMINI_MODELS:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                async with httpx.AsyncClient(timeout=25.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                raw_text = parts[0]["text"].replace("```json", "").replace("```", "").strip()
                                parsed = json.loads(raw_text)
                                tr_text = (parsed.get("transcript") or "").strip()
                                words = re.findall(r"\b[\w']+\b", tr_text)
                                conf = float(parsed.get("confidence_score") or 0.90)
                                return {
                                    "transcript": tr_text,
                                    "transcription_status": "completed" if tr_text else "unavailable",
                                    "word_count": len(words),
                                    "confidence_score": conf
                                }
                    else:
                        error_cat = cls._classify_gemini_error(res.status_code, res.text)
                        if error_cat:  # Hard error — stop trying models
                            logger.warning(f"[AIService] Gemini {error_cat} on transcribe_audio ({model_name}): {res.text[:150]}")
                            break
                        logger.info(f"[AIService] Model '{model_name}' not available for transcribe_audio, trying next...")
        except httpx.TimeoutException:
            logger.warning("[AIService] Audio transcription via Gemini timed out.")
        except httpx.ConnectError:
            logger.warning("[AIService] Audio transcription network error.")
        except Exception as e:
            logger.warning(f"[AIService] Audio transcription via Gemini failed: {e}")

        return {
            "transcript": "",
            "transcription_status": "failed",
            "word_count": 0,
            "confidence_score": 0.0
        }

    # ── AI Provider Implementations ───────────────────────────

    @classmethod
    async def _generate_with_gemini(cls, job_role, domain, interview_type, difficulty, num_questions, user_skills, job_description, resume_text, gemini_key: str, generation_seed: str | None = None):
        """
        Tries Gemini models in priority order. Returns (questions, error_category) tuple.
        - questions: list of question dicts or None
        - error_category: str error category if all models failed, None if questions returned
        Only continues to next model on 404 (model-not-found).
        Immediately halts on quota/auth/other hard errors.
        """
        logger.info(f"[Gemini AI] Request received: Role='{job_role}', Domain='{domain}', Type='{interview_type}', Difficulty='{difficulty}', Seed='{generation_seed}'")
        prompt = cls._build_prompt(job_role, domain, interview_type, difficulty, num_questions, user_skills, job_description, resume_text, generation_seed)

        last_error_category = None

        for model_name in GEMINI_MODELS:
            logger.info(f"[Gemini AI] Trying Gemini model: '{model_name}'")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"

            payloads = [
                {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"response_mime_type": "application/json"}},
                {"contents": [{"parts": [{"text": prompt}]}]}
            ]

            for payload in payloads:
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        res = await client.post(url, json=payload)
                        logger.info(f"[Gemini AI] Model '{model_name}' response status: {res.status_code}")

                        if res.status_code == 200:
                            data = res.json()
                            candidates = data.get('candidates', [])
                            if candidates and 'content' in candidates[0]:
                                parts = candidates[0]['content'].get('parts', [])
                                if parts and 'text' in parts[0]:
                                    raw_text = parts[0]['text']
                                    questions = cls._parse_json_questions(raw_text, interview_type, domain, difficulty)
                                    if questions:
                                        logger.info(f"[Gemini AI] Success! Generated {len(questions)} questions using model '{model_name}'")
                                        cls._last_gemini_status = "operational"
                                        cls._last_gemini_model = model_name
                                        for q in questions:
                                            q["model"] = model_name
                                        return questions, None
                                    else:
                                        logger.warning(f"[Gemini AI] JSON parsing failure for model '{model_name}' output")
                        else:
                            error_cat = cls._classify_gemini_error(res.status_code, res.text)
                            if error_cat:
                                # Hard error (quota/auth/api) — stop immediately, do not try more models
                                cls._last_gemini_status = error_cat
                                logger.warning(f"[Gemini AI] {error_cat} on model '{model_name}': {res.text[:200]}")
                                return None, error_cat
                            # 404 model-not-found — try next model
                            logger.info(f"[Gemini AI] Model '{model_name}' not found (404), trying next...")
                            last_error_category = "MODEL_UNAVAILABLE"
                            break  # Skip second payload for this model, move to next model

                except httpx.TimeoutException:
                    logger.warning(f"[Gemini AI] Timeout calling model '{model_name}'")
                    cls._last_gemini_status = "TIMEOUT"
                    return None, "TIMEOUT"
                except httpx.ConnectError:
                    logger.warning(f"[Gemini AI] Network error calling model '{model_name}'")
                    cls._last_gemini_status = "NETWORK_ERROR"
                    return None, "NETWORK_ERROR"
                except Exception as e:
                    logger.warning(f"[Gemini AI] Error calling model '{model_name}': {e}")
                    cls._last_gemini_status = "API_ERROR"
                    last_error_category = "API_ERROR"

        return None, last_error_category or "MODEL_UNAVAILABLE"



    @classmethod
    def _build_prompt(cls, job_role, domain, interview_type, difficulty, num_questions, user_skills, job_description, resume_text, generation_seed: str | None = None):
        import time
        entropy_token = generation_seed or f"{time.time()}_{random.randint(10000, 99999)}"

        is_hr = interview_type == "HR Interview" or "hr" in interview_type.lower()
        is_behavioral = interview_type == "Behavioral Interview" or "behavioral" in interview_type.lower()
        is_aptitude = interview_type == "Aptitude Interview" or "aptitude" in interview_type.lower()

        if is_hr:
            type_rules = """
Interview Type: HR Interview

You MUST generate questions specifically for this interview type.
Do not generate questions from another interview type.

If Interview Type is HR, generate ONLY HR/non-technical questions such as:
- Tell me about yourself.
- Why do you want to join this company?
- What are your strengths and weaknesses?
- Describe a conflict you handled at work.
- How do you handle pressure and deadlines?
- Describe a leadership/teamwork experience.
- Where do you see yourself in five years?
- Why should we hire you?

Never generate programming, coding, algorithms, system design, database, API, memory management, or other technical questions for HR interviews.
Even though the candidate's job role may be technical (e.g. Developer/Engineer), every single HR question MUST be purely non-technical and focused on career background, culture fit, and workplace behavior.
"""
        elif is_behavioral:
            type_rules = """
Interview Type: Behavioral Interview

You MUST generate questions specifically for this interview type.
Do not generate questions from another interview type.

Generate ONLY behavioral and situational questions focused on communication, teamwork, leadership, conflict resolution, problem solving, adaptability, and managing priorities using the STAR framework.
"""
        elif is_aptitude:
            type_rules = """
Interview Type: Aptitude Interview

You MUST generate questions specifically for this interview type.
Do not generate questions from another interview type.

Generate ONLY quantitative reasoning, logical deduction, numerical, and verbal reasoning questions. Do NOT ask programming language syntax questions.
"""
        else:
            type_rules = f"""
Interview Type: Technical Interview

You MUST generate questions specifically for this interview type.
Generate technical questions relevant to the selected job role ({job_role}), domain ({domain}), and skills ({user_skills or 'core skills'}).
"""

        return f"""You are an expert interviewer and hiring manager.
Generate exactly {num_questions} tailored, fresh, and completely unique interview questions for a candidate.
Generation Entropy Seed: {entropy_token}

Selected Interview Configuration:
- Job Role: {job_role}
- Domain: {domain}
- Interview Type: {interview_type}
- Difficulty Level: {difficulty}
- Candidate Skills: {user_skills or 'Standard domain skills'}
- Job Description: {job_description or 'Standard industry expectations'}
- Candidate Resume / Background: {resume_text or 'Standard experience'}

{type_rules}

CRITICAL INSTRUCTION:
Every question MUST strictly belong to the specified Interview Type: "{interview_type}".
Respond ONLY with a valid JSON array of objects. Do NOT wrap in markdown or add conversational text.

Format:
[
  {{
    "question_number": 1,
    "question_text": "<Clear, engaging question strictly matching {interview_type}>",
    "category": "<Specific category>",
    "expected_answer_points": ["<Key point 1>", "<Key point 2>", "<Key point 3>"],
    "sample_answer": "<Concise model answer>"
  }}
"""

    @classmethod
    def _parse_json_questions(cls, raw_text: str, interview_type: str, domain: str, difficulty: str) -> List[Dict[str, Any]]:

        if not raw_text:
            return []
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        
        items = None
        try:
            items = json.loads(cleaned)
        except Exception:
            pass

        if items is None:
            start = cleaned.find("[")
            end = cleaned.rfind("]")
            if start != -1 and end != -1 and start < end:
                try:
                    items = json.loads(cleaned[start:end+1])
                except Exception:
                    pass

        if items is None:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and start < end:
                try:
                    items = json.loads(cleaned[start:end+1])
                except Exception:
                    pass

        if isinstance(items, dict):
            for key in ["questions", "interview_questions", "data", "results", "items"]:
                if key in items and isinstance(items[key], list):
                    items = items[key]
                    break

        if not isinstance(items, list):
            return []

        results = []
        for idx, q in enumerate(items, 1):
            if not isinstance(q, dict):
                continue
            results.append({
                "question_number": q.get("question_number", idx),
                "question_text": q.get("question_text") or q.get("question") or f"Question {idx} for target role",
                "interview_type": interview_type,
                "domain": domain,
                "difficulty": difficulty,
                "category": q.get("category", domain),
                "expected_answer_points": q.get("expected_answer_points") or q.get("points") or ["Domain depth", "Structured explanation", "Concrete examples"],
                "sample_answer": q.get("sample_answer") or q.get("sample") or "A clear response covering technical approach and practical implementation."
            })
        return results

    # ── Smart Fallback Question Generator ─────────────────────

    @classmethod
    def _generate_smart_fallback(
        cls,
        job_role: str,
        domain: str,
        interview_type: str,
        difficulty: str,
        num_questions: int,
        user_skills: str | None,
        job_description: str | None,
        resume_text: str | None
    ) -> List[Dict[str, Any]]:
        """
        Produces realistic domain-specific and type-tailored interview questions when external LLM is offline.
        """
        questions_bank = {
            "Technical Interview": {
                "Software Development": [
                    {
                        "question": f"In {job_role}, how do you approach designing scalable RESTful APIs microservices architecture?",
                        "category": "System Design",
                        "points": ["API versioning & rate limiting", "Database connection pooling", "Stateless auth with JWT"],
                        "sample": "I start by mapping resource endpoints, ensuring statelessness, defining idempotent methods, and using caching layers like Redis."
                    },
                    {
                        "question": "Can you explain the difference between processes and threads, and how asynchronous I/O improves concurrency?",
                        "category": "Operating Systems & Concurrency",
                        "points": ["Process memory isolation vs thread shared memory", "Event-loop non-blocking I/O", "Context switching overhead"],
                        "sample": "Processes have distinct memory spaces while threads share memory. Async I/O delegates waiting on network/disk to OS events, avoiding thread blocking."
                    },
                    {
                        "question": f"How do you optimize complex SQL database queries when dealing with millions of records in {domain} applications?",
                        "category": "Database Performance",
                        "points": ["Index analysis & EXPLAIN ANALYZE", "Query refactoring & avoiding N+1", "Database partitioning and sharding"],
                        "sample": "I use EXPLAIN ANALYZE to identify sequential scans, index foreign keys, avoid SELECT *, and implement pagination or CTEs where appropriate."
                    },
                    {
                        "question": f"Walk us through your CI/CD and unit testing strategy for {job_role} projects.",
                        "category": "DevOps & QA",
                        "points": ["Automated test suites (unit, integration, e2e)", "GitHub Actions / GitLab CI pipelines", "Zero-downtime deployment strategies"],
                        "sample": "We write unit tests with high coverage, run automated linting and security scans in CI on pull requests, and deploy using rolling updates."
                    },
                    {
                        "question": "How do you detect, handle, and prevent memory leaks in modern application runtimes?",
                        "category": "Memory Management",
                        "points": ["Garbage collection cycles", "Dangling event listeners / subscriptions", "Memory profiling tools"],
                        "sample": "Using heap snapshots and profilers to identify unreferenced memory retained by event listeners, global references, or unclosed streams."
                    }
                ],
                "AI/ML": [
                    {
                        "question": "Explain the trade-offs between bias and variance in machine learning models and how to mitigate overfitting.",
                        "category": "Machine Learning Fundamentals",
                        "points": ["High bias = underfitting, High variance = overfitting", "Regularization (L1/L2)", "Cross-validation & data augmentation"],
                        "sample": "Bias represents simplifying assumptions while variance represents sensitivity to noise. Overfitting is combated via dropout, regularization, and cross-validation."
                    },
                    {
                        "question": f"How do you evaluate and optimize Large Language Models (LLMs) for domain-specific tasks in {job_role}?",
                        "category": "Generative AI",
                        "points": ["Retrieval-Augmented Generation (RAG)", "Parameter-Efficient Fine-Tuning (PEFT/LoRA)", "Evaluation metrics (ROUGE, BLEU, human eval)"],
                        "sample": "We use RAG with vector stores to inject updated contextual data, combined with LoRA fine-tuning for custom tone and structured output compliance."
                    },
                    {
                        "question": "Describe the architecture of Transformer models and the core role of Self-Attention mechanism.",
                        "category": "Deep Learning Architecture",
                        "points": ["Scaled Dot-Product Attention", "Multi-Head Attention", "Positional Encodings"],
                        "sample": "Self-attention computes dynamic context vectors across sequence tokens by calculating Query, Key, Value matrix dot-products scaled by dimension sqrt."
                    }
                ],
                "Data Science": [
                    {
                        "question": "How do you handle missing values, outliers, and imbalanced datasets prior to model training?",
                        "category": "Data Preprocessing",
                        "points": ["Imputation techniques (Mean, KNN, MICE)", "SMOTE & Class re-weighting", "Robust statistical scaling"],
                        "sample": "I assess missingness mechanism (MCAR/MAR), use median/iterative imputation, apply log transforms or winsorization for outliers, and SMOTE for imbalance."
                    },
                    {
                        "question": "Explain the mathematical difference between ROC-AUC and Precision-Recall curves. When should you use which?",
                        "category": "Model Evaluation Metrics",
                        "points": ["ROC uses True Positive Rate vs False Positive Rate", "Precision-Recall focuses on positive class", "PR curves preferred for highly imbalanced data"],
                        "sample": "ROC curves can be overly optimistic on heavily imbalanced datasets because False Positive Rate stays low; PR curves prioritize true positive quality."
                    }
                ],
                "Cloud": [
                    {
                        "question": f"How do you architect a multi-region fault-tolerant infrastructure for {job_role}?",
                        "category": "Cloud Architecture",
                        "points": ["Active-active or active-passive DNS routing", "Cross-region database replication", "Infrastructure as Code (Terraform)"],
                        "sample": "By using Terraform to deploy load balancers with Route53 latency routing, multi-region database read-replicas, and auto-scaling groups."
                    }
                ],
                "Cyber Security": [
                    {
                        "question": "Explain Zero Trust Architecture principles and how you protect APIs from OWASP Top 10 vulnerabilities.",
                        "category": "Application Security",
                        "points": ["Never trust, always verify principle", "Authentication & Granular RBAC", "Input sanitization & rate limiting"],
                        "sample": "Zero Trust assumes network compromise. We enforce strict mTLS, JWT token validation, strict schema validation, and SQL/XSS parameterization."
                    }
                ]
            },
            "HR Interview": {
                "general": [
                    {
                        "question": f"Tell us about your professional background and why you are interested in this {job_role} role at SmartHire.",
                        "category": "Introduction & Fit",
                        "points": ["Career growth trajectory", "Alignment with company mission", "Relevant domain skill alignment"],
                        "sample": "I have spent several years expanding my expertise in technology and problem solving. This role aligns with my passion for building impactful solutions."
                    },
                    {
                        "question": "What are your key professional strengths, and what is one area you are actively working to improve?",
                        "category": "Self-Awareness",
                        "points": ["Concrete professional strengths", "Self-reflection & constructive improvement action", "Growth mindset"],
                        "sample": "My strength is breaking down complex specifications into clear milestones. I am actively improving my delegation and cross-team communication."
                    },
                    {
                        "question": "Where do you see your career progressing over the next 3 to 5 years?",
                        "category": "Career Vision",
                        "points": ["Long-term professional ambition", "Skill development goals", "Leadership / technical domain mastery"],
                        "sample": "Over the next 3 to 5 years, I aim to master advanced architectural patterns in this domain while mentoring junior team members."
                    },
                    {
                        "question": "How do you maintain work-life balance and handle tight project deadlines under pressure?",
                        "category": "Stress Management",
                        "points": ["Prioritization & time management", "Proactive stakeholder communication", "Personal wellbeing practices"],
                        "sample": "I prioritize tasks using urgent-important matrices, communicate blockers early with project managers, and maintain clear boundaries."
                    }
                ]
            },
            "Behavioral Interview": {
                "general": [
                    {
                        "question": "Describe a situation where you had a major disagreement with a technical lead or manager. How did you resolve it?",
                        "category": "Conflict Resolution",
                        "points": ["STAR Method (Situation, Task, Action, Result)", "Focus on objective data and user value", "Professionalism and alignment"],
                        "sample": "I scheduled a 1-on-1, presented benchmark data comparing both technical approaches, listened to their architectural constraints, and reached a data-driven consensus."
                    },
                    {
                        "question": "Give an example of a project that failed or missed a critical deadline. What went wrong and what did you learn?",
                        "category": "Accountability & Learning",
                        "points": ["Ownership without shifting blame", "Root cause analysis", "Process changes implemented after"],
                        "sample": "We under-estimated third-party API integration scope. I took ownership, updated stakeholders, and introduced spike tasks for all future external dependencies."
                    },
                    {
                        "question": "Tell us about a time you had to learn a completely new domain or framework on a very short deadline.",
                        "category": "Adaptability",
                        "points": ["Fast learning strategy", "Hands-on prototyping", "Delivering MVP within deadline"],
                        "sample": "I dedicated non-work hours to documentation, built a small proof-of-concept prototype, and leveraged peer code reviews to ramp up in 5 days."
                    }
                ]
            },
            "Aptitude Interview": {
                "general": [
                    {
                        "question": "A system processes 120 requests per second. If capacity is upgraded by 45%, how many total requests will it handle in 10 minutes?",
                        "category": "Quantitative Reasoning",
                        "points": ["Calculate upgraded rate: 120 * 1.45 = 174 req/sec", "Calculate per minute: 174 * 60 = 10,440", "Calculate 10 minutes: 104,400 requests"],
                        "sample": "Upgraded rate = 174 requests/sec. For 10 minutes (600 seconds): 174 * 600 = 104,400 requests."
                    },
                    {
                        "question": "If all software engineers use git, and some git users write Python, does it logically follow that all Python programmers are software engineers?",
                        "category": "Logical Deduction",
                        "points": ["Identify premise structures", "Recognize fallacious reverse deduction", "State clear logical conclusion"],
                        "sample": "No. The premise states all software engineers use git, not that everyone using git or Python is a software engineer. This would be a converse error."
                    },
                    {
                        "question": "A server room has 5 backup batteries. If the probability of any single battery failing in a year is 10%, what is the probability that all 5 operate without failure?",
                        "category": "Probability & Analysis",
                        "points": ["Independent event probability: P(Success) = 0.90", "Compound probability = (0.90)^5", "Result = 0.59049 (approx 59%)"],
                        "sample": "Assuming independent events: 0.90^5 = 0.59049 or approximately 59.05% probability all 5 operate without failure."
                    }
                ]
            }
        }

        # Select matching category list or general fallback
        type_bank = questions_bank.get(interview_type)
        if not type_bank:
            for k, v in questions_bank.items():
                if k.lower() in interview_type.lower() or interview_type.lower() in k.lower():
                    type_bank = v
                    break
        if not type_bank:
            type_bank = questions_bank["Technical Interview"]

        if isinstance(type_bank, dict):
            if domain in type_bank:
                domain_questions = type_bank[domain]
            elif "general" in type_bank:
                domain_questions = type_bank["general"]
            else:
                first_key = list(type_bank.keys())[0]
                domain_questions = type_bank[first_key]
        else:
            domain_questions = type_bank


        pool = list(domain_questions)
        import time
        seed_val = generation_seed or f"{time.time()}_{random.randint(10000, 99999)}"
        rng = random.Random(seed_val)
        rng.shuffle(pool)
        start_offset = rng.randint(0, max(0, len(pool) - 1))


        # Select items up to num_questions
        selected = []
        for idx in range(num_questions):
            template = pool[(idx + start_offset) % len(pool)]

            selected.append({
                "question_number": idx + 1,
                "question_text": template["question"],
                "interview_type": interview_type,
                "domain": domain,
                "difficulty": difficulty,
                "category": template.get("category", domain),
                "expected_answer_points": template.get("points", ["Domain depth", "Structured explanation", "Concrete examples"]),
                "sample_answer": template.get("sample", "A complete answer covers core principles, practical application, and performance considerations.")
            })
        return selected
