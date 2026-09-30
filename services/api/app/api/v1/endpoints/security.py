"""Browser security reports (security plan SEC-37).

The web app's Content Security Policy sends violation reports here, both the older
``report-uri`` format (``application/csp-report``) and the Reporting API
(``application/reports+json``). Each report is counted by directive in the metrics the
scraper reads (``mshwar_csp_violations_total``) and logged with the directive and the
blocked host only: the page and blocked addresses can carry tokens, so they are not kept.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import urlsplit

from fastapi import APIRouter, Request, Response, status

from app.core import access
from app.core.rate_limit import enforce_rate_limit, metrics

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_REPORT_BYTES = 64 * 1024
MAX_REPORTS = 20
_DIRECTIVE_CHARS = frozenset("abcdefghijklmnopqrstuvwxyz-")


def _directive(value: object) -> str:
    text = str(value or "").strip().lower().split(" ")[0][:40]
    return text if text and set(text) <= _DIRECTIVE_CHARS else "unknown"


def _blocked(value: object) -> str:
    text = str(value or "")
    if text in {"inline", "eval", "wasm-eval", "trusted-types-policy", "trusted-types-sink"}:
        return text
    host = urlsplit(text).hostname
    return host[:100] if host else ("self" if text.startswith("/") else "other")


def _violations(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict) and isinstance(payload.get("csp-report"), dict):
        report = payload["csp-report"]
        return [
            {
                "directive": report.get("effective-directive") or report.get("violated-directive"),
                "blocked": report.get("blocked-uri"),
            }
        ]
    if isinstance(payload, list):
        return [
            {"directive": item["body"].get("effectiveDirective"), "blocked": item["body"].get("blockedURL")}
            for item in payload[:MAX_REPORTS]
            if isinstance(item, dict) and item.get("type") == "csp-violation" and isinstance(item.get("body"), dict)
        ]
    return []


@router.post("/csp-report", status_code=status.HTTP_204_NO_CONTENT, dependencies=[access.PUBLIC])
async def csp_report(request: Request) -> Response:
    """Count a Content Security Policy violation. Always answers 204: a report never fails a page."""
    await enforce_rate_limit(request, "csp-report")
    body = await request.body()
    if len(body) > MAX_REPORT_BYTES:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    for violation in _violations(payload):
        directive = _directive(violation["directive"])
        metrics.csp_violations[directive] += 1
        logger.warning("csp_violation", extra={"directive": directive, "blocked": _blocked(violation["blocked"])})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
