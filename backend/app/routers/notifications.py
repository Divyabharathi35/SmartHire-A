# ============================================================
#  notifications.py — Router for In-App Notifications & Reminders
# ============================================================
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import asyncpg

from app.database import get_db
from app.dependencies import CurrentUser
from app.services.notification_service import NotificationService

router = APIRouter(tags=["Notifications"])


class SendReminderRequest(BaseModel):
    user_id: UUID
    session_id: Optional[UUID] = None
    title: str = "🔔 Interview Reminder"
    message: str = "Your technical interview starts soon. Please ensure your camera and microphone are ready."
    send_email: bool = True


@router.get("/notifications", response_model=List[Dict[str, Any]])
@router.get("/api/notifications", response_model=List[Dict[str, Any]])
async def get_user_notifications(
    current_user: CurrentUser,
    unread_only: bool = False,
    limit: int = 50,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Fetches in-app notifications for the authenticated user.
    """
    user_id = current_user["id"]
    return await NotificationService.get_user_notifications(db, user_id=str(user_id), unread_only=unread_only, limit=limit)


@router.patch("/notifications/{notification_id}/read")
@router.patch("/api/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Marks a notification as read.
    """
    user_id = str(current_user["id"])
    success = await NotificationService.mark_notification_as_read(db, notification_id=notification_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found or unauthorized.")
    return {"success": True, "notification_id": notification_id, "is_read": True}


@router.post("/notifications/reminders/send")
@router.post("/api/notifications/reminders/send")
async def send_interview_reminder(
    req: SendReminderRequest,
    current_user: CurrentUser,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Creates an interview reminder notification for a user and optionally sends an email.
    """
    target_user_id = str(req.user_id)
    # Auth check: candidates can send reminders for themselves, recruiters/admins for any user
    if current_user["role"] == "candidate" and str(current_user["id"]) != target_user_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot send reminders to other users.")

    notif = await NotificationService.create_notification(
        db=db,
        user_id=target_user_id,
        notification_type="reminder",
        title=req.title,
        message=req.message,
        session_id=str(req.session_id) if req.session_id else None,
        event_type="reminder"
    )

    if req.send_email:
        user_row = await db.fetchrow("SELECT email, name FROM users WHERE id = $1", req.user_id)
        if user_row and user_row.get("email"):
            await NotificationService.send_email_notification(
                to_email=user_row["email"],
                subject=req.title,
                body_text=req.message
            )

    return {"success": True, "notification": notif}
