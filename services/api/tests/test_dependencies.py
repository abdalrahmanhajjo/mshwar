from __future__ import annotations

import uuid

import pytest

from app.core.context import clear_session_context, set_session_context
from app.dependencies import check_connection, get_auth_db, get_db, get_read_db


@pytest.mark.asyncio
async def test_check_connection() -> None:
    assert await check_connection() is True


@pytest.mark.asyncio
async def test_get_auth_db_does_not_require_session_context() -> None:
    agen = get_auth_db()
    session = await agen.__anext__()
    assert session is not None
    await agen.aclose()


@pytest.mark.asyncio
async def test_get_db_requires_session_context() -> None:
    agen = get_db()
    with pytest.raises(PermissionError, match="Session context not set"):
        await agen.__anext__()
    await agen.aclose()


@pytest.mark.asyncio
async def test_get_read_db_requires_session_context() -> None:
    agen = get_read_db()
    with pytest.raises(PermissionError, match="Session context not set"):
        await agen.__anext__()
    await agen.aclose()


@pytest.mark.asyncio
async def test_get_db_and_read_db_with_context() -> None:
    user_id = uuid.UUID("22222222-2222-2222-2222-222222222222")
    org_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    set_session_context(user_id, org_id, "req-db")
    try:
        agen = get_db()
        session = await agen.__anext__()
        assert session is not None
        await agen.aclose()

        read_agen = get_read_db()
        read_session = await read_agen.__anext__()
        assert read_session is not None
        await read_agen.aclose()
    finally:
        clear_session_context()
