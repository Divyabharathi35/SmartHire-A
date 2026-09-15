# ============================================================
#  pdf_service.py — Candidate Self-Report PDF Generator
# ============================================================
import io
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether, ListFlowable, ListItem
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and draw 'Page X of Y' page numbers
    and consistent header/footer across all pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Header for pages > 1
        if self._pageNumber > 1:
            self.drawString(54, 750, "SmartHire — Candidate Interview Assessment Report")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.75)
            self.line(54, 742, 558, 742)

        # Footer on all pages
        self.setFont("Helvetica", 8)
        self.drawString(54, 34, "Confidential — Candidate Assessment Self-Report | SmartHire AI")
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 34, footer_text)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(54, 46, 558, 46)

        self.restoreState()


class CandidatePDFGenerator:
    """
    Generates a clean, professional, ATS/recruitment-style PDF report for the Candidate Self-Report.
    Strictly omits all recruiter-only fields (emotion detection, behavior, proctoring, transcripts, video).
    """

    @staticmethod
    def _parse_list(val: Any) -> List[str]:
        if not val:
            return []
        if isinstance(val, list):
            return [str(item).strip() for item in val if str(item).strip()]
        if isinstance(val, str):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
                return [str(parsed).strip()]
            except Exception:
                return [val.strip()]
        return [str(val).strip()]

    @staticmethod
    def _format_score(val: Any) -> str:
        if val is None or val == "" or str(val).strip().lower() in ("none", "null", "nan"):
            return "Insufficient Data"
        try:
            num = float(val)
            return f"{round(num)} / 100"
        except (ValueError, TypeError):
            return "Insufficient Data"

    @staticmethod
    def _format_text(val: Any, default: str = "Unavailable") -> str:
        if val is None or str(val).strip() == "" or str(val).strip().lower() in ("none", "null", "nan"):
            return default
        return str(val).strip()

    @staticmethod
    def _format_secs(secs: Any) -> str:
        if secs is None or secs == "":
            return "Unavailable"
        try:
            s = int(secs)
            m = s // 60
            sec = s % 60
            if m > 0:
                return f"{m}m {sec}s"
            return f"{sec}s"
        except Exception:
            return "Unavailable"

    @classmethod
    def generate_pdf(
        cls,
        candidate_info: Dict[str, Any],
        session_info: Dict[str, Any],
        result_info: Dict[str, Any],
        questions_summary: Dict[str, Any]
    ) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=letter,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        styles = getSampleStyleSheet()

        # Custom Paragraph Styles
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#1E293B"),
            spaceAfter=2
        )
        subtitle_style = ParagraphStyle(
            'ReportSubTitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=10
        )
        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#4F46E5"),
            spaceBefore=14,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#334155")
        )
        list_item_style = ParagraphStyle(
            'ReportListItem',
            parent=body_style,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#1E293B"),
            spaceAfter=3
        )
        meta_label_style = ParagraphStyle(
            'MetaLabel',
            parent=body_style,
            fontName='Helvetica-Bold',
            fontSize=8.5,
            textColor=colors.HexColor("#475569")
        )
        meta_val_style = ParagraphStyle(
            'MetaVal',
            parent=body_style,
            fontSize=8.5,
            textColor=colors.HexColor("#0F172A")
        )

        story = []

        # ── Header / Title Banner ──────────────────────────────────
        story.append(Paragraph("SmartHire - Candidate Interview Assessment Report", title_style))
        story.append(Paragraph("Candidate Self-Report & Performance Executive Evaluation Record", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#6366F1"), spaceAfter=12))

        # ── 1. Candidate Information ────────────────────────────────
        story.append(Paragraph("1. Candidate & Assessment Information", section_heading))

        cand_name = cls._format_text(candidate_info.get("name"))
        cand_email = cls._format_text(candidate_info.get("email"))
        target_role = cls._format_text(session_info.get("job_role"))
        domain = cls._format_text(session_info.get("domain"))
        interview_type = cls._format_text(session_info.get("interview_type"))
        difficulty = cls._format_text(session_info.get("difficulty"))
        
        status_val = cls._format_text(session_info.get("status"), default="Unknown").capitalize()
        duration_val = cls._format_secs(session_info.get("duration") or result_info.get("total_duration"))
        
        # Assessment Date
        raw_date = session_info.get("ended_at") or result_info.get("completed_at") or session_info.get("created_at")
        if raw_date:
            if isinstance(raw_date, datetime):
                date_str = raw_date.strftime("%d %b %Y, %H:%M")
            else:
                try:
                    dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
                    date_str = dt.strftime("%d %b %Y, %H:%M")
                except Exception:
                    date_str = str(raw_date)[:16]
        else:
            date_str = "Unavailable"

        questions_answered = questions_summary.get("completed", "Unavailable")
        total_questions = questions_summary.get("total", "Unavailable")
        questions_completed_str = f"{questions_answered} / {total_questions}" if (questions_answered != "Unavailable" and total_questions != "Unavailable") else "Unavailable"

        info_data = [
            [
                Paragraph("Candidate Name:", meta_label_style), Paragraph(cand_name, meta_val_style),
                Paragraph("Target Role:", meta_label_style), Paragraph(target_role, meta_val_style)
            ],
            [
                Paragraph("Email:", meta_label_style), Paragraph(cand_email, meta_val_style),
                Paragraph("Domain:", meta_label_style), Paragraph(domain, meta_val_style)
            ],
            [
                Paragraph("Interview Type:", meta_label_style), Paragraph(interview_type, meta_val_style),
                Paragraph("Difficulty:", meta_label_style), Paragraph(difficulty, meta_val_style)
            ],
            [
                Paragraph("Assessment Date:", meta_label_style), Paragraph(date_str, meta_val_style),
                Paragraph("Interview Status:", meta_label_style), Paragraph(status_val, meta_val_style)
            ],
            [
                Paragraph("Total Duration:", meta_label_style), Paragraph(duration_val, meta_val_style),
                Paragraph("Questions Completed:", meta_label_style), Paragraph(questions_completed_str, meta_val_style)
            ]
        ]

        info_table = Table(info_data, colWidths=[100, 152, 100, 152])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 12))

        # ── 2. Candidate Score Card & Executive Assessment ──────────
        story.append(Paragraph("2. Candidate Score Card & Executive Assessment", section_heading))

        raw_overall = result_info.get("overall_score")
        overall_display = cls._format_score(raw_overall)
        recommendation = cls._format_text(result_info.get("performance_rating") or session_info.get("recommendation"), default="Under Review")

        comm_score = cls._format_score(result_info.get("communication_score"))
        conf_score = cls._format_score(result_info.get("confidence_score"))
        tech_score = cls._format_score(result_info.get("technical_relevance_score"))
        prof_score = cls._format_score(result_info.get("professionalism_score"))

        score_table_data = [
            [
                Paragraph("Overall Final Score", meta_label_style),
                Paragraph("Recommendation", meta_label_style)
            ],
            [
                Paragraph(f"<font size=14 color='#4F46E5'><b>{overall_display}</b></font>", body_style),
                Paragraph(f"<font size=11 color='#047857'><b>{recommendation}</b></font>", body_style)
            ]
        ]
        summary_score_table = Table(score_table_data, colWidths=[252, 252])
        summary_score_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EEF2FF")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#C7D2FE")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E7FF")),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
        ]))
        story.append(summary_score_table)
        story.append(Spacer(1, 8))

        # Detailed Categories Table
        categories_data = [
            [
                Paragraph("Assessment Dimension", meta_label_style),
                Paragraph("Weight", meta_label_style),
                Paragraph("Score", meta_label_style)
            ],
            [Paragraph("Communication", body_style), Paragraph("30%", body_style), Paragraph(comm_score, body_style)],
            [Paragraph("Confidence", body_style), Paragraph("25%", body_style), Paragraph(conf_score, body_style)],
            [Paragraph("Technical Relevance", body_style), Paragraph("30%", body_style), Paragraph(tech_score, body_style)],
            [Paragraph("Professionalism", body_style), Paragraph("15%", body_style), Paragraph(prof_score, body_style)],
        ]
        cat_table = Table(categories_data, colWidths=[224, 120, 160])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
        ]))
        story.append(cat_table)
        story.append(Spacer(1, 10))

        # ── 3. Weighted Scoring Formula Notice ──────────────────────
        story.append(Paragraph("3. Weighted Scoring Formula", section_heading))
        formula_text = (
            "<b>Overall Final Score Formula:</b><br/>"
            "Communication × 30% + Confidence × 25% + Technical Relevance × 30% + Professionalism × 15%"
        )
        formula_table = Table([[Paragraph(formula_text, body_style)]], colWidths=[504])
        formula_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(formula_table)
        story.append(Spacer(1, 12))

        # ── 4. Grounded AI Candidate Evaluation & Coaching ─────────
        story.append(Paragraph("4. Grounded AI Candidate Evaluation & Coaching", section_heading))

        ai_provider = cls._format_text(result_info.get("ai_provider") or session_info.get("ai_provider"), default="SmartHire AI")
        ai_model = cls._format_text(result_info.get("ai_model") or session_info.get("ai_model"), default="SmartHire-Evaluator-v1")
        
        raw_ai_ts = result_info.get("feedback_generated_at") or result_info.get("completed_at") or session_info.get("ended_at")
        if raw_ai_ts:
            if isinstance(raw_ai_ts, datetime):
                ai_ts_str = raw_ai_ts.strftime("%d %b %Y, %H:%M:%S")
            else:
                try:
                    dt = datetime.fromisoformat(str(raw_ai_ts).replace("Z", "+00:00"))
                    ai_ts_str = dt.strftime("%d %b %Y, %H:%M:%S")
                except Exception:
                    ai_ts_str = str(raw_ai_ts)
        else:
            ai_ts_str = "Unavailable"

        meta_bar_text = f"<b>AI Provider:</b> {ai_provider} &nbsp;&nbsp;|&nbsp;&nbsp; <b>AI Model:</b> {ai_model} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Generated:</b> {ai_ts_str}"
        meta_bar_table = Table([[Paragraph(meta_bar_text, body_style)]], colWidths=[504])
        meta_bar_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(meta_bar_table)
        story.append(Spacer(1, 10))

        # Helper to render list sections
        def append_feedback_list(section_title: str, items: List[str], header_color: str):
            sub_title_style = ParagraphStyle(
                'FeedbackSubTitle',
                parent=styles['Heading3'],
                fontName='Helvetica-Bold',
                fontSize=10,
                leading=13,
                textColor=colors.HexColor(header_color),
                spaceBefore=6,
                spaceAfter=4
            )
            element_group = [Paragraph(section_title, sub_title_style)]
            
            if items:
                bullet_list = []
                for it in items:
                    bullet_list.append(ListItem(Paragraph(it, list_item_style), leftIndent=12, bulletOffsetY=-1))
                element_group.append(ListFlowable(bullet_list, bulletType='bullet', start='square', bulletFontName='Helvetica', bulletFontSize=6, leftIndent=8))
            else:
                element_group.append(Paragraph("<i>No specific items recorded for this section.</i>", body_style))

            element_group.append(Spacer(1, 8))
            story.append(KeepTogether(element_group))

        strengths = cls._parse_list(result_info.get("strengths"))
        weaknesses = cls._parse_list(result_info.get("weaknesses"))
        improvement_suggestions = cls._parse_list(result_info.get("improvement_suggestions"))
        practice_recommendations = cls._parse_list(result_info.get("practice_recommendations"))
        learning_resources = cls._parse_list(result_info.get("learning_resources"))

        append_feedback_list("Key Candidate Strengths", strengths, "#059669")
        append_feedback_list("Weaknesses & Areas for Improvement", weaknesses, "#D97706")
        append_feedback_list("Improvement Suggestions", improvement_suggestions, "#2563EB")
        append_feedback_list("Practice Recommendations", practice_recommendations, "#0D9488")
        append_feedback_list("Learning Resources", learning_resources, "#7C3AED")

        # Build PDF
        doc.build(story, canvasmaker=NumberedCanvas)
        return buf.getvalue()
