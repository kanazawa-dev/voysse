from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


database_url = get_settings().database_url
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    pool_timeout=5,
    connect_args={"connect_timeout": 5} if database_url.startswith("postgresql") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
