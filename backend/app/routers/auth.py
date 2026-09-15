# ============================================================
#  routers/auth.py — /api/auth endpoints
# ============================================================
from datetime import datetime, timedelta, timezone
import hashlib
import secrets

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.database import get_db
from app.dependencies import CurrentUser
from app.schemas import (
    AuthResponse, ForgotPasswordRequest, ForgotPasswordResponse,
    LoginRequest, MessageResponse, RegisterRequest, ResetPasswordRequest, UserResponse
)
from app.security import create_access_token, hash_password, verify_password
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # seconds


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    name_part, domain_part = email.split("@", 1)
    if len(name_part) <= 1:
        masked_name = "*"
    else:
        masked_name = name_part[0] + "*" * (len(name_part) - 1)
    return f"{masked_name}@{domain_part}"


def _set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="smarthire_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


def _row_to_user(row: dict | asyncpg.Record) -> UserResponse:
    d = dict(row)
    if "role" in d:
        d["role"] = str(d["role"]).lower()
    return UserResponse(**d)


# ──────────────────────────────────────────────
#  POST /api/auth/register
# ──────────────────────────────────────────────
@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, response: Response, db: asyncpg.Connection = Depends(get_db)):
    clean_email = body.email.strip().lower()
    existing = await db.fetchrow("SELECT id FROM users WHERE LOWER(TRIM(email)) = $1", clean_email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    pw_hash = hash_password(body.password)

    user = await db.fetchrow(
        """
        INSERT INTO users (name, email, password_hash, role, auth_provider)
        VALUES ($1, $2, $3, $4::user_role, 'local')
        RETURNING id, name, email, role, auth_provider, avatar_url, is_active, last_login_at, created_at
        """,
        body.name.strip(), clean_email, pw_hash, body.role.value,
    )

    role_str = str(user["role"]).lower()
    token = create_access_token({"id": str(user["id"]), "email": user["email"], "role": role_str, "name": user["name"]})
    _set_auth_cookie(response, token)

    return AuthResponse(success=True, message="Account created successfully.", user=_row_to_user(user))


# ──────────────────────────────────────────────
#  POST /api/auth/login
# ──────────────────────────────────────────────
@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, request: Request, response: Response, db: asyncpg.Connection = Depends(get_db)):
    clean_email = body.email.strip().lower()
    masked_email = _mask_email(clean_email)
    origin_header = request.headers.get("origin", "N/A")

    user = await db.fetchrow(
        "SELECT id, name, email, password_hash, role, auth_provider, avatar_url, is_active, last_login_at, created_at "
        "FROM users WHERE LOWER(TRIM(email)) = $1",
        clean_email,
    )

    if not user:
        print(f"[AUTH DIAGNOSTIC] Email: {masked_email} | Origin: {origin_header} | Found: False | Active: N/A | PwVerify: N/A | Status: 401 | Set-Cookie: False")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    user_found = True
    user_active = bool(user["is_active"])

    if not user["password_hash"]:
        provider = str(user.get("auth_provider", "OAuth")).capitalize()
        print(f"[AUTH DIAGNOSTIC] Email: {masked_email} | Origin: {origin_header} | Found: True | Active: {user_active} | PwVerify: OAuthAccount ({provider}) | Status: 400 | Set-Cookie: False")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This account is registered via {provider} sign-in. Please sign in with {provider}."
        )

    if not user_active:
        print(f"[AUTH DIAGNOSTIC] Email: {masked_email} | Origin: {origin_header} | Found: True | Active: False | PwVerify: N/A | Status: 403 | Set-Cookie: False")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated. Contact an administrator.")

    pw_ok = verify_password(body.password, user["password_hash"])
    if not pw_ok:
        print(f"[AUTH DIAGNOSTIC] Email: {masked_email} | Origin: {origin_header} | Found: True | Active: True | PwVerify: False | Status: 401 | Set-Cookie: False")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    # Update last_login_at
    await db.execute("UPDATE users SET last_login_at = $1 WHERE id = $2", datetime.now(timezone.utc), user["id"])

    role_str = str(user["role"]).lower()
    token = create_access_token({"id": str(user["id"]), "email": user["email"], "role": role_str, "name": user["name"]})
    _set_auth_cookie(response, token)

    print(f"[AUTH DIAGNOSTIC] Email: {masked_email} | Origin: {origin_header} | Found: True | Active: True | PwVerify: True | Status: 200 | Set-Cookie: True")

    return AuthResponse(success=True, message="Login successful.", user=_row_to_user(user))


# ──────────────────────────────────────────────
#  POST /api/auth/forgot-password
# ──────────────────────────────────────────────
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(body: ForgotPasswordRequest, db: asyncpg.Connection = Depends(get_db)):
    user = await db.fetchrow(
        "SELECT id, name, email, is_active, auth_provider FROM users WHERE email = $1",
        body.email.lower(),
    )
    if not user:
        # Generic message to avoid email enumeration
        return ForgotPasswordResponse(
            success=True,
            message="If an account with that email exists, password reset instructions have been generated.",
        )

    if not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated. Contact an administrator.")

    # Generate secure random 32-byte hex token
    raw_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Invalidate previous unused reset tokens for this user
    await db.execute(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
        user["id"],
    )

    await db.execute(
        """
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        """,
        user["id"], token_hash, expires_at,
    )

    return ForgotPasswordResponse(
        success=True,
        message="Password reset token generated successfully.",
        reset_token=raw_token,
    )


# ──────────────────────────────────────────────
#  POST /api/auth/reset-password
# ──────────────────────────────────────────────
@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: asyncpg.Connection = Depends(get_db)):
    raw_token = body.token.strip()
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token is required.")

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    reset_row = await db.fetchrow(
        """
        SELECT id, user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
        """,
        token_hash,
    )

    if not reset_row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token.")

    user = await db.fetchrow("SELECT id, is_active FROM users WHERE id = $1", reset_row["user_id"])
    if not user or not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User account is invalid or deactivated.")

    # Hash new password securely
    pw_hash = hash_password(body.new_password)

    # Update password hash in users table (keeps existing role unchanged)
    await db.execute(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        pw_hash, user["id"],
    )

    # Mark token as used
    await db.execute(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
        reset_row["id"],
    )

    return MessageResponse(success=True, message="Password reset successfully. You can now log in with your new password.")


# ──────────────────────────────────────────────
#  POST /api/auth/logout
# ──────────────────────────────────────────────
@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response):
    response.delete_cookie(
        key="smarthire_token",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    return MessageResponse(success=True, message="Logged out successfully.")


# ──────────────────────────────────────────────
#  GET /api/auth/me
# ──────────────────────────────────────────────
@router.get("/me", response_model=AuthResponse)
async def get_me(current_user: CurrentUser):
    u_dict = dict(current_user)
    if "role" in u_dict:
        u_dict["role"] = str(u_dict["role"]).lower()
    role_str = str(u_dict["role"]).lower()
    token = create_access_token({"id": str(u_dict["id"]), "email": u_dict["email"], "role": role_str, "name": u_dict["name"]})
    return AuthResponse(success=True, message="OK", user=UserResponse(**u_dict))

