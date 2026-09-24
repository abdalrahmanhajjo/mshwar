"""Shared steps for partner tests: a driver or changer from sign-up to live."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import uuid4

from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core import totp
from app.core.sms import RecordingSms, set_sms
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.media_fixtures import b64, tiny_jpeg
from tests.test_guide_tours import _register

AGREEMENT = "2026-09-23"


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def next_code(secret: str, offset: int = 0) -> str:
    return totp.code_at(secret, totp.current_step() + offset)


async def secure_account(partner: AsyncClient, phone: str | None = None) -> str:
    """Verify a phone and turn on an authenticator. Returns the TOTP secret."""
    sms = RecordingSms()
    set_sms(sms)
    phone = phone or f"+9617{uuid4().int % 10**7:07d}"
    started = await partner.post("/api/v1/partners/security/phone", json={"phone": phone})
    assert started.status_code == 200, started.text
    code = sms.last_code_for(phone)
    assert code
    confirmed = await partner.post("/api/v1/partners/security/phone/confirm", json={"code": code})
    assert confirmed.status_code == 200, confirmed.text
    begun = (await partner.post("/api/v1/partners/security/totp")).json()
    secret = begun["secret"]
    on = await partner.post("/api/v1/partners/security/totp/confirm", json={"code": next_code(secret)})
    assert on.status_code == 200, on.text
    set_sms(None)
    return str(secret)


async def upload(partner: AsyncClient, kind: str, doc: str, **extra: Any) -> dict[str, Any]:
    body = {"kind": doc, "filename": f"{doc}.jpg", "content_type": "image/jpeg", "content_base64": b64(tiny_jpeg())}
    body.update({key: (value.isoformat() if isinstance(value, date) else value) for key, value in extra.items()})
    response = await partner.post(f"/api/v1/partners/me/{kind}/documents", json=body)
    assert response.status_code == 200, response.text
    return dict(response.json())


def plate() -> str:
    return f"P {uuid4().int % 900000 + 100000}"


async def make_admin(admin: AsyncClient) -> dict[str, Any]:
    user = await _register(admin, "admin")
    async with TestingSessionLocal() as session:
        await session.execute(text("SELECT app.grant_platform_admin(:u, NULL, 'ops')"), {"u": user["id"]})
        await session.commit()
    return user


async def apply_driver(partner: AsyncClient, regions: list[str] | None = None) -> dict[str, Any]:
    """A complete driver application, sent for review."""
    await _register(partner, "driver")
    secret = await secure_account(partner)
    profile = await partner.put(
        "/api/v1/partners/me/driver",
        json={"display_name": "Karim Nassar", "languages": ["ar", "en"], "regions": regions or ["byblos", "beirut"]},
    )
    assert profile.status_code == 200, profile.text
    vehicle = await partner.put(
        "/api/v1/partners/me/driver/vehicles",
        json={"plate": plate(), "make": "Toyota", "model": "Corolla", "colour": "White", "seats": 4},
    )
    assert vehicle.status_code == 200, vehicle.text
    vehicle_id = vehicle.json()["vehicles"][0]["id"]
    soon = date.today() + timedelta(days=400)
    await upload(partner, "driver", "id", reference="ID-1")
    await upload(partner, "driver", "selfie")
    await upload(partner, "driver", "profile_photo")
    await upload(partner, "driver", "public_licence", reference="PL-778", expires_on=soon)
    await upload(partner, "driver", "judicial_record", issued_on=date.today() - timedelta(days=10))
    await upload(partner, "driver", "vehicle_registration", vehicle_id=vehicle_id, reference="P")
    await upload(partner, "driver", "insurance", vehicle_id=vehicle_id, expires_on=soon)
    await upload(partner, "driver", "inspection", vehicle_id=vehicle_id, expires_on=soon)
    assert (await partner.put("/api/v1/partners/me/driver/agreement", json={"version": AGREEMENT})).status_code == 200
    sent = await partner.post("/api/v1/partners/me/driver/submit")
    assert sent.status_code == 200, sent.text
    result = dict(sent.json())
    result["_secret"] = secret
    return result


async def approve(admin: AsyncClient, partner_id: str) -> dict[str, Any]:
    case = (await admin.get(f"/api/v1/admin/partners/{partner_id}")).json()
    for document in case["documents"]:
        reviewed = await admin.post(f"/api/v1/admin/partners/documents/{document['id']}", json={"decision": "verified"})
        assert reviewed.status_code == 200, reviewed.text
    called = await admin.post(
        f"/api/v1/admin/partners/{partner_id}/checks",
        json={"kind": "video_call", "notes": "Matched face to ID and saw the plate on camera"},
    )
    assert called.status_code == 200, called.text
    approved = await admin.post(f"/api/v1/admin/partners/{partner_id}", json={"decision": "approved"})
    assert approved.status_code == 200, approved.text
    return dict(approved.json())


async def live_driver(partner: AsyncClient, admin: AsyncClient, regions: list[str] | None = None) -> dict[str, Any]:
    applied = await apply_driver(partner, regions)
    await make_admin(admin)
    approved = await approve(admin, applied["id"])
    approved["_secret"] = applied["_secret"]
    return approved


def bdl_number() -> str:
    return f"{uuid4().int % 9000 + 1000}"


async def apply_changer(partner: AsyncClient, number: str, category: str = "A") -> dict[str, Any]:
    """A complete money-changer application with one branch in Byblos."""
    await _register(partner, "changer")
    secret = await secure_account(partner)
    made = await partner.put(
        "/api/v1/partners/me/changer", json={"display_name": "Jbeil Exchange", "languages": ["ar", "en", "fr"]}
    )
    assert made.status_code == 200, made.text
    licence = await partner.put(
        "/api/v1/exchange/me/licence",
        json={"bdl_number": number, "category": category, "legal_name": "Jbeil Exchange SARL"},
    )
    assert licence.status_code == 200, licence.text
    office = await partner.put(
        "/api/v1/exchange/me/offices",
        json={
            "branch_name": "Old Souk branch",
            "address": "Rue du Port, Byblos",
            "lat": 34.1213,
            "lng": 35.6475,
            "destination": "byblos",
            "hours": {"mon": [["09:00", "18:00"]], "sat": [["09:00", "13:00"]]},
        },
    )
    assert office.status_code == 200, office.text
    office_id = office.json()["offices"][0]["id"]
    await upload(partner, "changer", "id")
    await upload(partner, "changer", "selfie")
    await upload(partner, "changer", "bdl_registration", reference=number)
    await upload(partner, "changer", "commercial_register")
    await upload(partner, "changer", "storefront_photo", office_id=office_id)
    assert (await partner.put("/api/v1/partners/me/changer/agreement", json={"version": AGREEMENT})).status_code == 200
    sent = await partner.post("/api/v1/partners/me/changer/submit")
    assert sent.status_code == 200, sent.text
    result = dict(sent.json())
    result["_secret"] = secret
    result["_office_id"] = office_id
    return result


async def load_register(admin: AsyncClient, entries: list[dict[str, str]]) -> dict[str, Any]:
    loaded = await admin.post(
        "/api/v1/admin/exchange/register",
        json={
            "published_on": date.today().isoformat(),
            "source_url": "https://www.bdl.gov.lb/institutions.php",
            "entries": entries,
        },
    )
    assert loaded.status_code == 200, loaded.text
    return dict(loaded.json())


async def live_changer(
    partner: AsyncClient, admin: AsyncClient, number: str, also: list[str] | None = None
) -> dict[str, Any]:
    """Live changer. ``also``: numbers already live that must stay on the reloaded list."""
    applied = await apply_changer(partner, number)
    await make_admin(admin)
    listed = [number, *(also or [])]
    await load_register(admin, [{"bdl_number": each, "category": "A", "name": "Listed changer"} for each in listed])
    case = (await admin.get(f"/api/v1/admin/partners/{applied['id']}")).json()
    for document in case["documents"]:
        await admin.post(f"/api/v1/admin/partners/documents/{document['id']}", json={"decision": "verified"})
    visited = await admin.post(
        f"/api/v1/admin/exchange/offices/{applied['_office_id']}/verify",
        json={"kind": "visit", "notes": "Licence number on the wall matches the BDL list"},
    )
    assert visited.status_code == 200, visited.text
    approved = await admin.post(f"/api/v1/admin/partners/{applied['id']}", json={"decision": "approved"})
    assert approved.status_code == 200, approved.text
    result = dict(approved.json())
    result["_secret"] = applied["_secret"]
    result["_office_id"] = applied["_office_id"]
    return result


async def step_up(partner: AsyncClient, secret: str) -> None:
    """A fresh authenticator code. Real clocks move on; tests rewind the replay guard instead."""
    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.partner_security SET totp_last_step = 0 WHERE totp_secret = :s"), {"s": secret}
        )
        await session.commit()
    stepped = await partner.post("/api/v1/partners/security/step-up", json={"code": next_code(secret)})
    assert stepped.status_code == 200, stepped.text
