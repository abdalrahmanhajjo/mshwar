"""Human check on the riskiest public forms (security plan SEC-55).

Sign-up and password-reset requests carry a Cloudflare Turnstile token when the web app
shows the check (``NEXT_PUBLIC_TURNSTILE_SITE_KEY``). With ``TURNSTILE_SECRET_KEY`` unset
the check is off and nothing changes. When it is set:

* a missing or rejected token is refused (400), so a script cannot skip the widget;
* if Cloudflare cannot be reached, the request goes through and a warning is logged: the
  per-IP and per-address rate limits still hold, and sign-ups do not stop during an outage.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException, Request, status

from app.core.client_ip import client_ip
from app.core.config import settings

logger = logging.getLogger(__name__)

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
REFUSED_DETAIL = "Please complete the human check and try again."
TIMEOUT_SECONDS = 5.0

# Tests replace this with an httpx.MockTransport.
transport: httpx.AsyncBaseTransport | None = None


def enabled() -> bool:
    return bool(settings.turnstile_secret_key)


async def require_human(token: str | None, request: Request, action: str) -> None:
    if not enabled():
        return
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=REFUSED_DETAIL)
    form = {"secret": settings.turnstile_secret_key, "response": token, "remoteip": client_ip(request)}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, transport=transport) as client:
            answer = (await client.post(VERIFY_URL, data=form)).json()
    except (httpx.HTTPError, ValueError):
        logger.warning("human_check_unavailable", extra={"action": action})
        return
    if not isinstance(answer, dict) or answer.get("success") is not True:
        logger.info("human_check_refused", extra={"action": action, "codes": answer.get("error-codes", [])})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=REFUSED_DETAIL)
    if answer.get("action") not in (None, "", action):
        logger.info("human_check_wrong_action", extra={"action": action})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=REFUSED_DETAIL)
