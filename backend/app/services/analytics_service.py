# ============================================================
#  analytics_service.py — Candidate Dashboard & Analytics Service
# ============================================================
import json
import logging
from typing import Any, Dict, List, Optional
import asyncpg

logger = logging.getLogger("smarthire.analytics")


class CandidateAnalyticsService:
    """
    Candidate Analytics Engine executing actual database queries for:
    - Skill Analysis (Vertical Bar Graph data)
    - Chronological Performance Trends (Line Graph data)
    - Predicted Weak Areas (<70% threshold, sorted lowest first)
    
    All queries enforce candidate data isolation by filtering by candidate_id / user_id.
    Strictly uses real database records; no mock, random, or hardcoded scores.
    """

    @classmethod
    async def get_candidate_analytics(
        cls,
        db: asyncpg.Connection,
        candidate_id: str
    ) -> Dict[str, Any]:
        """
        Calculates full candidate analytics package grounded strictly in actual database records.
        """

        # 1. Fetch completed interview results for this candidate
        res_rows = await db.fetch(
            """
            SELECT 
                r.id AS result_id,
                r.session_id,
                r.overall_score,
                r.communication_score,
                r.confidence_score,
                r.technical_relevance_score,
                r.professionalism_score,
                r.completed_at,
                s.job_role,
                s.domain,
                s.user_skills,
                s.interview_type,
                COALESCE(r.total_duration, s.duration, 0) as total_duration
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            WHERE (r.candidate_id = $1 OR s.user_id = $1)
              AND LOWER(s.status) = 'completed'
              AND (s.is_mock IS FALSE OR s.is_mock IS NULL)
            ORDER BY r.completed_at ASC
            """,
            candidate_id
        )

        completed_count = len(res_rows)

        # ── 1. Overall Summary Calculation ──────────────────
        if completed_count == 0:
            overall_summary = {
                "status": "insufficient_data",
                "overall_score": None,
                "display_overall_score": "Insufficient Data",
                "communication_score": None,
                "confidence_score": None,
                "technical_relevance_score": None,
                "professionalism_score": None,
                "completed_interviews_count": 0,
            }
        else:
            comm_list = [float(r.get("communication_score")) for r in res_rows if r.get("communication_score") is not None]
            conf_list = [float(r.get("confidence_score")) for r in res_rows if r.get("confidence_score") is not None]
            tech_list = [float(r.get("technical_relevance_score")) for r in res_rows if r.get("technical_relevance_score") is not None]
            prof_list = [float(r.get("professionalism_score")) for r in res_rows if r.get("professionalism_score") is not None]
            overall_list = [float(r.get("overall_score")) for r in res_rows if r.get("overall_score") is not None]

            avg_comm = round(sum(comm_list) / len(comm_list), 1) if comm_list else None
            avg_conf = round(sum(conf_list) / len(conf_list), 1) if conf_list else None
            avg_tech = round(sum(tech_list) / len(tech_list), 1) if tech_list else None
            avg_prof = round(sum(prof_list) / len(prof_list), 1) if prof_list else None

            if avg_comm is not None and avg_conf is not None and avg_tech is not None and avg_prof is not None:
                calc_overall = round(
                    (avg_comm * 0.30) + (avg_conf * 0.25) + (avg_tech * 0.30) + (avg_prof * 0.15), 1
                )
            elif overall_list:
                calc_overall = round(sum(overall_list) / len(overall_list), 1)
            else:
                calc_overall = None

            overall_summary = {
                "status": "available" if calc_overall is not None else "insufficient_data",
                "overall_score": calc_overall,
                "display_overall_score": f"{calc_overall}%" if calc_overall is not None else "Insufficient Data",
                "communication_score": avg_comm,
                "confidence_score": avg_conf,
                "technical_relevance_score": avg_tech,
                "professionalism_score": avg_prof,
                "completed_interviews_count": completed_count,
            }

        # ── 2. Performance Trends (Chronological Line Graph Data) ──
        performance_trends = []
        for idx, r in enumerate(res_rows, 1):
            sc = round(float(r.get("overall_score")), 1) if r.get("overall_score") is not None else None
            completed_dt = r.get("completed_at") or r.get("ended_at")
            dt_str = completed_dt.strftime("%d %b") if completed_dt and hasattr(completed_dt, 'strftime') else f"Session {idx}"
            performance_trends.append({
                "session_id": str(r.get("session_id") or r.get("id")),
                "session_label": f"Session {idx}",
                "label": f"Session {idx}",
                "interview_number": idx,
                "date": dt_str,
                "overall_score": sc,
                "score": sc,
                "display_score": f"{sc}%" if sc is not None else "N/A",
                "job_role": r.get("job_role", "Technical Interview"),
                "role": r.get("job_role", "Technical Interview"),
                "domain": r.get("domain", "General"),
                "communication": float(r.get("communication_score")) if r.get("communication_score") is not None else None,
                "confidence": float(r.get("confidence_score")) if r.get("confidence_score") is not None else None,
                "technical_relevance": float(r.get("technical_relevance_score")) if r.get("technical_relevance_score") is not None else None,
                "professionalism": float(r.get("professionalism_score")) if r.get("professionalism_score") is not None else None,
            })

        # ── 3. Skill Analysis & Weak Area Calculation ──────
        session_ids = [r.get("session_id") or r.get("id") for r in res_rows if (r.get("session_id") or r.get("id"))]
        
        skill_scores_map = {}
        
        if session_ids:
            try:
                q_rows = await db.fetch(
                    """
                    SELECT 
                        q.question_text,
                        q.domain,
                        q.difficulty,
                        q.category,
                        e.score,
                        e.created_at
                    FROM question_evaluations e
                    JOIN interview_questions q ON e.question_id = q.id
                    WHERE e.session_id = ANY($1::uuid[])
                      AND e.score IS NOT NULL
                    """,
                    session_ids
                )
            except Exception:
                q_rows = []

            for q in q_rows:
                domain_name = (q.get("category") or q.get("domain") or q.get("answer_type") or "General Skill").strip()
                score_raw = q.get("score") if q.get("score") is not None else q.get("question_score")
                if score_raw is not None:
                    score_val = float(score_raw)
                    if domain_name not in skill_scores_map:
                        skill_scores_map[domain_name] = []
                    skill_scores_map[domain_name].append(score_val)

        # Fallback to category scores if question evaluations are not detailed
        if not skill_scores_map and res_rows:
            comm_vals = [float(r.get("communication_score")) for r in res_rows if r.get("communication_score") is not None]
            conf_vals = [float(r.get("confidence_score")) for r in res_rows if r.get("confidence_score") is not None]
            tech_vals = [float(r.get("technical_relevance_score")) for r in res_rows if r.get("technical_relevance_score") is not None]
            prof_vals = [float(r.get("professionalism_score")) for r in res_rows if r.get("professionalism_score") is not None]

            if comm_vals:
                skill_scores_map["Communication"] = comm_vals
            if conf_vals:
                skill_scores_map["Confidence & Delivery"] = conf_vals
            if tech_vals:
                skill_scores_map["Technical Relevance"] = tech_vals
            if prof_vals:
                skill_scores_map["Professionalism"] = prof_vals

        skill_analytics = []
        predicted_weak_areas = []

        for skill, scores in skill_scores_map.items():
            if scores:
                avg_sc = round(sum(scores) / len(scores), 1)
                skill_analytics.append({
                    "skill": skill,
                    "score": avg_sc,
                    "display_score": f"{avg_sc}%",
                    "evaluations_count": len(scores)
                })

                # Weak area condition: average score strictly < 70.0%
                if avg_sc < 70.0:
                    predicted_weak_areas.append({
                        "skill": skill,
                        "average_score": avg_sc,
                        "display_score": f"{avg_sc}%",
                        "status": "Needs Improvement"
                    })

        # Sort weak areas lowest score first
        predicted_weak_areas.sort(key=lambda x: x["average_score"])

        # ── 4. Session Milestones ─────────────
        milestones = []
        for idx, r in enumerate(res_rows, 1):
            sc = round(float(r.get("overall_score")), 1) if r.get("overall_score") is not None else None
            completed_dt = r.get("completed_at") or r.get("ended_at")
            dt_str = completed_dt.strftime("%d %b %Y") if completed_dt and hasattr(completed_dt, 'strftime') else f"Session {idx}"
            milestones.append({
                "session_number": idx,
                "session_label": f"Session {idx}",
                "date": dt_str,
                "status": "Completed",
                "score": sc,
                "display_score": f"{sc}%" if sc is not None else "N/A",
                "job_role": r.get("job_role", "Technical Interview"),
                "domain": r.get("domain", "General")
            })

        # ── 5. Improvement Insights Calculation ─
        # A. Overall Progress
        diff_val = None
        if len(performance_trends) >= 2:
            first_score = performance_trends[0]["overall_score"]
            latest_score = performance_trends[-1]["overall_score"]
            if first_score is not None and latest_score is not None:
                diff_val = round(latest_score - first_score, 1)
                sign = "+" if diff_val > 0 else ""
                progress_text = f"{sign}{diff_val}%"
                progress_detail = f"Improvement from {first_score}% → {latest_score}%" if diff_val >= 0 else f"Change from {first_score}% → {latest_score}%"
                progress_status = "positive" if diff_val >= 0 else "negative"
            else:
                progress_text = "Insufficient Data"
                progress_detail = "Not enough completed sessions with scores."
                progress_status = "neutral"
        elif len(performance_trends) == 1:
            progress_text = "Not enough sessions to calculate progress."
            progress_detail = "At least 2 completed interview sessions are required to calculate overall progress."
            progress_status = "single_session"
        else:
            progress_text = "Insufficient Data"
            progress_detail = "No completed interview sessions available."
            progress_status = "no_data"

        # B & C. Strongest & Focus Area
        sorted_skills = sorted(skill_analytics, key=lambda x: x["score"], reverse=True)
        if sorted_skills:
            strongest_area = {
                "skill": sorted_skills[0]["skill"],
                "score": sorted_skills[0]["score"],
                "display_score": f"{sorted_skills[0]['score']}%",
                "status": "available"
            }
            weakest = sorted_skills[-1]
            focus_area = {
                "skill": weakest["skill"],
                "score": weakest["score"],
                "display_score": f"{weakest['score']}%",
                "status": "available"
            }
        else:
            strongest_area = {"skill": "Insufficient Data", "score": None, "display_score": "Insufficient Data", "status": "insufficient_data"}
            focus_area = {"skill": "Insufficient Data", "score": None, "display_score": "Insufficient Data", "status": "insufficient_data"}

        improvement_insights = {
            "overall_progress": {
                "change_value": diff_val,
                "display_change": progress_text,
                "detail": progress_detail,
                "status": progress_status
            },
            "strongest_area": strongest_area,
            "focus_area": focus_area
        }

        try:
            ranking_info = await cls.calculate_candidate_ranking(db, candidate_id)
        except Exception:
            ranking_info = {"rank": None, "total_candidates": 0, "status": "insufficient_data"}

        return {
            "candidate_id": candidate_id,
            "completed_interviews_count": completed_count,
            "overall_summary": overall_summary,
            "performance_trend": performance_trends if performance_trends else [],
            "performance_trends": performance_trends if performance_trends else [],
            "skill_analytics": skill_analytics if skill_analytics else [],
            "skill_analysis": skill_analytics if skill_analytics else [],
            "predicted_weak_areas": predicted_weak_areas if predicted_weak_areas else [],
            "milestones": milestones if milestones else [],
            "improvement_insights": improvement_insights,
            "candidate_ranking": ranking_info,
            "data_status": "available" if completed_count > 0 else "insufficient_data",
        }

    @classmethod
    async def calculate_candidate_ranking(
        cls,
        db: asyncpg.Connection,
        candidate_id: str
    ) -> Dict[str, Any]:
        """
        Calculates candidate rank among all candidates with completed interviews.
        Incomplete, created, and in-progress sessions are strictly excluded from ranking population.
        """
        cand_best = await db.fetchrow(
            """
            SELECT MAX(r.overall_score) as best_score
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            WHERE (r.candidate_id = $1 OR s.user_id = $1)
              AND LOWER(s.status) = 'completed'
              AND r.overall_score IS NOT NULL
              AND (s.is_mock IS FALSE OR s.is_mock IS NULL)
            """,
            candidate_id
        )

        if not cand_best or cand_best["best_score"] is None:
            return {
                "rank": None,
                "total_candidates": 0,
                "percentile": None,
                "display": "Insufficient Data",
                "status": "insufficient_data"
            }

        cand_score = float(cand_best["best_score"])

        pop_rows = await db.fetch(
            """
            SELECT 
                COALESCE(r.candidate_id, s.user_id) AS cand_user_id,
                MAX(r.overall_score) AS best_score
            FROM interview_results r
            JOIN interview_sessions s ON r.session_id = s.id
            WHERE LOWER(s.status) = 'completed'
              AND r.overall_score IS NOT NULL
              AND (s.is_mock IS FALSE OR s.is_mock IS NULL)
            GROUP BY COALESCE(r.candidate_id, s.user_id)
            ORDER BY best_score DESC
            """
        )

        total_candidates = len(pop_rows)
        if total_candidates == 0:
            return {
                "rank": None,
                "total_candidates": 0,
                "percentile": None,
                "display": "Insufficient Data",
                "status": "insufficient_data"
            }

        rank = 1
        for row in pop_rows:
            sc = float(row["best_score"])
            if sc > cand_score:
                rank += 1

        percentile = round(((total_candidates - rank + 1) / total_candidates) * 100, 1)

        return {
            "rank": rank,
            "total_candidates": total_candidates,
            "percentile": percentile,
            "display": f"#{rank} out of {total_candidates} candidates",
            "cand_score": cand_score,
            "status": "available"
        }


# Module-level convenience functions
get_candidate_analytics = CandidateAnalyticsService.get_candidate_analytics
