import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.security import verify_password
import asyncpg
import httpx

async def test_reset_flow():
    # Test user email
    test_email = "sri@gmail.com"
    new_test_password = "NewPassword@123"

    print("--- 1. Testing Forgot Password API ---")
    async with httpx.AsyncClient(base_url="http://localhost:5000") as client:
        # Check if backend is running or run direct logic
        conn = await asyncpg.connect(settings.DATABASE_URL)
        row_before = await conn.fetchrow("SELECT id, role, password_hash FROM users WHERE email = $1", test_email)
        print(f"User {test_email} - Role: {row_before['role']}")

        from app.routers.auth import forgot_password, reset_password
        from app.schemas import ForgotPasswordRequest, ResetPasswordRequest

        req1 = ForgotPasswordRequest(email=test_email)
        res1 = await forgot_password(req1, conn)
        print(f"Forgot password response: {res1}")
        assert res1.success is True
        assert res1.reset_token is not None
        token = res1.reset_token

        print("\n--- 2. Testing Reset Password API ---")
        req2 = ResetPasswordRequest(token=token, new_password=new_test_password)
        res2 = await reset_password(req2, conn)
        print(f"Reset password response: {res2}")
        assert res2.success is True

        row_after = await conn.fetchrow("SELECT id, role, password_hash FROM users WHERE email = $1", test_email)
        print(f"User {test_email} - Role after reset: {row_after['role']}")
        assert row_before['role'] == row_after['role'], "Role MUST remain unchanged after password reset!"

        valid = verify_password(new_test_password, row_after['password_hash'])
        print(f"Password verification with new password: {valid}")
        assert valid is True

        await conn.close()
        print("\n✅ Password reset flow test PASSED!")

if __name__ == "__main__":
    asyncio.run(test_reset_flow())
