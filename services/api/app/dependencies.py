from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.context import clear_db_session_context, set_db_session_context

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_recycle=settings.pool_recycle,
    pool_pre_ping=settings.pool_pre_ping,
    connect_args={
        "timeout": settings.connect_timeout,
        "server_settings": {"statement_timeout": str(settings.statement_timeout_ms)},
    },
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    __table_args__ = {"schema": "app"}  # noqa: RUF012


async def get_auth_db() -> AsyncGenerator[AsyncSession, None]:
    """Session without RLS context — used by register/signin via SECURITY DEFINER."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            await set_db_session_context(session)
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await clear_db_session_context(session)
            await session.close()


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """Read-only session that does not auto-commit."""
    async with async_session() as session:
        try:
            await set_db_session_context(session)
            yield session
        finally:
            await clear_db_session_context(session)
            await session.close()


async def check_connection() -> bool:
    """Verify database connectivity. Returns True if connection succeeds."""
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception:  # noqa: BLE001
        return False
