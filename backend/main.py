# ============================================================
#  main.py — FastAPI Application Entry Point
# ============================================================
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import close_pool, get_pool
from app.routers import admin, analysis, auth, interviews, notifications, oauth, users
from app.services.emotion_service import EmotionService

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialise connection pool
    print("[SmartHire] API starting...")
    pool = await get_pool()
    print("[SmartHire] PostgreSQL connected successfully")
    try:
        from apply_migrations import main as run_migrations
        await run_migrations()
    except Exception as e:
        print(f"[SmartHire] Startup migration check warning: {e}")

    # Initialize PyTorch Emotion Service
    try:
        EmotionService.initialize()
    except Exception as e:
        print(f"[SmartHire] PyTorch Emotion Service startup warning: {e}")

    yield
    # Shutdown: close pool
    await close_pool()
    print("[SmartHire] API shut down")


app = FastAPI(
    title="SmartHire API",
    description="Authentication & User Management for SmartHire AI Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ────────────────────────────────────────────────────
frontend_url_clean = settings.FRONTEND_URL.rstrip('/')
allowed_origins = list(set([
    frontend_url_clean,
    f"{frontend_url_clean}/",
    "https://neon-cannoli-d7aebc.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,            # Required for cookies and auth headers
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(users.router)
app.include_router(interviews.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(analysis.router, prefix="/api")



# ── Health check ─────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health():
    return {"success": True, "message": "SmartHire API is running 🚀"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
