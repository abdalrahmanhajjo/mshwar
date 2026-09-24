"""Twilio delivery of partner phone codes, without calling Twilio."""

from __future__ import annotations

import httpx
import pytest

from app.core.config import settings
from app.core.sms import ConsoleSms, SmsError, TwilioSms, get_sms, set_sms

SID = "AC" + "1" * 32


def _twilio(sender: str, respond: int = 201) -> tuple[TwilioSms, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(respond, json={"sid": "SM1"})

    return TwilioSms(SID, "token", sender, transport=httpx.MockTransport(handler)), seen


async def test_sends_from_a_number_or_a_sender_id() -> None:
    sms, seen = _twilio("+15550001111")
    await sms.send("+9613123456", "Your Mshwar code is 123456.", code="123456")
    request = seen[0]
    assert str(request.url) == f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json"
    body = request.content.decode()
    assert "From=%2B15550001111" in body and "To=%2B9613123456" in body
    assert request.headers["authorization"].startswith("Basic ")


async def test_a_messaging_service_picks_the_sender() -> None:
    sms, seen = _twilio("MG" + "2" * 32)
    await sms.send("+9613123456", "hi")
    body = seen[0].content.decode()
    assert "MessagingServiceSid=MG" in body and "From=" not in body


async def test_a_refusal_or_an_outage_is_an_sms_error() -> None:
    sms, _ = _twilio("+15550001111", respond=400)
    with pytest.raises(SmsError, match="400"):
        await sms.send("+9613123456", "hi")

    def down(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(SmsError, match="reach"):
        await TwilioSms(SID, "t", "+1", transport=httpx.MockTransport(down)).send("+9613123456", "hi")


def test_backend_follows_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    set_sms(None)
    monkeypatch.setattr(settings, "sms_backend", "console")
    assert isinstance(get_sms(), ConsoleSms)
    monkeypatch.setattr(settings, "sms_backend", "twilio")
    monkeypatch.setattr(settings, "twilio_account_sid", SID)
    monkeypatch.setattr(settings, "twilio_auth_token", "token")
    monkeypatch.setattr(settings, "twilio_from", "Mshwar")
    assert isinstance(get_sms(), TwilioSms)
    monkeypatch.setattr(settings, "twilio_from", "")
    with pytest.raises(SmsError):
        get_sms()


async def test_the_test_script_refuses_to_pretend(monkeypatch: pytest.MonkeyPatch) -> None:
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "send_test_sms", Path(__file__).parents[1] / "scripts/send_test_sms.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert await module.send("0312345") == 2
    monkeypatch.setattr(settings, "sms_backend", "console")
    assert await module.send("+9613123456") == 1
