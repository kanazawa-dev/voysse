"""Run with: python -m app.scripts.social_worker (after alembic upgrade head)."""
import asyncio
import logging

from ..database import SessionLocal
from ..services.worker_health import record_progress, reset
from ..services.social_worker import work_once


async def main():
    reset()
    while True:
        try:
            with SessionLocal() as db:
                worked = await work_once(db)
            record_progress()
        except Exception:
            # Never log payloads, tokens or exception URLs.
            logging.error("Social worker iteration failed; database transaction rolled back")
            worked = False
        if not worked:
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
