from __future__ import annotations

import uuid
from typing import Any

import pytest

from app.core.context import (
    clear_db_session_context,
    clear_session_context,
    get_current_actor,
    get_current_organization_id,
    get_current_user_id,
    set_db_session_context,
    set_local_gucs,
    set_session_context,
)


class _FakeSession:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any] | None]] = []

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> None:
        self.calls.append((str(statement), params))


@pytest.fixture(autouse=True)
def _clear_context() -> None:
    clear_session_context()
    yield
    clear_session_context()


def test_session_context_round_trip() -> None:
    user_id = uuid.UUID("22222222-2222-2222-2222-222222222222")
    org_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    set_session_context(user_id, org_id, "req-1")
    assert get_current_user_id() == user_id
    assert get_current_organization_id() == org_id
    clear_session_context()
    assert get_current_user_id() is None
    assert get_current_organization_id() is None


@pytest.mark.asyncio
async def test_set_local_gucs_uses_set_config() -> None:
    db = _FakeSession()
    await set_local_gucs(db, user_id="u1", organization_id="o1", request_id="r1")  # type: ignore[arg-type]
    assert db.calls[0][1] == {"value": "u1"}
    assert db.calls[1][1] == {"value": "o1"}
    assert db.calls[2][1] == {"value": "r1"}


@pytest.mark.asyncio
async def test_set_db_session_context_requires_ids() -> None:
    with pytest.raises(PermissionError, match="Session context not set"):
        await set_db_session_context(_FakeSession())  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_set_and_clear_db_session_context() -> None:
    user_id = uuid.UUID("22222222-2222-2222-2222-222222222222")
    org_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    set_session_context(user_id, org_id, "req-9")
    db = _FakeSession()
    await set_db_session_context(db)  # type: ignore[arg-type]
    assert any(call[1] and call[1].get("value") == str(user_id) for call in db.calls)
    assert any("set_config('app.user_id'" in sql for sql, _ in db.calls)
    await clear_db_session_context(db)  # type: ignore[arg-type]
    assert get_current_user_id() is None
    assert any("RESET app.user_id" in sql for sql, _ in db.calls)


@pytest.mark.asyncio
async def test_get_current_actor_requires_auth() -> None:
    with pytest.raises(PermissionError, match="Authentication required"):
        await get_current_actor(_FakeSession())  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_get_current_actor_returns_ids() -> None:
    user_id = uuid.UUID("22222222-2222-2222-2222-222222222222")
    org_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    set_session_context(user_id, org_id)
    actor = await get_current_actor(_FakeSession())  # type: ignore[arg-type]
    assert actor == {"user_id": user_id, "organization_id": org_id}
