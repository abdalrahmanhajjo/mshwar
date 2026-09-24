"""Time-based one-time codes (RFC 6238) for partner accounts.

Six digits, 30-second steps, SHA-1: what every authenticator app speaks. A code
is accepted for the step before and after the current one to allow for clock
drift, and the step it matched is returned so the database can refuse a replay.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

STEP_SECONDS = 30
DIGITS = 6


def new_secret() -> str:
    """160 random bits, base32 without padding (32 characters)."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _key(secret: str) -> bytes:
    padded = secret + "=" * (-len(secret) % 8)
    return base64.b32decode(padded, casefold=True)


def code_at(secret: str, step: int) -> str:
    digest = hmac.new(_key(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**DIGITS).zfill(DIGITS)


def current_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // STEP_SECONDS)


def matching_step(secret: str, code: str, *, now: float | None = None, window: int = 1) -> int | None:
    """The step this code belongs to, or None. Constant-time per comparison."""
    cleaned = "".join(ch for ch in code if ch.isdigit())
    if len(cleaned) != DIGITS:
        return None
    step = current_step(now)
    for candidate in range(step - window, step + window + 1):
        if hmac.compare_digest(code_at(secret, candidate), cleaned):
            return candidate
    return None


def provisioning_uri(secret: str, account: str, issuer: str = "Mshwar") -> str:
    label = quote(f"{issuer}:{account}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&digits={DIGITS}&period={STEP_SECONDS}"


def hash_phone_code(user_id: str, code: str, secret_key: str) -> str:
    """Phone codes are stored as keyed hashes, bound to the account they were sent for."""
    return hmac.new(secret_key.encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def new_phone_code() -> str:
    return f"{secrets.randbelow(10**DIGITS):0{DIGITS}d}"
