"""Database session and connection management."""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings
from app.core.logging import logger

DB_CONNECT_TIMEOUT: int = 3
DB_CONNECT_ARGS: dict[str, int] = {"connect_timeout": DB_CONNECT_TIMEOUT}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=DB_CONNECT_ARGS,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    """Base declarative class for SQLAlchemy models."""

    pass


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    """Execute a lightweight query to verify database connectivity."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database connectivity check failed", error=str(exc))
        return False
