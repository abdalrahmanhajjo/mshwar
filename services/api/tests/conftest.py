import os
from collections.abc import AsyncGenerator, Iterator

# Test-session defaults. Must be set before app.core.config builds the settings singleton.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENABLE_DEV_ENDPOINTS", "true")

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.rate_limit import limiter

test_engine = create_async_engine(
    settings.database_url,
    echo=settings.sql_echo,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
    pool_pre_ping=True,
)
TestingSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _fresh_rate_limits() -> Iterator[None]:
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()
