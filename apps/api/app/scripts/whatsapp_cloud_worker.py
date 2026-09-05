"""Run after migrations: python -m app.scripts.whatsapp_cloud_worker."""
import asyncio
import logging

from ..database import SessionLocal
from ..services.whatsapp_cloud_worker import work_once


async def main():
    while True:
        try:
            with SessionLocal() as db:
                worked = await work_once(db)
        except Exception:
            logging.error("Cloud worker iteration failed; inspect event states")
            worked = False
        if not worked:
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
