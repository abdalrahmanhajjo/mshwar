"""V4: licensed money changers.

A changer shows only while its BDL number matches the current list and a
branch has been visited; the monthly list diff hides changers who drop off it;
posted rates go stale after 12 hours and outliers are held; upheld reports
pause rate posting; counterfeit reports escalate.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.partners_support import (
    apply_changer,
    bdl_number,
    client,
    live_changer,
    load_register,
    make_admin,
    step_up,
)
from tests.test_guide_tours import _register


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"changer": client(), "admin": client(), "traveller": client(), "anon": client(), "peer": client()}
    try:
        yield made
    finally:
        for each in made.values():
            await each.aclose()


@pytest.mark.asyncio
async def test_a_changer_needs_the_bdl_list_and_a_visited_branch(clients: dict[str, AsyncClient]) -> None:
    changer, admin, anon = clients["changer"], clients["admin"], clients["anon"]
    number = bdl_number()
    applied = await apply_changer(changer, number)
    await make_admin(admin)
    case = (await admin.get(f"/api/v1/admin/partners/{applied['id']}")).json()
    for document in case["documents"]:
        await admin.post(f"/api/v1/admin/partners/documents/{document['id']}", json={"decision": "verified"})
    unmatched = await admin.post(f"/api/v1/admin/partners/{applied['id']}", json={"decision": "approved"})
    assert unmatched.status_code == 422 and "video call or visit" in unmatched.text

    diff = await load_register(admin, [{"bdl_number": "0001", "category": "B", "name": "Someone else"}])
    assert any(row["partner_id"] == applied["id"] for row in diff["missing"])
    await admin.post(
        f"/api/v1/admin/exchange/offices/{applied['_office_id']}/verify",
        json={"kind": "visit", "notes": "Shop is there, licence on the wall"},
    )
    not_listed = await admin.post(f"/api/v1/admin/partners/{applied['id']}", json={"decision": "approved"})
    assert not_listed.status_code == 422 and "BDL" in not_listed.text

    wrong_category = await load_register(admin, [{"bdl_number": number, "category": "B"}])
    assert any(row["partner_id"] == applied["id"] for row in wrong_category["category_changed"])
    matched = await load_register(admin, [{"bdl_number": number, "category": "A"}])
    assert matched["matched"] >= 1
    approved = await admin.post(f"/api/v1/admin/partners/{applied['id']}", json={"decision": "approved"})
    assert approved.status_code == 200, approved.text
    assert approved.json()["live"] is True

    listed = (await anon.get("/api/v1/exchange/destinations/byblos")).json()
    branch = next(item for item in listed if item["id"] == applied["_office_id"])
    assert branch["changer"]["bdl_number"] == number and branch["changer"]["category"] == "A"
    assert branch["checked_on"] and branch["rates"] == [] and "recent_rates" not in branch
    assert branch["hours"]["mon"] == [["09:00", "18:00"]]

    # Next month the changer is gone from the list: hidden at once, and told.
    gone = await load_register(admin, [{"bdl_number": "0002", "category": "A"}])
    assert any(row["partner_id"] == applied["id"] for row in gone["missing"])
    assert all(
        item["id"] != applied["_office_id"] for item in (await anon.get("/api/v1/exchange/destinations/byblos")).json()
    )
    async with TestingSessionLocal() as session:
        told = (
            await session.execute(
                text("SELECT count(*) FROM app.outbox WHERE event_type = 'exchange.register_missing'")
            )
        ).scalar_one()
    assert told >= 1
    status = (await admin.get("/api/v1/admin/exchange")).json()
    assert status["overdue"] is False and status["latest"]["entries"] == 1


@pytest.mark.asyncio
async def test_rates_are_fresh_labelled_and_outliers_are_held(clients: dict[str, AsyncClient]) -> None:
    changer, admin, anon, peer, traveller = (
        clients["changer"],
        clients["admin"],
        clients["anon"],
        clients["peer"],
        clients["traveller"],
    )
    our_number = bdl_number()
    ours = await live_changer(changer, admin, our_number)
    listed = [our_number]
    rates = {"office_id": ours["_office_id"], "rates": [{"base": "USD", "buy": 89000, "sell": 89800}]}
    blocked = await changer.post("/api/v1/exchange/me/rates", json=rates)
    assert blocked.status_code == 422 and "step-up" in blocked.text
    await step_up(changer, ours["_secret"])
    wide = await changer.post(
        "/api/v1/exchange/me/rates",
        json={"office_id": ours["_office_id"], "rates": [{"base": "USD", "buy": 80000, "sell": 95000}]},
    )
    assert wide.status_code == 422
    posted = await changer.post("/api/v1/exchange/me/rates", json=rates)
    assert posted.status_code == 200, posted.text
    shown = next(
        item
        for item in (await anon.get("/api/v1/exchange/destinations/byblos")).json()
        if item["id"] == ours["_office_id"]
    )
    assert shown["rates"][0]["buy"] == 89000 and shown["rates"][0]["posted_at"]

    # Two more changers post; a far-off rate is then held rather than shown.
    others = []
    for index in range(2):
        other_admin = client()
        try:
            other_client = peer if index == 0 else client()
            number = bdl_number()
            other = await live_changer(other_client, other_admin, number, also=listed)
            listed.append(number)
            await step_up(other_client, other["_secret"])
            await other_client.post(
                "/api/v1/exchange/me/rates",
                json={"office_id": other["_office_id"], "rates": [{"base": "USD", "buy": 89100, "sell": 89700}]},
            )
            others.append(other_client)
        finally:
            await other_admin.aclose()
    await step_up(changer, ours["_secret"])
    outlier = await changer.post(
        "/api/v1/exchange/me/rates",
        json={"office_id": ours["_office_id"], "rates": [{"base": "USD", "buy": 99000, "sell": 99500}]},
    )
    assert outlier.status_code == 200, outlier.text
    latest = outlier.json()["offices"][0]["recent_rates"][0]
    assert latest["status"] == "held" and "median" in latest["held_reason"]
    shown = next(
        item
        for item in (await anon.get("/api/v1/exchange/destinations/byblos")).json()
        if item["id"] == ours["_office_id"]
    )
    assert shown["rates"][0]["buy"] == 89000, "the held rate does not show; the last live one does"
    held = (await admin.get("/api/v1/admin/exchange")).json()["held_rates"]
    assert any(item["id"] == latest["id"] for item in held)
    assert (
        await admin.post(f"/api/v1/admin/exchange/rates/{latest['id']}", json={"decision": "rejected"})
    ).status_code == 200

    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE app.exchange_rates SET posted_at = now() - interval '13 hours' WHERE office_id = CAST(:o AS uuid)"
            ),
            {"o": ours["_office_id"]},
        )
        await session.commit()
    stale = next(
        item
        for item in (await anon.get("/api/v1/exchange/destinations/byblos")).json()
        if item["id"] == ours["_office_id"]
    )
    assert stale["rates"] == [], "a rate older than 12 hours stops showing"

    # Reports: counterfeit escalates; two upheld rate reports pause posting.
    await _register(traveller, "exchanger")
    fake = await traveller.post(
        "/api/v1/exchange/reports",
        json={"office_id": ours["_office_id"], "category": "counterfeit", "details": "One of the notes was fake"},
    )
    assert fake.json()["escalated"] is True
    cases = []
    for _ in range(2):
        filed = await traveller.post(
            "/api/v1/exchange/reports",
            json={"office_id": ours["_office_id"], "category": "rate_different", "details": "Counter rate was lower"},
        )
        cases.append(filed.json()["id"])
    first = (await admin.post(f"/api/v1/admin/exchange/reports/{cases[0]}/uphold")).json()
    assert first["rates_paused"] is False
    assert (await admin.post(f"/api/v1/admin/exchange/reports/{cases[0]}/uphold")).status_code == 422
    second = (await admin.post(f"/api/v1/admin/exchange/reports/{cases[1]}/uphold")).json()
    assert second["rates_paused"] is True
    await step_up(changer, ours["_secret"])
    paused = await changer.post("/api/v1/exchange/me/rates", json=rates)
    assert paused.status_code == 422 and "paused" in paused.text
    for extra in others[1:]:
        await extra.aclose()


@pytest.mark.asyncio
async def test_moving_a_branch_needs_a_code_and_a_new_visit(clients: dict[str, AsyncClient]) -> None:
    changer, admin, anon = clients["changer"], clients["admin"], clients["anon"]
    ours = await live_changer(changer, admin, bdl_number())
    moved = {
        "id": ours["_office_id"],
        "branch_name": "Old Souk branch",
        "address": "Main road, Byblos",
        "lat": 34.1300,
        "lng": 35.6500,
        "destination": "byblos",
    }
    assert (await changer.put("/api/v1/exchange/me/offices", json=moved)).status_code == 422
    await step_up(changer, ours["_secret"])
    bad_hours = await changer.put("/api/v1/exchange/me/offices", json={**moved, "hours": {"mon": [["18:00", "09:00"]]}})
    assert bad_hours.status_code == 422
    done = await changer.put("/api/v1/exchange/me/offices", json=moved)
    assert done.status_code == 200 and done.json()["offices"][0]["verified"] is False
    assert all(
        item["id"] != ours["_office_id"] for item in (await anon.get("/api/v1/exchange/destinations/byblos")).json()
    )
    assert (await anon.get(f"/api/v1/partners/public/{ours['slug']}")).status_code == 404
