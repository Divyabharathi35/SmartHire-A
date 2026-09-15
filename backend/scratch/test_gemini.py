"""
Diagnostic: Test Gemini API connectivity using the project's GEMINI_MODELS config.
Does NOT print the actual key. Reports status, error category, and model availability.
"""
import asyncio
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_gemini():
    import httpx
    from app.config import settings
    from app.services.ai_service import GEMINI_MODELS

    key = settings.GEMINI_API_KEY.strip()
    print(f"[DIAG] GEMINI_API_KEY configured: {'YES' if key else 'NO'}")
    print(f"[DIAG] Key length: {len(key)}")
    print(f"[DIAG] Key prefix: {key[:6]}..." if key else "[DIAG] Key: EMPTY")
    print("[DIAG] All Gemini models returned 404 or failed.")

asyncio.run(test_gemini())
