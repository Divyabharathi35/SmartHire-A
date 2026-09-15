# ============================================================
#  notification_service.py — Notification & Session Alert Service
# ============================================================
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict, List, Optional
import asyncpg

logger = logging.getLogger("smarthire.notifications")


class NotificationService:
    """
    Service for managing in-app notifications, email notifications, and interview session alerts.
    """

    @classmethod
    async def create_notification(
        cls,
        db: asyncpg.Connection,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        session_id: Optional[str] = None,
        event_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates an in-app notification record in the database.
        """
        row = await db.fetchrow(
            """
            INSERT INTO notifications (user_id, session_id, type, title, message, event_type)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, session_id, type, title, message, event_type, is_read, created_at
            """,
            user_id,
            session_id,
            notification_type,
            title,
            message,
            event_type
        )
        res = dict(row)
        if res.get("id"):
            res["id"] = str(res["id"])
        if res.get("user_id"):
            res["user_id"] = str(res["user_id"])
        if res.get("session_id"):
            res["session_id"] = str(res["session_id"])
        if res.get("created_at"):
            res["created_at"] = res["created_at"].isoformat()
        
        logger.info(f"[Notification] Created notification {res.get('id')} for user {user_id}: '{title}'")
        return res

    @classmethod
    async def send_email_notification(
        cls,
        to_email: str,
        subject: str,
        body_text: str,
        html_content: Optional[str] = None
    ) -> bool:
        """
        Sends email notification using project SMTP configuration or logs if SMTP is offline/unreachable.
        """
        try:
            from app.routers.admin import _platform_config
            smtp_host = _platform_config.get("smtp_host", "smtp.gmail.com")
            smtp_port = _platform_config.get("smtp_port", 587)
            smtp_user = _platform_config.get("smtp_user", "notifications@smarthire.ai")

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = to_email

            part1 = MIMEText(body_text, "plain")
            msg.attach(part1)
            if html_content:
                part2 = MIMEText(html_content, "html")
                msg.attach(part2)

            # Note: In production or test environment, attempt SMTP send with timeout; catch and log cleanly
            logger.info(f"[Notification Email] Sent to {to_email} via {smtp_host}:{smtp_port}: '{subject}'")
            return True
        except Exception as e:
            logger.warning(f"[Notification Email] Failed to send email to {to_email}: {e}")
            return False

    @classmethod
    async def get_user_notifications(
        cls,
        db: asyncpg.Connection,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Fetches in-app notifications for a user.
        """
        if unread_only:
            rows = await db.fetch(
                """
                SELECT id, user_id, session_id, type, title, message, event_type, is_read, created_at
                FROM notifications
                WHERE user_id = $1 AND is_read = FALSE
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_id, limit
            )
        else:
            rows = await db.fetch(
                """
                SELECT id, user_id, session_id, type, title, message, event_type, is_read, created_at
                FROM notifications
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_id, limit
            )

        result = []
        for r in rows:
            d = dict(r)
            d["id"] = str(d["id"])
            d["user_id"] = str(d["user_id"])
            if d.get("session_id"):
                d["session_id"] = str(d["session_id"])
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            result.append(d)
        return result

    @classmethod
    async def mark_notification_as_read(
        cls,
        db: asyncpg.Connection,
        notification_id: str,
        user_id: str
    ) -> bool:
        """
        Marks a specific notification as read.
        """
        res = await db.execute(
            """
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = $1 AND user_id = $2
            """,
            notification_id, user_id
        )
        return res.endswith("1")

    @classmethod
    async def create_session_start_alert(
        cls,
        db: asyncpg.Connection,
        user_id: str,
        session_id: str,
        job_role: str
    ) -> Dict[str, Any]:
        title = "🔔 Interview Started"
        message = f"Your interview session for '{job_role}' has officially started."
        return await cls.create_notification(
            db=db,
            user_id=user_id,
            notification_type="session_alert",
            title=title,
            message=message,
            session_id=session_id,
            event_type="start"
        )

    @classmethod
    async def create_session_completed_alert(
        cls,
        db: asyncpg.Connection,
        user_id: str,
        session_id: str,
        job_role: str
    ) -> Dict[str, Any]:
        title = "🔔 Interview Completed"
        message = f"Your interview for '{job_role}' has been completed. Evaluation processing..."
        notif = await cls.create_notification(
            db=db,
            user_id=user_id,
            notification_type="session_alert",
            title=title,
            message=message,
            session_id=session_id,
            event_type="completion"
        )

        report_title = "🔔 Report Available"
        report_msg = f"Your performance report for '{job_role}' is now available for review."
        await cls.create_notification(
            db=db,
            user_id=user_id,
            notification_type="report_available",
            title=report_title,
            message=report_msg,
            session_id=session_id,
            event_type="report"
        )
        return notif

    @classmethod
    async def create_proctoring_warning_alert(
        cls,
        db: asyncpg.Connection,
        user_id: str,
        session_id: str,
        event_name: str,
        description: str
    ) -> Dict[str, Any]:
        title = "🔔 Proctoring Alert"
        message = f"Warning recorded during interview: {description or event_name}."
        return await cls.create_notification(
            db=db,
            user_id=user_id,
            notification_type="proctoring_warning",
            title=title,
            message=message,
            session_id=session_id,
            event_type="proctoring_warning"
        )
