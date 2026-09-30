"""Content Security Policy reports are counted, never stored whole (security plan SEC-37)."""

from __future__ import annotations

import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import limiter, metrics, prometheus_text
from app.main import app
from tests.log_capture import captured

URL = "/api/v1/security/csp-report"


@pytest.fixture
async def api() -> AsyncClient:
    limiter.reset()
    metrics.reset()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_a_violation_is_counted_by_directive_without_its_addresses(api: AsyncClient) -> None:
    legacy = {
        "csp-report": {
            "document-uri": "https://mshwarlb.com/account/confirm-email?token=secret-token-123",
            "violated-directive": "script-src-elem",
            "effective-directive": "script-src-elem",
            "blocked-uri": "https://evil.example.net/x.js?session=abc",
        }
    }
    with captured("app.api.v1.endpoints.security") as records:
        sent = await api.post(URL, content=json.dumps(legacy), headers={"content-type": "application/csp-report"})
    assert sent.status_code == 204
    assert 'mshwar_csp_violations_total{directive="script-src-elem"} 1' in prometheus_text()
    logged = " ".join(f"{record.getMessage()} {record.__dict__}" for record in records)
    assert "evil.example.net" in logged
    assert "secret-token-123" not in logged and "session=abc" not in logged

    reporting_api = [
        {"type": "csp-violation", "body": {"effectiveDirective": "img-src", "blockedURL": "https://x.example/a.png"}},
        {"type": "csp-violation", "body": {"effectiveDirective": "script-src-elem", "blockedURL": "inline"}},
        {"type": "deprecation", "body": {"id": "x"}},
    ]
    sent = await api.post(URL, content=json.dumps(reporting_api), headers={"content-type": "application/reports+json"})
    assert sent.status_code == 204
    text = prometheus_text()
    assert 'directive="img-src"} 1' in text and 'directive="script-src-elem"} 2' in text


@pytest.mark.asyncio
async def test_junk_is_ignored_and_reports_are_rate_limited(api: AsyncClient) -> None:
    for body in (b"not json", b"{}", json.dumps({"csp-report": {"effective-directive": "<script>"}}).encode()):
        assert (await api.post(URL, content=body)).status_code == 204
    assert 'directive="unknown"} 1' in prometheus_text(), "an odd directive name is not trusted"
    assert (await api.post(URL, content=b"[" + b"1," * 40_000 + b"1]")).status_code == 204
    statuses = [(await api.post(URL, content=b"{}")).status_code for _ in range(70)]
    assert statuses.count(429) > 0
