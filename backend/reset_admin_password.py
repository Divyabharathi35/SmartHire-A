#!/usr/bin/env python3
"""
SmartHire — Secure Admin Password Reset (LOCAL DEVELOPMENT ONLY)

Usage:
    python reset_admin_password.py

This script:
  - Prompts for the new password via getpass (hidden input)
  - Validates the target account is role=admin and is_active
  - Reuses the project's existing bcrypt password hashing (app.security)
  - Updates only the password_hash column in the database
  - Never prints, logs, or returns the plaintext password
"""
import asyncio
import getpass
import re
import sys

import asyncpg

# Reuse the project's own modules
from app.config import settings
from app.security import hash_password

TARGET_EMAIL = "admin@gmail.com"


def validate_password_strength(pwd: str) -> list[str]:
    """Same rules as RegisterRequest in schemas.py."""
    errors = []
    if len(pwd) < 8:
        errors.append("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", pwd):
        errors.append("Password must contain an uppercase letter")
    if not re.search(r"[a-z]", pwd):
        errors.append("Password must contain a lowercase letter")
    if not re.search(r"\d", pwd):
        errors.append("Password must contain a number")
    if not re.search(r"[@$!%*?&]", pwd):
        errors.append("Password must contain a special character (@$!%*?&)")
    return errors


async def main():
    print("=" * 56)
    print("  SmartHire — Secure Admin Password Reset")
    print("  LOCAL DEVELOPMENT ONLY")
    print("=" * 56)
    print()

    # ── 1. Connect to database ──
    try:
        conn = await asyncpg.connect(dsn=settings.DATABASE_URL)
    except Exception as exc:
        print(f"[ERROR] Could not connect to database: {exc}")
        sys.exit(1)

    try:
        # ── 2. Verify target account ──
        row = await conn.fetchrow(
            "SELECT id, name, email, role, is_active FROM users WHERE email = $1",
            TARGET_EMAIL,
        )

        if not row:
            print(f"[ERROR] No user found with email: {TARGET_EMAIL}")
            sys.exit(1)

        role = str(row["role"]).lower()
        if role != "admin":
            print(f"[ERROR] Account {TARGET_EMAIL} has role '{role}', expected 'admin'.")
            print("        This script only resets passwords for admin accounts.")
            sys.exit(1)

        if not row["is_active"]:
            print(f"[ERROR] Account {TARGET_EMAIL} is deactivated.")
            sys.exit(1)

        print(f"  Target account : {row['name']} <{row['email']}>")
        print(f"  Role           : {role}")
        print(f"  Status         : {'active' if row['is_active'] else 'inactive'}")
        print()

        # ── 3. Prompt for new password (hidden input) ──
        new_password = getpass.getpass("  Enter new password: ")
        if not new_password:
            print("[ERROR] Password cannot be empty.")
            sys.exit(1)

        confirm_password = getpass.getpass("  Confirm password:   ")
        if new_password != confirm_password:
            print("[ERROR] Passwords do not match.")
            sys.exit(1)

        # ── 4. Validate password strength ──
        errors = validate_password_strength(new_password)
        if errors:
            print("\n[ERROR] Password does not meet requirements:")
            for e in errors:
                print(f"  - {e}")
            sys.exit(1)

        # ── 5. Hash using the project's existing bcrypt utility ──
        pw_hash = hash_password(new_password)

        # ── 6. Update the database ──
        await conn.execute(
            "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
            pw_hash,
            row["id"],
        )

        print()
        print("  ✅ Password updated successfully.")
        print(f"  Account: {TARGET_EMAIL}")
        print(f"  Role:    admin")
        print()
        print("  You can now log in at http://localhost:5173")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
