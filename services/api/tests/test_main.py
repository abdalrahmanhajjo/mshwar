from collections.abc import AsyncGenerator
from typing import Any

from fastapi.testclient import TestClient

from app.dependencies import get_db
from app.main import app


async def _noop_db() -> AsyncGenerator[Any, None]:
    yield None


app.dependency_overrides[get_db] = _noop_db
client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_api_v1_prefix() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_session_middleware_accepts_context_headers() -> None:
    user_id = "22222222-2222-2222-2222-222222222222"
    org_id = "00000000-0000-0000-0000-000000000001"
    response = client.get(
        "/health",
        headers={"x-user-id": user_id, "x-organization-id": org_id, "x-request-id": "req-1"},
    )
    assert response.status_code == 200


def test_session_middleware_ignores_invalid_ids() -> None:
    response = client.get(
        "/health",
        headers={"x-user-id": "not-a-uuid", "x-organization-id": "also-bad"},
    )
    assert response.status_code == 200


def test_list_and_create_bookings() -> None:
    listed = client.get("/api/v1/bookings")
    assert listed.status_code == 200
    assert listed.json() == []
    created = client.post("/api/v1/bookings", json={"business_id": 9})
    assert created.status_code == 200
    assert created.json() == {"id": 1, "business_id": 9, "status": "confirmed"}


def test_list_create_and_get_businesses() -> None:
    listed = client.get("/api/v1/businesses", params={"q": "beirut", "category": "food"})
    assert listed.status_code == 200
    assert listed.json() == []
    created = client.post(
        "/api/v1/businesses",
        json={"name": "Cafe", "category": "food", "location": "Beirut"},
    )
    assert created.status_code == 200
    assert created.json()["id"] == 1
    assert created.json()["name"] == "Cafe"
    fetched = client.get("/api/v1/businesses/42")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == 42


def test_list_and_create_trips() -> None:
    listed = client.get("/api/v1/trips")
    assert listed.status_code == 200
    assert listed.json() == []
    created = client.post("/api/v1/trips", json={"name": "Weekend"})
    assert created.status_code == 200
    assert created.json() == {"id": 1, "name": "Weekend", "status": "confirmed"}
