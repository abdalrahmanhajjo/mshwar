from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.core.mailer import MailMessage

_SUBJECTS = {
    "en": {
        "booking.confirmed": "Your Mshwar booking is confirmed",
        "booking.pending": "Your Mshwar booking request is in",
        "booking.cancelled": "Your Mshwar booking was cancelled",
        "booking.rejected": "Your Mshwar booking request was declined",
        "booking.refunded": "Your Mshwar refund was recorded",
        "booking.expired": "Your Mshwar hold expired",
        "default": "Mshwar booking update",
    },
    "ar": {
        "booking.confirmed": "تم تأكيد حجزك في مشوار",
        "booking.pending": "وصل طلب حجزك في مشوار",
        "booking.cancelled": "تم إلغاء حجزك في مشوار",
        "booking.rejected": "رُفض طلب حجزك في مشوار",
        "booking.refunded": "سُجّل استرداد حجزك في مشوار",
        "booking.expired": "انتهت مهلة حجزك في مشوار",
        "default": "تحديث حجز مشوار",
    },
    "fr": {
        "booking.confirmed": "Votre réservation Mshwar est confirmée",
        "booking.pending": "Votre demande de réservation Mshwar est enregistrée",
        "booking.cancelled": "Votre réservation Mshwar a été annulée",
        "booking.rejected": "Votre demande Mshwar a été refusée",
        "booking.refunded": "Votre remboursement Mshwar a été enregistré",
        "booking.expired": "Votre option Mshwar a expiré",
        "default": "Mise à jour de réservation Mshwar",
    },
}


def render_confirmation(record: Mapping[str, Any], locale: str = "en") -> dict[str, str]:
    """Itemise only persisted booking/payment fields. Never invent copy from an LLM."""

    lang = locale if locale in _SUBJECTS else "en"
    raw_booking = record.get("booking")
    booking: Mapping[str, Any] = raw_booking if isinstance(raw_booking, dict) else record
    raw_price = booking.get("price_snapshot")
    price = raw_price if isinstance(raw_price, dict) else {}
    raw_policy = booking.get("policy_snapshot")
    policy = raw_policy if isinstance(raw_policy, dict) else {}
    title = str(booking.get("experience_title") or price.get("experience_title") or "")
    total = booking.get("total_minor")
    currency = booking.get("currency")
    status = str(booking.get("status") or "")
    terms = policy.get("terms") if isinstance(policy, dict) else ""
    lines = [
        title,
        f"{total} {currency}",
        str(status),
        str(terms or ""),
    ]
    body = "\n".join(line for line in lines if line)
    return {
        "locale": lang,
        "title": title,
        "body": body,
        "dir": "rtl" if lang == "ar" else "ltr",
        "from_persisted": "true",
    }


def confirmation_email(to: str, event_type: str, payload: Mapping[str, Any], locale: str = "en") -> MailMessage:
    rendered = render_confirmation(payload, locale)
    subjects = _SUBJECTS.get(locale, _SUBJECTS["en"])
    subject = subjects.get(event_type, subjects["default"])
    return MailMessage(
        to=to,
        subject=subject,
        text_body=rendered["body"] or subject,
        purpose="booking_confirmation",
        html_body=None,
    )
