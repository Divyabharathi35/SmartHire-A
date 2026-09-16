import asyncio
import asyncpg
import bcrypt
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.config import settings
from app.security import verify_password, hash_password

async def main():
    dsn = settings.DATABASE_URL
    if dsn.startswith("postgres://"):
        dsn = dsn.replace("postgres://", "postgresql://", 1)
    
    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch("SELECT id, name, email, password_hash, role, is_active, auth_provider FROM users;")
        print(f"Total Users: {len(rows)}")
        
        for r in rows:
            email = r["email"]
            pw_hash = r["password_hash"]
            is_active = r["is_active"]
            provider = r["auth_provider"]
            
            # Check if bcrypt checkpw works on this hash without throwing exception
            is_valid_bcrypt = False
            if pw_hash:
                try:
                    # Test checking against a dummy password to ensure hash structure is parseable by bcrypt
                    bcrypt.checkpw(b"DummyPassword123!", pw_hash.strip().encode("utf-8"))
                    is_valid_bcrypt = True
                except Exception as e:
                    is_valid_bcrypt = f"ERROR: {e}"
            else:
                is_valid_bcrypt = "NULL"
                
            print(f"Email: {email:<30} | Provider: {provider:<8} | Active: {is_active} | Bcrypt Parseable: {is_valid_bcrypt}")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
