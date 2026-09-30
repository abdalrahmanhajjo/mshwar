"""Stored secrets are encrypted (security plan SEC-45)."""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.api.v1.endpoints import guides as guides_endpoint
from app.core import secret_box
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_after_booking import _ready
from tests.test_guide_tours import _client

URL = "https://calendar.google.com/calendar/ical/secret-part-123/basic.ics"


def test_round_trip_tampering_and_context() -> None:
    sealed = secret_box.encrypt(URL, "calendar-url")
    assert sealed.startswith("v1.") and URL not in sealed
    assert secret_box.decrypt(sealed, "calendar-url") == URL
    assert secret_box.encrypt(URL, "calendar-url") != sealed, "a fresh nonce every time"
    with pytest.raises(secret_box.SecretBoxError):
        secret_box.decrypt(sealed, "another-column")
    tampered = sealed[:-2] + ("A" if sealed[-2] != "A" else "B") + sealed[-1]
    with pytest.raises(secret_box.SecretBoxError):
        secret_box.decrypt(tampered, "calendar-url")
    with pytest.raises(secret_box.SecretBoxError):
        secret_box.decrypt("not-encrypted", "calendar-url")
    assert secret_box.fingerprint(URL, "calendar-url") == secret_box.fingerprint(URL, "calendar-url")
    assert len(secret_box.fingerprint(URL, "calendar-url")) == 64
    assert secret_box.fingerprint(URL, "calendar-url") != secret_box.fingerprint(URL + "x", "calendar-url")


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "anon": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _row(calendar_id: str) -> dict[str, object]:
    async with TestingSessionLocal() as session:
        row = (
            (
                await session.execute(
                    text(
                        "SELECT url, url_ciphertext, url_fingerprint, host FROM app.guide_external_calendars "
                        "WHERE id = CAST(:c AS uuid)"
                    ),
                    {"c": calendar_id},
                )
            )
            .mappings()
            .one()
        )
    return dict(row)


@pytest.mark.asyncio
async def test_a_calendar_address_never_rests_in_plain_text(
    clients: dict[str, AsyncClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    guide = clients["guide"]
    ready = await _ready(clients, "Encrypted calendar walk")
    reads: list[str] = []

    def fake_fetch(url: str) -> str:
        reads.append(url)
        return "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"

    monkeypatch.setattr(guides_endpoint.ical_import, "fetch_calendar", fake_fetch)
    added = await guide.post("/api/v1/guides/me/calendars", json={"url": URL.replace("https://", "webcal://")})
    assert added.status_code == 200, added.text
    calendar = added.json()[0]
    assert calendar["host"] == "calendar.google.com"
    stored = await _row(calendar["id"])
    assert stored["url"] is None, "no plain text in the table"
    assert str(stored["url_ciphertext"]).startswith("v1.") and "secret-part" not in str(stored["url_ciphertext"])
    assert reads == [URL], "the sync reads the real address"

    again = await guide.post("/api/v1/guides/me/calendars", json={"url": URL})
    assert len(again.json()) == 1, "the same calendar is not connected twice"
    bad = await guide.post("/api/v1/guides/me/calendars", json={"url": "http://calendar.example.com/x.ics"})
    assert bad.status_code == 422

    # A calendar saved before encryption is encrypted on its next read.
    async with TestingSessionLocal() as session:
        legacy = (
            await session.execute(
                text(
                    "INSERT INTO app.guide_external_calendars (guide_profile_id, url, label) "
                    "VALUES (CAST(:g AS uuid), 'https://old.example.com/private.ics', 'Old') RETURNING id"
                ),
                {"g": ready["profile"]["id"]},
            )
        ).scalar_one()
        await session.commit()
    synced = await guide.post("/api/v1/guides/me/calendars/sync")
    assert synced.status_code == 200
    converted = await _row(str(legacy))
    assert converted["url"] is None and str(converted["url_ciphertext"]).startswith("v1.")
    assert converted["host"] == "old.example.com"
    assert "https://old.example.com/private.ics" in reads
    async with TestingSessionLocal() as session:
        # Other tests count failed syncs across every guide: leave no calendar behind.
        await session.execute(
            text("DELETE FROM app.guide_external_calendars WHERE guide_profile_id = CAST(:g AS uuid)"),
            {"g": ready["profile"]["id"]},
        )
        await session.commit()


def test_a_rotated_key_still_reads_and_the_pinned_key_survives_a_secret_key_change(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import base64

    from app.core.config import settings

    derived = base64.urlsafe_b64encode(secret_box.current_key()).decode()
    sealed = secret_box.encrypt(URL, "calendar-url")
    # Pinning the derived key keeps old values readable when SECRET_KEY changes.
    monkeypatch.setattr(settings, "data_encryption_key", derived)
    monkeypatch.setattr(settings, "secret_key", "rotated-" + "z" * 40)
    assert secret_box.decrypt(sealed, "calendar-url") == URL and secret_box.is_current(sealed)

    # A new key: the old one is listed as previous, reads still work and ask to re-encrypt.
    monkeypatch.setattr(settings, "data_encryption_key", base64.urlsafe_b64encode(b"n" * 32).decode())
    with pytest.raises(secret_box.SecretBoxError):
        secret_box.decrypt(sealed, "calendar-url")
    monkeypatch.setattr(settings, "data_encryption_previous_keys", f" {derived} ,")
    assert secret_box.decrypt(sealed, "calendar-url") == URL
    assert not secret_box.is_current(sealed)
    assert secret_box.is_current(secret_box.encrypt(URL, "calendar-url"))
    monkeypatch.setattr(settings, "data_encryption_key", "too-short")
    with pytest.raises(ValueError, match="32 bytes"):
        secret_box.encrypt(URL, "calendar-url")
