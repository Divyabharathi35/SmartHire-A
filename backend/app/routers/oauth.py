# ============================================================
#  routers/oauth.py — Google & GitHub OAuth endpoints
# ============================================================
import os
from datetime import datetime, timezone
from urllib.parse import urlencode

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.config import settings
from app.database import get_db
from app.security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["OAuth"])

COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _get_backend_url(request: Request) -> str:
    """Dynamically determine the backend base URL for OAuth callbacks."""
    # 1. Configured BACKEND_URL setting or environment variable
    backend_url = getattr(settings, "BACKEND_URL", "").strip().rstrip("/")
    if backend_url:
        return backend_url

    # 2. Render provides RENDER_EXTERNAL_URL automatically for web services
    render_url = os.environ.get("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
    if render_url:
        return render_url

    # 3. Check proxy headers (x-forwarded-proto, x-forwarded-host)
    proto = request.headers.get("x-forwarded-proto", "").strip()
    host = request.headers.get("x-forwarded-host", "").strip()
    if host:
        scheme = proto or "https"
        return f"{scheme}://{host}".rstrip("/")

    host = request.headers.get("host", "").strip()
    if host:
        scheme = proto or ("https" if request.url.is_secure else "http")
        return f"{scheme}://{host}".rstrip("/")

    # 4. Fallback to request.base_url
    base = str(request.base_url).rstrip("/")
    if proto == "https" and base.startswith("http://"):
        base = "https://" + base[7:]
    return base


def _get_redirect_uri(request: Request, provider: str) -> str:
    """Generate the exact redirect URI expected by OAuth providers."""
    base = _get_backend_url(request)
    return f"{base}/api/auth/{provider}/callback"


def _set_auth_cookie(response: RedirectResponse, token: str):
    response.set_cookie(
        key="smarthire_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


async def _upsert_oauth_user(
    db: asyncpg.Connection,
    *,
    email: str,
    name: str,
    avatar_url: str | None,
    provider: str,
) -> dict:
    """Find existing user by email or create a new OAuth user."""
    user = await db.fetchrow(
        "SELECT id, name, email, role, auth_provider, avatar_url, is_active, last_login_at, created_at "
        "FROM users WHERE email = $1",
        email.lower(),
    )

    if user:
        # Update last_login_at and avatar if changed
        await db.execute(
            "UPDATE users SET last_login_at = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3",
            datetime.now(timezone.utc),
            avatar_url,
            user["id"],
        )
        return dict(user)

    # Create new user — default role is 'candidate'
    new_user = await db.fetchrow(
        """
        INSERT INTO users (name, email, password_hash, role, auth_provider, avatar_url)
        VALUES ($1, $2, NULL, 'candidate'::user_role, $3::auth_provider, $4)
        RETURNING id, name, email, role, auth_provider, avatar_url, is_active, last_login_at, created_at
        """,
        name,
        email.lower(),
        provider,
        avatar_url,
    )
    return dict(new_user)


# ═══════════════════════════════════════════════
#  GOOGLE OAUTH
# ═══════════════════════════════════════════════

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google", tags=["OAuth"])
async def google_login(request: Request):
    """Redirect the user to Google's consent screen."""
    redirect_uri = _get_redirect_uri(request, "google")
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback", tags=["OAuth"])
async def google_callback(
    request: Request,
    code: str = "",
    error: str = "",
    db: asyncpg.Connection = Depends(get_db),
):
    """Handle Google's OAuth callback."""
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    redirect_uri = _get_redirect_uri(request, "google")

    if error or not code:
        return RedirectResponse(f"{frontend_url}/?oauth=error&provider=google")

    try:
        # Exchange authorization code for access token
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_res.json()

            if "access_token" not in token_data:
                print(f"[OAuth] Google token exchange failed: {token_data}")
                return RedirectResponse(f"{frontend_url}/?oauth=error&provider=google")

            # Fetch user profile
            profile_res = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            profile = profile_res.json()

        email = profile.get("email")
        name = profile.get("name", email.split("@")[0]) if email else "User"
        avatar_url = profile.get("picture")

        if not email:
            return RedirectResponse(f"{frontend_url}/?oauth=error&provider=google")

        # Upsert user in database
        user = await _upsert_oauth_user(db, email=email, name=name, avatar_url=avatar_url, provider="google")

        if not user.get("is_active", True):
            return RedirectResponse(f"{frontend_url}/?oauth=error&reason=deactivated")

        # Create JWT and set cookie
        token = create_access_token({
            "id": str(user["id"]),
            "email": user["email"],
            "role": user["role"],
            "name": user["name"],
        })

        response = RedirectResponse(f"{frontend_url}/?oauth=success&token={token}", status_code=302)
        _set_auth_cookie(response, token)
        return response

    except Exception as exc:
        print(f"[OAuth] Google callback error: {exc}")
        return RedirectResponse(f"{frontend_url}/?oauth=error&provider=google")


# ═══════════════════════════════════════════════
#  GITHUB OAUTH
# ═══════════════════════════════════════════════

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"


@router.get("/github", tags=["OAuth"])
async def github_login(request: Request):
    """Redirect the user to GitHub's consent screen."""
    redirect_uri = _get_redirect_uri(request, "github")
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email",
    }
    return RedirectResponse(f"{GITHUB_AUTH_URL}?{urlencode(params)}")


@router.get("/github/callback", tags=["OAuth"])
async def github_callback(
    request: Request,
    code: str = "",
    error: str = "",
    db: asyncpg.Connection = Depends(get_db),
):
    """Handle GitHub's OAuth callback."""
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    redirect_uri = _get_redirect_uri(request, "github")

    if error or not code:
        return RedirectResponse(f"{frontend_url}/?oauth=error&provider=github")

    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for access token
            token_res = await client.post(
                GITHUB_TOKEN_URL,
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_res.json()

            access_token = token_data.get("access_token")
            if not access_token:
                print(f"[OAuth] GitHub token exchange failed: {token_data}")
                return RedirectResponse(f"{frontend_url}/?oauth=error&provider=github")

            auth_headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            }

            # Fetch user profile
            profile_res = await client.get(GITHUB_USER_URL, headers=auth_headers)
            profile = profile_res.json()

            # GitHub may not include email in profile — fetch from /user/emails
            email = profile.get("email")
            if not email:
                emails_res = await client.get(GITHUB_EMAILS_URL, headers=auth_headers)
                emails = emails_res.json()
                # Pick the primary verified email
                for e in emails:
                    if e.get("primary") and e.get("verified"):
                        email = e["email"]
                        break
                # Fallback: first verified email
                if not email:
                    for e in emails:
                        if e.get("verified"):
                            email = e["email"]
                            break

            if not email:
                return RedirectResponse(f"{frontend_url}/?oauth=error&provider=github&reason=no_email")

        name = profile.get("name") or profile.get("login", email.split("@")[0])
        avatar_url = profile.get("avatar_url")

        # Upsert user in database
        user = await _upsert_oauth_user(db, email=email, name=name, avatar_url=avatar_url, provider="github")

        if not user.get("is_active", True):
            return RedirectResponse(f"{frontend_url}/?oauth=error&reason=deactivated")

        # Create JWT and set cookie
        token = create_access_token({
            "id": str(user["id"]),
            "email": user["email"],
            "role": user["role"],
            "name": user["name"],
        })

        response = RedirectResponse(f"{frontend_url}/?oauth=success&token={token}", status_code=302)
        _set_auth_cookie(response, token)
        return response

    except Exception as exc:
        print(f"[OAuth] GitHub callback error: {exc}")
        return RedirectResponse(f"{frontend_url}/?oauth=error&provider=github")

