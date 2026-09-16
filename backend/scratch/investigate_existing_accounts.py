import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.security import verify_password
import asyncpg

async def main():
    conn = await asyncpg.connect(settings.DATABASE_URL)
    rows = await conn.fetch("SELECT id, name, email, role, auth_provider, is_active, password_hash, created_at FROM users ORDER BY created_at ASC")
    
    print(f"Total Users in DB: {len(rows)}\n")
    print(f"{'Email':<30} | {'Role':<10} | {'Provider':<10} | {'Active':<6} | {'Hash Type/Len':<15}")
    print("-" * 80)
    for r in rows:
        email = r['email']
        role = str(r['role'])
        provider = str(r['auth_provider'])
        active = r['is_active']
        p_hash = r['password_hash']
        hash_info = f"len={len(p_hash)}" if p_hash else "NULL"
        if p_hash and p_hash.startswith("$2b$"):
            hash_info += " ($2b bcrypt)"
        elif p_hash and p_hash.startswith("$2a$"):
            hash_info += " ($2a bcrypt)"
        print(f"{email:<30} | {role:<10} | {provider:<10} | {str(active):<6} | {hash_info:<15}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
