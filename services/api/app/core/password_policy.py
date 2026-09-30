"""Refuse passwords that are too easy to guess (security plan SEC-23).

The API already requires 10 to 128 characters. On top of that, a password is refused when it
is (ignoring case) one of the most common leaked passwords, is one character repeated, or
contains the person's email name. The list ships with the API, so nothing is sent anywhere.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException

from app.core.http_status import HTTP_422_UNPROCESSABLE

_LIST = Path(__file__).with_name("data") / "common-passwords.txt"
COMMON_MESSAGE = "Choose a less common password: this one appears in lists of leaked passwords."
PERSONAL_MESSAGE = "Choose a password that does not contain your email address."


@lru_cache(maxsize=1)
def _common() -> frozenset[str]:
    lines = _LIST.read_text(encoding="utf-8").splitlines()
    return frozenset(line for line in lines if line and not line.startswith("#"))


def password_problem(password: str, email: str | None = None) -> str | None:
    """Why the password is refused, or None when it is fine."""
    folded = password.strip().lower()
    if folded in _common() or len(set(folded)) <= 2:
        return COMMON_MESSAGE
    local = (email or "").split("@", 1)[0].lower()
    if len(local) >= 4 and local in folded:
        return PERSONAL_MESSAGE
    return None


def require_strong_password(password: str, email: str | None = None) -> None:
    problem = password_problem(password, email)
    if problem:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail=problem)
