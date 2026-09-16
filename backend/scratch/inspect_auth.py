import asyncio
import os
import sys
import bcrypt

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.security import verify_password
import asyncpg

async def inspect():
    db = await asyncpg.connect(settings.DATABASE_URL)
    rows = await db.fetch("""
        SELECT id, name, email, role, auth_provider, is_active, last_login_at, created_at,
               password_hash IS NULL as is_null_hash,
               length(password_hash) as hash_len,
               LEFT(password_hash, 10) as hash_prefix
        FROM users
        ORDER BY created_at ASC
    """)
    print(f"Total users found: {len(rows)}")
    for r in rows:
        d = dict(r)
        print(f"User: id={d['id']}, email={d['email']}, role={d['role']} (type {type(d['role'])}), provider={d['auth_provider']}, active={d['is_active']}, hash_null={d['is_null_hash']}, hash_len={d['hash_len']}, hash_prefix={d['hash_prefix']}")

    # Let's test standard passwords against existing seed hashes without printing hashes
    # Seed passwords from seed.sql:
    # Admin: admin@smarthire.com / Admin@123
    # Candidate: candidate@smarthire.com / Cand@1234
    # Recruiter: recruiter@smarthire.com / Recruit@123
    # Venu: venu@smarthire.com / Venu@1234

    test_users = [
        ('admin@smarthire.com', 'Admin@123'),
        ('recruiter@smarthire.com', 'Recruit@123'),
        ('candidate@smarthire.com', 'Cand@1234'),
        ('venu@smarthire.com', 'Venu@1234'),
    ]

    print("\nTesting password verification on seed users:")
    for email, test_pw in test_users:
        user_row = await db.fetchrow("SELECT password_hash, role, is_active FROM users WHERE email = $1", email)
        if not user_row:
            print(f"  {email}: NOT FOUND in DB")
        elif not user_row['password_hash']:
            print(f"  {email}: password_hash is NULL")
        else:
            try:
                valid = verify_password(test_pw, user_row['password_hash'])
                print(f"  {email}: verify_password('{test_pw}') -> {valid} | active={user_row['is_active']} | role={user_row['role']}")
            except Exception as e:
                print(f"  {email}: verify_password ERROR -> {e} | active={user_row['is_active']} | role={user_row['role']}")

if __name__ == "__main__":
    asyncio.run(inspect())
