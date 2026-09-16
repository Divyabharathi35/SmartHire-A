import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def main():
    db = await asyncpg.connect(os.environ["DATABASE_URL"])

    row = await db.fetchrow(
        """
        SELECT *
        FROM users
        WHERE LOWER(TRIM(email)) = 'avanthikas@gmail.com'
        """
    )

    if row:
        print("Columns:")
        for key in row.keys():
            print(key, "=", "[PRESENT]" if row[key] is not None else "[NULL]")
    else:
        print("USER NOT FOUND")

    await db.close()

asyncio.run(main())