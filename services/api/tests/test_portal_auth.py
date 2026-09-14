from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.portal_auth import raise_from_db, resolve_org_id, role_allows, roles_for


def test_role_matrix_is_independent() -> None:
    assert role_allows("inventory", "listings") is True
    assert role_allows("inventory", "bookings") is False
    assert role_allows("bookings", "bookings") is True
    assert role_allows("bookings", "listings") is False
    assert role_allows("finance", "finance") is True
    assert role_allows("finance", "settings") is False
    assert role_allows("owner", "settings") is True
    assert "inventory" in roles_for("listings")
    assert "bookings" not in roles_for("listings")


def test_resolve_org_prefers_explicit() -> None:
    request = SimpleNamespace(headers={"x-organization-id": "header-org"})
    assert resolve_org_id(request, "explicit-org") == "explicit-org"
    assert resolve_org_id(request, None) == "header-org"


def test_raise_from_db_maps_sqlstates() -> None:
    class Orig:
        sqlstate = "42501"
        diag = SimpleNamespace(message_primary="capability denied")

    with pytest.raises(HTTPException) as denied:
        raise_from_db(SimpleNamespace(orig=Orig()))
    assert denied.value.status_code == 403
