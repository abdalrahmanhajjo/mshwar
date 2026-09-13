from collections.abc import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

import app.models
import app.models.base
import app.models.types  # noqa: F401
from app.core.config import settings
from app.core.context import clear_session_context, set_session_context

# Use PostgreSQL for extension smoke tests; SQLite for unit tests
test_engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
    pool_pre_ping=True,
)
TestingSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


class TestBase(DeclarativeBase):
    pass


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def db_session_with_context() -> AsyncGenerator[AsyncSession, None]:
    """Session fixture with default session context set for testing."""

    set_session_context(
        user_id="00000000-0000-0000-0000-000000000001",
        organization_id="00000000-0000-0000-0000-000000000001",
    )
    async with TestingSessionLocal() as session:
        try:
            await session.execute("SET LOCAL app.user_id = '00000000-0000-0000-0000-000000000001'")
            await session.execute("SET LOCAL app.organization_id = '00000000-0000-0000-0000-000000000001'")
            yield session
            await session.rollback()
        finally:
            await session.execute("RESET app.user_id")
            await session.execute("RESET app.organization_id")
            clear_session_context()
