"""Mailer abstraction. Console in development; notification service later.

The notification worker is not wired yet. ``NotificationMailer`` is the
plug-in surface that will enqueue ``app.notifications`` / ``app.outbox``.
Never log reset tokens or plaintext passwords.
"""

from __future__ import annotations

import logging
from typing import Protocol

from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger("mshwar.mailer")


class MailMessage(BaseModel):
    to: str
    subject: str
    text_body: str
    purpose: str
    html_body: str | None = None
    token: str | None = Field(default=None, repr=False)


class Mailer(Protocol):
    async def send(self, message: MailMessage) -> None: ...


class ConsoleMailer:
    """Dev backend: records intent without printing secrets."""

    async def send(self, message: MailMessage) -> None:
        logger.info(
            "console mailer dispatched purpose=%s to_domain=%s",
            message.purpose,
            _email_domain(message.to),
        )


class NotificationMailer:
    """Future notification-service adapter. Safe no-op until the worker exists."""

    async def send(self, message: MailMessage) -> None:
        logger.info(
            "notification mailer queued purpose=%s to_domain=%s",
            message.purpose,
            _email_domain(message.to),
        )


class RecordingMailer:
    """In-memory sink for tests. Tokens stay off logs via Field(repr=False)."""

    def __init__(self) -> None:
        self.messages: list[MailMessage] = []

    async def send(self, message: MailMessage) -> None:
        self.messages.append(message)

    def reset_tokens_for(self, email: str) -> list[str]:
        return [msg.token for msg in self.messages if msg.to == email and msg.purpose == "password_reset" and msg.token]

    def verification_tokens_for(self, email: str) -> list[str]:
        return [
            msg.token for msg in self.messages if msg.to == email and msg.purpose == "email_verification" and msg.token
        ]


def _email_domain(address: str) -> str:
    if "@" not in address:
        return "unknown"
    return address.rsplit("@", 1)[1]


_mailer: Mailer | None = None


def get_mailer() -> Mailer:
    global _mailer
    if _mailer is None:
        if settings.mailer_backend == "notification":
            _mailer = NotificationMailer()
        else:
            _mailer = ConsoleMailer()
    return _mailer


def set_mailer(mailer: Mailer | None) -> None:
    global _mailer
    _mailer = mailer
