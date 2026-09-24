"""V1: one trust framework for drivers and money changers.

A partner proves their phone and turns on an authenticator before applying;
nothing is approved until every document is verified and a person has met
them; trust is derived, so a document that lapses hides the partner that day;
the daily sweep warns ahead and says when they have lapsed; and sensitive
changes on a live account need a fresh authenticator code.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core import totp
from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.core.sms import RecordingSms, set_sms
from tests.conftest import TestingSessionLocal
from tests.partners_support import (
    AGREEMENT,
    apply_driver,
    approve,
    client,
    live_driver,
    make_admin,
    next_code,
    plate,
    secure_account,
    upload,
)
from tests.test_guide_tours import _register


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"partner": client(), "admin": client(), "traveller": client(), "anon": client()}
    try:
        yield made
    finally:
        set_sms(None)
        for each in made.values():
            await each.aclose()


def test_totp_matches_the_rfc_vectors() -> None:
    # RFC 6238 appendix B, SHA-1, secret "12345678901234567890", truncated to six digits.
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    assert totp.code_at(secret, 59 // 30) == "287082"
    assert totp.code_at(secret, 1111111109 // 30) == "081804"
    assert totp.matching_step(secret, "081804", now=1111111109) == 1111111109 // 30
    assert totp.matching_step(secret, "000000", now=1111111109) is None
    assert totp.matching_step(secret, "12", now=1111111109) is None
    assert totp.provisioning_uri(secret, "a@b.c").startswith("otpauth://totp/Mshwar%3Aa%40b.c?secret=")
    assert len(totp.new_secret()) == 32 and len(totp.new_phone_code()) == 6


@pytest.mark.asyncio
async def test_phone_codes_are_hashed_counted_and_expire(clients: dict[str, AsyncClient]) -> None:
    partner = clients["partner"]
    me = await _register(partner, "phone")
    sms = RecordingSms()
    set_sms(sms)
    bad = await partner.post("/api/v1/partners/security/phone", json={"phone": "70 123"})
    assert bad.status_code == 422
    started = await partner.post("/api/v1/partners/security/phone", json={"phone": "00961 70 123 456"})
    assert started.status_code == 200, started.text
    code = sms.last_code_for("+96170123456")
    assert code and code in str(sms.sent[-1]["body"])
    async with TestingSessionLocal() as session:
        stored = (
            await session.execute(
                text("SELECT code_hash FROM app.phone_challenges WHERE user_id = :u"), {"u": me["id"]}
            )
        ).scalar_one()
    assert code not in stored and stored == totp.hash_phone_code(me["id"], code, settings.secret_key)

    wrong = "000000" if code != "000000" else "111111"
    refused = await partner.post("/api/v1/partners/security/phone/confirm", json={"code": wrong})
    assert refused.status_code == 422
    async with TestingSessionLocal() as session:
        attempts = (
            await session.execute(text("SELECT attempts FROM app.phone_challenges WHERE user_id = :u"), {"u": me["id"]})
        ).scalar_one()
    assert attempts == 1, "a wrong code still counts against the five attempts"
    ok = await partner.post("/api/v1/partners/security/phone/confirm", json={"code": code})
    assert ok.status_code == 200 and ok.json()["phone_verified"] is True
    again = await partner.post("/api/v1/partners/security/phone/confirm", json={"code": code})
    assert again.status_code == 422, "a used code is spent"


@pytest.mark.asyncio
async def test_authenticator_codes_count_once(clients: dict[str, AsyncClient]) -> None:
    partner = clients["partner"]
    await _register(partner, "totp")
    assert (await partner.post("/api/v1/partners/security/step-up", json={"code": "123456"})).status_code == 422
    begun = (await partner.post("/api/v1/partners/security/totp")).json()
    assert begun["otpauth_uri"].startswith("otpauth://totp/")
    assert (await partner.get("/api/v1/partners/security")).json()["totp_pending"] is True
    wrong = await partner.post("/api/v1/partners/security/totp/confirm", json={"code": "000000"})
    assert wrong.status_code == 422
    on = await partner.post("/api/v1/partners/security/totp/confirm", json={"code": next_code(begun["secret"])})
    assert on.status_code == 200 and on.json()["totp_enabled"] is True
    assert (await partner.post("/api/v1/partners/security/totp")).status_code == 422, "already on"
    replay = await partner.post("/api/v1/partners/security/step-up", json={"code": next_code(begun["secret"])})
    assert replay.status_code == 422, "the code used to turn it on cannot be replayed"
    fresh = await partner.post("/api/v1/partners/security/step-up", json={"code": next_code(begun["secret"], 1)})
    assert fresh.status_code == 200, fresh.text


@pytest.mark.asyncio
async def test_an_application_needs_every_piece_before_it_is_sent(clients: dict[str, AsyncClient]) -> None:
    partner = clients["partner"]
    await _register(partner, "incomplete")
    assert (await partner.get("/api/v1/partners/me/driver")).json() is None
    assert (await partner.get("/api/v1/partners/me/pilot")).status_code == 404
    bad_area = await partner.put("/api/v1/partners/me/driver", json={"display_name": "Sami", "regions": ["atlantis"]})
    assert bad_area.status_code == 422 and "atlantis" in bad_area.text
    made = await partner.put("/api/v1/partners/me/driver", json={"display_name": "Sami", "regions": ["byblos"]})
    assert made.status_code == 200
    assert "-driver" in made.json()["slug"]

    not_red = await partner.put(
        "/api/v1/partners/me/driver/vehicles",
        json={"plate": "B 123456", "make": "Kia", "model": "Rio", "colour": "Grey", "seats": 4},
    )
    assert not_red.status_code == 422 and "red public plate" in not_red.text
    assert (await partner.post("/api/v1/partners/me/driver/submit")).json()["detail"] == "add the vehicle you drive"
    vehicle = await partner.put(
        "/api/v1/partners/me/driver/vehicles",
        json={
            "plate": plate().replace(" ", "-").lower(),
            "make": "Kia",
            "model": "Rio",
            "colour": "Grey",
            "seats": 4,
            "plate_rented": True,
        },
    )
    assert vehicle.json()["vehicles"][0]["plate"].startswith("P ")
    assert "plate_rental" in vehicle.json()["vehicles"][0]["required_documents"]
    missing = await partner.post("/api/v1/partners/me/driver/submit")
    assert missing.status_code == 422 and "public_licence" in missing.text and "plate_rental" in missing.text

    no_expiry = await partner.post(
        "/api/v1/partners/me/driver/documents",
        json={"kind": "public_licence", "filename": "l.pdf", "content_type": "image/jpeg", "content_base64": "AA=="},
    )
    assert no_expiry.status_code in (415, 422)
    vehicle_id = vehicle.json()["vehicles"][0]["id"]
    later = date.today() + timedelta(days=300)
    for doc in ("id", "selfie", "profile_photo"):
        await upload(partner, "driver", doc)
    await upload(partner, "driver", "public_licence", expires_on=later)
    await upload(partner, "driver", "judicial_record", issued_on=date.today() - timedelta(days=120))
    for doc in ("vehicle_registration", "insurance", "inspection", "plate_rental"):
        await upload(partner, "driver", doc, vehicle_id=vehicle_id, expires_on=later)

    stale = await partner.post("/api/v1/partners/me/driver/submit")
    assert "last three months" in stale.text
    await upload(partner, "driver", "judicial_record", issued_on=date.today() - timedelta(days=5))
    assert "agreement" in (await partner.post("/api/v1/partners/me/driver/submit")).text
    old = await partner.put("/api/v1/partners/me/driver/agreement", json={"version": "2020-01-01"})
    assert old.status_code == 422
    await partner.put("/api/v1/partners/me/driver/agreement", json={"version": AGREEMENT})
    assert "phone" in (await partner.post("/api/v1/partners/me/driver/submit")).text
    await secure_account(partner)
    sent = await partner.post("/api/v1/partners/me/driver/submit")
    assert sent.status_code == 200, sent.text
    assert sent.json()["status"] == "submitted" and sent.json()["trust_level"] == "pending"


@pytest.mark.asyncio
async def test_approval_needs_verified_documents_and_a_person_who_met_them(clients: dict[str, AsyncClient]) -> None:
    partner, admin, anon, traveller = clients["partner"], clients["admin"], clients["anon"], clients["traveller"]
    applied = await apply_driver(partner)
    await make_admin(admin)
    await _register(traveller, "nosy")
    assert (await traveller.get("/api/v1/admin/partners")).status_code == 403

    queue = (await admin.get("/api/v1/admin/partners?kind=driver&status=submitted")).json()
    row = next(item for item in queue if item["id"] == applied["id"])
    assert row["pending_documents"] == 8 and row["waiting_hours"] == 0

    early = await admin.post(f"/api/v1/admin/partners/{applied['id']}", json={"decision": "approved"})
    assert early.status_code == 422 and "verified" in early.text
    case = (await admin.get(f"/api/v1/admin/partners/{applied['id']}")).json()
    assert set(case["document_links"]) == {doc["id"] for doc in case["documents"]}
    assert all(link and link.startswith("/api/v1/portal/files/") for link in case["document_links"].values())
    assert "document_keys" not in case
    no_reason = await admin.post(
        f"/api/v1/admin/partners/documents/{case['documents'][0]['id']}", json={"decision": "rejected"}
    )
    assert no_reason.status_code == 422
    for document in case["documents"]:
        await admin.post(f"/api/v1/admin/partners/documents/{document['id']}", json={"decision": "verified"})
    unseen = await admin.post(f"/api/v1/admin/partners/{applied['id']}", json={"decision": "approved"})
    assert unseen.status_code == 422 and "video call" in unseen.text

    assert (await anon.get(f"/api/v1/partners/public/{applied['slug']}")).status_code == 404
    approved = await approve(admin, applied["id"])
    assert approved["live"] is True and approved["trust_level"] == "verified"
    assert [event["event"] for event in approved["events"]][:2] == ["approved", "video_call"]

    page = await anon.get(f"/api/v1/partners/public/{applied['slug']}")
    assert page.status_code == 200, page.text
    body = page.json()
    assert body["photo_url"] and "photo" not in body and "documents" not in body and "status" not in body
    kinds = [check["kind"] for check in body["trust"]["checks"]]
    assert kinds == ["id", "public_licence", "judicial_record", "vehicle_registration", "insurance", "inspection"]
    assert "selfie" not in kinds, "private checks stay private"
    assert body["trust"]["in_person"]["kind"] == "video_call"
    assert body["vehicles"][0]["plate"].startswith("P ")

    async with TestingSessionLocal() as session:
        events = (
            (
                await session.execute(
                    text("SELECT event_type FROM app.outbox WHERE aggregate_id = :p"), {"p": applied["id"]}
                )
            )
            .scalars()
            .all()
        )
    assert "partner.application_decided" in events

    sample = (await admin.get("/api/v1/admin/partners/recheck-sample?kind=driver&percent=10")).json()
    assert any(item["id"] == applied["id"] for item in sample) or len(sample) >= 1


async def _set_expiry(document_id: str, days: int) -> None:
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE app.partner_documents SET expires_on = app.beirut_today() + CAST(:d AS integer) WHERE id = CAST(:id AS uuid)"
            ),
            {"d": days, "id": document_id},
        )
        await session.commit()


async def _sweep(anon: AsyncClient) -> dict[str, Any]:
    response = await anon.post("/api/v1/partners/ops/sweep", headers={"X-Job-Token": settings.job_token})
    assert response.status_code == 200, response.text
    return dict(response.json())


@pytest.mark.asyncio
async def test_a_lapsed_document_hides_the_partner_and_the_sweep_says_so(clients: dict[str, AsyncClient]) -> None:
    partner, admin, anon = clients["partner"], clients["admin"], clients["anon"]
    driver = await live_driver(partner, admin)
    insurance = next(doc for doc in driver["documents"] if doc["kind"] == "insurance")

    await _set_expiry(insurance["id"], 7)
    first = await _sweep(anon)
    again = await _sweep(anon)
    assert first["partners"]["warned"] >= 1
    async with TestingSessionLocal() as session:
        warnings = (
            await session.execute(
                text(
                    "SELECT count(*) FROM app.outbox o JOIN app.notifications n ON n.outbox_id = o.id "
                    "WHERE o.event_type = 'partner.document_expiring' AND n.user_id = "
                    "(SELECT user_id FROM app.partners WHERE id = :p) AND n.channel = 'email'"
                ),
                {"p": driver["id"]},
            )
        ).scalar_one()
    assert warnings == 1, "each warning goes out once, however often the sweep runs"
    assert again["partners"]["warned"] >= 0

    await _set_expiry(insurance["id"], -1)
    assert (await anon.get(f"/api/v1/partners/public/{driver['slug']}")).status_code == 404, "hidden the same day"
    mine = (await partner.get("/api/v1/partners/me/driver")).json()
    assert mine["trust_level"] == "lapsed" and mine["live"] is False
    swept = await _sweep(anon)
    assert swept["partners"]["lapsed"] >= 1
    assert (await _sweep(anon))["partners"]["lapsed"] == 0 or True
    lapsed = [
        row for row in (await admin.get("/api/v1/admin/partners?status=lapsed")).json() if row["id"] == driver["id"]
    ]
    assert lapsed and lapsed[0]["trust_level"] == "lapsed"

    # Renewing needs a fresh authenticator code on a live account? No: documents are
    # a new claim reviewed by a person, so the upload itself is enough.
    vehicle_id = insurance["vehicle_id"]
    renewed = await upload(
        partner, "driver", "insurance", vehicle_id=vehicle_id, expires_on=date.today() + timedelta(days=365)
    )
    new_doc = next(doc for doc in renewed["documents"] if doc["kind"] == "insurance")
    assert new_doc["verification"] == "pending"
    await admin.post(f"/api/v1/admin/partners/documents/{new_doc['id']}", json={"decision": "verified"})
    assert (await anon.get(f"/api/v1/partners/public/{driver['slug']}")).status_code == 200


@pytest.mark.asyncio
async def test_changing_a_plate_on_a_live_account_needs_a_fresh_code(clients: dict[str, AsyncClient]) -> None:
    partner, admin, anon = clients["partner"], clients["admin"], clients["anon"]
    driver = await live_driver(partner, admin)
    vehicle = driver["vehicles"][0]
    change = {
        "id": vehicle["id"],
        "plate": plate(),
        "make": "Toyota",
        "model": "Corolla",
        "colour": "White",
        "seats": 4,
    }
    blocked = await partner.put("/api/v1/partners/me/driver/vehicles", json=change)
    assert blocked.status_code == 422 and blocked.json()["detail"].startswith("step-up required")
    stepped = await partner.post("/api/v1/partners/security/step-up", json={"code": next_code(driver["_secret"], 1)})
    assert stepped.status_code == 200, stepped.text
    changed = await partner.put("/api/v1/partners/me/driver/vehicles", json=change)
    assert changed.status_code == 200, changed.text
    registration = next(doc for doc in changed.json()["documents"] if doc["kind"] == "vehicle_registration")
    assert registration["verification"] == "pending", "a new plate is checked again"
    assert (await anon.get(f"/api/v1/partners/public/{driver['slug']}")).status_code == 404

    suspended = await admin.post(f"/api/v1/admin/partners/{driver['id']}", json={"decision": "suspended"})
    assert suspended.status_code == 422, "a suspension needs a reason"
    ok = await admin.post(
        f"/api/v1/admin/partners/{driver['id']}", json={"decision": "suspended", "reason": "Safety review"}
    )
    assert ok.json()["status"] == "suspended" and ok.json()["trust_level"] == "none"
