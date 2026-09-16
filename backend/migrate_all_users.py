import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def main():
    local_db = await asyncpg.connect(os.environ["DATABASE_URL"])

    render_url = os.getenv("RENDER_DB_URL")
    if not render_url:
        raise RuntimeError("RENDER_DB_URL is not set")

    render_db = await asyncpg.connect(render_url)

    users = await local_db.fetch("""
        SELECT
            id, name, email, password_hash, role,
            auth_provider, avatar_url, is_active,
            last_login_at, created_at, updated_at
        FROM users
        ORDER BY created_at
    """)

    created = 0
    existing = 0

    for user in users:
        email = (user["email"] or "").strip().lower()

        if not email:
            continue

        found = await render_db.fetchrow(
            """
            SELECT id
            FROM users
            WHERE LOWER(TRIM(email)) = $1
            """,
            email
        )

        if found:
            existing += 1
            print(f"EXISTS: {email}")
        else:
            await render_db.execute(
                """
                INSERT INTO users
                (
                    id, name, email, password_hash, role,
                    auth_provider, avatar_url, is_active,
                    last_login_at, created_at, updated_at
                )
                VALUES
                ($1, $2, $3, $4, $5,
                 $6, $7, $8,
                 $9, $10, $11)
                """,
                user["id"],
                user["name"],
                email,
                user["password_hash"],
                user["role"],
                user["auth_provider"],
                user["avatar_url"],
                user["is_active"],
                user["last_login_at"],
                user["created_at"],
                user["updated_at"],
            )

            created += 1
            print(f"CREATED: {email}")

    print()
    print(f"Users created: {created}")
    print(f"Users already existing: {existing}")

    await local_db.close()
    await render_db.close()


asyncio.run(main())