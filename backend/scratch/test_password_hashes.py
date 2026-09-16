import asyncio
import os
import sys
import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
import asyncpg

async def check_all_hashes():
    db = await asyncpg.connect(settings.DATABASE_URL)
    rows = await db.fetch("""
        SELECT id, name, email, role, auth_provider, is_active, password_hash
        FROM users
        ORDER BY created_at ASC
    """)
    print(f"Total Users: {len(rows)}\n")
    for r in rows:
        email = r['email']
        p_hash = r['password_hash']
        role = r['role']
        provider = r['auth_provider']
        
        if not p_hash:
            print(f"[{email}] - Provider: {provider} | Role: {role} | Hash: NULL (OAuth Account)")
            continue
            
        is_valid_bcrypt = False
        try:
            # Check if bcrypt can parse the hash
            if p_hash.startswith('$2a$') or p_hash.startswith('$2b$') or p_hash.startswith('$2y$'):
                is_valid_bcrypt = True
        except Exception:
            pass
            
        print(f"[{email}] - Provider: {provider} | Role: {role} | Valid Bcrypt Format: {is_valid_bcrypt} | Length: {len(p_hash)}")

    await db.close()

if __name__ == "__main__":
    asyncio.run(check_all_hashes())
