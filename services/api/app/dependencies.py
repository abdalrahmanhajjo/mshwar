from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.sql_echo,
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


async def get_auth_db() -> AsyncGenerator[AsyncSession, None]:
    """One transaction per request, committed when the handler returns normally.

    Authorization is enforced by the SECURITY DEFINER functions the routers call,
    which receive the signed-in user id explicitly.
    """
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
