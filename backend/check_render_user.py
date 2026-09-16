import os
import asyncio
import asyncpg
from dotenv import load_dotenv
load_dotenv()

async def main():
    db = await asyncpg.connect(os.environ["DATABASE_URL"])

    rows = await db.fetch(
        """
        SELECT id, email, role, is_active
        FROM users
        WHERE LOWER(TRIM(email)) = 'avanthikas@gmail.com'
        """
    )

    for row in rows:
        print(dict(row))

    if not rows:
        print("USER NOT FOUND")

    await db.close()

asyncio.run(main())