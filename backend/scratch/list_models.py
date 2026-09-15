"""List available Gemini models for the configured API key."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def list_models():
    import httpx
    from app.config import settings
    key = settings.GEMINI_API_KEY.strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code == 200:
            data = res.json()
            models = data.get("models", [])
            gen_models = [m["name"] for m in models if "generateContent" in str(m.get("supportedGenerationMethods", []))]
            print(f"Available models supporting generateContent ({len(gen_models)}):")
            for m in gen_models:
                print(f"  {m}")
        else:
            print(f"Error {res.status_code}: {res.text[:300]}")

asyncio.run(list_models())
