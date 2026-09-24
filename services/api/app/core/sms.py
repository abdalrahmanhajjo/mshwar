"""Sending the phone codes partners confirm their number with.

The backend is chosen by SMS_BACKEND. ``console`` records that a code went out
without the code itself (development); ``twilio`` sends a real SMS. Tests
install ``RecordingSms`` to read the codes back. Never log a code.
"""

from __future__ import annotations

import logging
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger("mshwar.sms")


class SmsError(RuntimeError):
    """The provider refused or could not be reached."""


class Sms(Protocol):
    async def send(self, to: str, body: str, *, code: str | None = None) -> None: ...


class ConsoleSms:
    async def send(self, to: str, body: str, *, code: str | None = None) -> None:
        logger.info("console sms dispatched to_suffix=%s", to[-3:])


class RecordingSms:
    """Keeps every message, so tests can read the code a partner received."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str | None]] = []

    async def send(self, to: str, body: str, *, code: str | None = None) -> None:
        self.sent.append({"to": to, "body": body, "code": code})

    def last_code_for(self, to: str) -> str | None:
        for message in reversed(self.sent):
            if message["to"] == to:
                return message["code"]
        return None


class TwilioSms:
    def __init__(self, account_sid: str, auth_token: str, sender: str) -> None:
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.sender = sender

    async def send(self, to: str, body: str, *, code: str | None = None) -> None:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    url, data={"To": to, "From": self.sender, "Body": body}, auth=(self.account_sid, self.auth_token)
                )
        except httpx.HTTPError as exc:
            raise SmsError("could not reach the SMS provider") from exc
        if response.status_code >= 400:
            raise SmsError(f"SMS provider refused the message ({response.status_code})")


_override: Sms | None = None


def set_sms(backend: Sms | None) -> None:
    global _override
    _override = backend


def get_sms() -> Sms:
    if _override is not None:
        return _override
    if settings.sms_backend == "twilio":
        if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from):
            raise SmsError("SMS is not configured")
        return TwilioSms(settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from)
    return ConsoleSms()
