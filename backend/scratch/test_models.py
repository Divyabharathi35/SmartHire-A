"""Test specific Gemini models that are listed as available."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test():
    import httpx
    from app.config import settings
    key = settings.GEMINI_API_KEY.strip()
    
    # Test the models that are available
    models_to_test = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-pro"]
    prompt = "Return a JSON array with exactly 1 object: [{\"question_number\": 1, \"question_text\": \"What is polymorphism?\", \"category\": \"OOP\", \"expected_answer_points\": [\"Inheritance\", \"Method overriding\"], \"sample_answer\": \"Polymorphism allows objects to take many forms.\"}]"

    for model in models_to_test:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        print(f"Testing {model}...")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"response_mime_type": "application/json"}
                })
                print(f"  Status: {res.status_code}")
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            print(f"  SUCCESS! Response: {parts[0]['text'][:200]}")
                            return model
                    print(f"  Unexpected response structure")
                else:
                    # Show just error message, not the key
                    error_text = res.text[:300]
                    print(f"  Error: {error_text}")
        except Exception as e:
            print(f"  Exception: {type(e).__name__}: {e}")
        print()
    
    return None

result = asyncio.run(test())
if result:
    print(f"\n✅ WORKING MODEL FOUND: {result}")
else:
    print(f"\n❌ No working model found")
