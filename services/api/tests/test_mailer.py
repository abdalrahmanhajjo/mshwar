from __future__ import annotations

import pytest

from app.core.mailer import ConsoleMailer, MailMessage, NotificationMailer, RecordingMailer


def test_mail_message_hides_token_from_repr() -> None:
    message = MailMessage(
        to="ada@example.com",
        subject="Reset your Mshwar password",
        text_body="Use this link",
        purpose="password_reset",
        token="super-secret-reset-token",
    )
    assert "super-secret-reset-token" not in repr(message)
    assert message.token == "super-secret-reset-token"


@pytest.mark.asyncio
async def test_recording_mailer_returns_only_issued_reset_tokens() -> None:
    mailer = RecordingMailer()
    await mailer.send(
        MailMessage(
            to="known@example.com",
            subject="Reset",
            text_body="link",
            purpose="password_reset",
            token="issued-token",
        )
    )
    await mailer.send(
        MailMessage(
            to="unknown@example.com",
            subject="Reset",
            text_body="suppressed",
            purpose="password_reset_suppressed",
        )
    )
    assert mailer.reset_tokens_for("known@example.com") == ["issued-token"]
    assert mailer.reset_tokens_for("unknown@example.com") == []


def test_console_and_notification_mailers_exist() -> None:
    assert hasattr(ConsoleMailer, "send")
    assert hasattr(NotificationMailer, "send")
