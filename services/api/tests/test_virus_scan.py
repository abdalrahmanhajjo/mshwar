"""Uploaded documents are virus-scanned when a scanner is configured (security plan SEC-52)."""

from __future__ import annotations

import asyncio
import struct
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import virus_scan
from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from tests.log_capture import captured
from tests.media_fixtures import b64, tiny_pdf
from tests.test_guides import _apply, _register

# The standard antivirus test string: harmless, and every scanner reports it.
EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


async def _fake_clamd(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    """Answers INSTREAM like clamd, finding EICAR."""
    assert await reader.readuntil(b"\0") == b"zINSTREAM\0"
    body = b""
    while True:
        (size,) = struct.unpack(">I", await reader.readexactly(4))
        if size == 0:
            break
        body += await reader.readexactly(size)
    verdict = b"stream: Eicar-Test-Signature FOUND\0" if EICAR in body else b"stream: OK\0"
    writer.write(verdict)
    await writer.drain()
    writer.close()


@pytest.fixture
async def clamd(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[str]:
    server = await asyncio.start_server(_fake_clamd, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    monkeypatch.setattr(settings, "clamd_address", f"127.0.0.1:{port}")
    async with server:
        yield settings.clamd_address


@pytest.mark.asyncio
async def test_scan_protocol(clamd: str) -> None:
    assert await virus_scan.scan(tiny_pdf() * 5000) is None, "a clean file larger than one chunk"
    assert await virus_scan.scan(tiny_pdf(EICAR)) == "Eicar-Test-Signature"


def _upload(content: bytes) -> dict[str, str]:
    return {"kind": "id", "filename": "id.pdf", "content_type": "application/pdf", "content_base64": b64(content)}


@pytest.mark.asyncio
async def test_an_infected_document_is_refused_and_logged(clamd: str) -> None:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        await _register(api, "scanned")
        await _apply(api, tier="host")
        with captured("app.core.virus_scan") as records:
            infected = await api.post("/api/v1/guides/me/documents/upload", json=_upload(tiny_pdf(EICAR)))
        assert infected.status_code == 422
        assert "Eicar" not in infected.text, "the signature name is logged, not shown"
        assert any(record.getMessage() == "virus_scan_refused" for record in records)
        clean = await api.post("/api/v1/guides/me/documents/upload", json=_upload(tiny_pdf()))
        assert clean.status_code == 200, clean.text


@pytest.mark.asyncio
async def test_a_configured_scanner_that_is_down_refuses_uploads(monkeypatch: pytest.MonkeyPatch) -> None:
    server = await asyncio.start_server(_fake_clamd, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    server.close()
    await server.wait_closed()
    monkeypatch.setattr(settings, "clamd_address", f"127.0.0.1:{port}")
    with pytest.raises(virus_scan.ScannerUnavailable):
        await virus_scan.scan(b"%PDF-1.4")
    with pytest.raises(Exception, match="503"):
        await virus_scan.scan_or_reject(b"%PDF-1.4", "test")
    monkeypatch.setattr(settings, "clamd_address", "")
    await virus_scan.scan_or_reject(EICAR, "test")  # no scanner configured: nothing to do
