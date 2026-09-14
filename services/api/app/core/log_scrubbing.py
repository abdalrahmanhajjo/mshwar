"""Central sensitive-field registry used by Python logging and Sentry."""

from __future__ import annotations

import logging
import re
import traceback
from contextvars import ContextVar
from typing import Any

REDACTED = "[REDACTED]"
SENSITIVE_FIELDS = frozenset(
    {
        "password",
        "password_hash",
        "secret",
        "secret_key",
        "api_key",
        "authorization",
        "cookie",
        "set_cookie",
        "token",
        "access_token",
        "refresh_token",
        "token_hash",
        "signature",
        "stripe_signature",
        "client_secret",
        "payment_id",
        "payment_intent",
        "provider_ref",
        "external_id",
        "provider_account",
        "email",
        "phone",
        "content_base64",
        "text_body",
        "html_body",
        "raw_text",
        "prompt",
        "body",
        "data",
    }
)
request_id: ContextVar[str] = ContextVar("security_request_id", default="")
_FIELD = re.compile(
    r"""(?ix)(["']?(?:password(?:_hash)?|secret(?:_key)?|api_key|authorization|cookie|token(?:_hash)?|access_token|refresh_token|client_secret|payment_id|provider_ref|email|phone)["']?\s*[:=]\s*)(?:["'][^"']*["']|[^\s,;}]+)"""
)
_BEARER = re.compile(r'(?i)\bBearer\s+[^\s,;"\']+')
_PROVIDER = re.compile(r"\b(?:pi|pm|cus|ch|re|acct|evt|sk|pk)_(?:test_|live_)?[A-Za-z0-9_]+\b")
_URL_SECRET = re.compile(r"(?i)([?&](?:token|key|signature|ik-s|ik-t|code|secret)=[^\s&#]*)")
_PATH_SECRET = re.compile(r'(/(?:files|join|unsubscribe)/)[^/?\s"\']+')
_CREDENTIAL_URL = re.compile(r"(\w+(?:\+\w+)?://)[^\s/@]+:[^\s/@]+@")
_JWT = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
_EMAIL = re.compile(r'\b[^\s@<>"\']+@[^\s@<>"\']+\.[A-Za-z]{2,}\b')


def sensitive(key: object) -> bool:
    normalized = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", str(key).replace("-", "_")).lower()
    return normalized in SENSITIVE_FIELDS or any(normalized.endswith("_" + field) for field in SENSITIVE_FIELDS)


def scrub(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: REDACTED if sensitive(key) else scrub(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [scrub(item) for item in value]
    if isinstance(value, str):
        value = _CREDENTIAL_URL.sub(r"\1[REDACTED]@", value)
        value = _PATH_SECRET.sub(r"\1[REDACTED]", value)
        value = _URL_SECRET.sub("?[REDACTED]", value)
        value = _BEARER.sub("Bearer [REDACTED]", value)
        value = _FIELD.sub(r"\1[REDACTED]", value)
        for pattern in (_PROVIDER, _JWT, _EMAIL):
            value = pattern.sub(REDACTED, value)
        return value
    return value


def before_send(event: dict[str, Any], hint: object = None) -> dict[str, Any]:
    clean: dict[str, Any] = scrub(event)
    # Stack locals and request payloads can contain unlabelled credentials.
    for exception in clean.get("exception", {}).get("values", []):
        for frame in exception.get("stacktrace", {}).get("frames", []):
            frame.pop("vars", None)
    if isinstance(clean.get("request"), dict):
        for key in ("cookies", "data", "query_string"):
            clean["request"].pop(key, None)
    clean.pop("user", None)
    return clean


class ScrubbingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = scrub(record.getMessage())
        record.args = ()
        for key, value in list(record.__dict__.items()):
            if key not in {"msg", "args", "exc_info", "exc_text"}:
                record.__dict__[key] = REDACTED if sensitive(key) else scrub(value)
        if record.exc_info:
            record.exc_text = scrub("".join(traceback.format_exception(*record.exc_info)))
            record.exc_info = None
        record.request_id = request_id.get()
        return True


def install_scrubbing() -> None:
    logging.basicConfig()  # Ensure propagated application logs have a scrubbed handler.
    # Handler filters catch child loggers; logger filters also cover direct handlers.
    for name in ("", "uvicorn", "uvicorn.access", "uvicorn.error", "sqlalchemy.engine", "httpx", "httpcore", "mshwar"):
        logger = logging.getLogger(name)
        logger.addFilter(ScrubbingFilter())
        for handler in logger.handlers:
            handler.addFilter(ScrubbingFilter())
    from app.core.config import settings

    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            send_default_pii=False,
            include_local_variables=False,
            before_send=before_send,
            before_breadcrumb=lambda crumb, hint: scrub(crumb),
            traces_sample_rate=0,
        )
