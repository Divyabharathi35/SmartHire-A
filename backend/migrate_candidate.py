import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

EMAIL = "avanthikas@gmail.com"

async def main():
    local_db = await asyncpg.connect(os.environ["DATABASE_URL"])

    render_url = os.getenv("RENDER_DB_URL")
    if not render_url:
        raise RuntimeError("RENDER_DB_URL is not set")

    render_db = await asyncpg.connect(render_url)

    user = await local_db.fetchrow(
        """
        SELECT *
        FROM users
        WHERE LOWER(TRIM(email)) = $1
        """,
        EMAIL
    )

    if not user:
        print("LOCAL USER NOT FOUND")
        await local_db.close()
        await render_db.close()
        return

    existing = await render_db.fetchrow(
        """
        SELECT id, email
        FROM users
        WHERE LOWER(TRIM(email)) = $1
        """,
        EMAIL
    )

    if existing:
        print("PRODUCTION USER ALREADY EXISTS - NO CHANGE MADE")
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
            user["email"],
            user["password_hash"],
            user["role"],
            user["auth_provider"],
            user["avatar_url"],
            user["is_active"],
            user["last_login_at"],
            user["created_at"],
            user["updated_at"],
        )
        print("PRODUCTION USER CREATED")

    await local_db.close()
    await render_db.close()

asyncio.run(main())