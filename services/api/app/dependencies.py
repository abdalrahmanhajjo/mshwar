from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_recycle=settings.pool_recycle,
    pool_pre_ping=settings.pool_pre_ping,
    connect_args={
        "connect_timeout": settings.connect_timeout,
        "options": f"-c statement_timeout={settings.statement_timeout_ms}",
    },
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """Read-only session that does not auto-commit."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def check_connection() -> bool:
    """Verify database connectivity. Returns True if connection succeeds."""
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception:
        return False
