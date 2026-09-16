import asyncio
import asyncpg
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.config import settings

async def inspect_db(dsn, name):
    print(f"\n=================== {name} ===================")
    if dsn.startswith("postgres://"):
        dsn = dsn.replace("postgres://", "postgresql://", 1)
    
    try:
        conn = await asyncpg.connect(dsn)
    except Exception as e:
        print(f"Could not connect to {name}: {e}")
        return None

    try:
        users = await conn.fetch("""
            SELECT u.id, u.name, u.email, u.role, u.auth_provider, u.is_active,
                   COUNT(s.id) as session_count
            FROM users u
            LEFT JOIN interview_sessions s ON u.id = s.user_id
            GROUP BY u.id, u.name, u.email, u.role, u.auth_provider, u.is_active
            ORDER BY session_count DESC, u.created_at DESC;
        """)
        
        print(f"Total Users in {name}: {len(users)}")
        print(f"{'Email':<35} | {'Role':<10} | {'Provider':<8} | {'Active':<6} | {'Sessions'}")
        print("-" * 75)
        for u in users:
            print(f"{u['email']:<35} | {u['role']:<10} | {u['auth_provider']:<8} | {str(u['is_active']):<6} | {u['session_count']}")

        sessions = await conn.fetch("SELECT COUNT(*) FROM interview_sessions;")
        results = await conn.fetch("SELECT COUNT(*) FROM interview_results;")
        print(f"\nSummary in {name}:")
        print(f"  Total Interview Sessions: {sessions[0]['count']}")
        print(f"  Total Interview Results:  {results[0]['count']}")
        
        return users
    finally:
        await conn.close()

async def main():
    render_dsn = settings.DATABASE_URL
    local_dsn = "postgresql://postgres:diviR31%40@localhost:5432/smarthire"
    
    await inspect_db(render_dsn, "RENDER PRODUCTION DB")
    await inspect_db(local_dsn, "LOCAL POSTGRES DB")

if __name__ == "__main__":
    asyncio.run(main())
