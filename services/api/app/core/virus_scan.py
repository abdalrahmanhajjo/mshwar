"""Virus scan for uploaded documents (security plan SEC-52).

Guide licences, IDs and business documents are opened by admins, so each one is streamed
to ClamAV's ``clamd`` (INSTREAM command) before it is stored. Unset ``CLAMD_ADDRESS``
means no scanner is configured; once it is set, a scanner that cannot answer refuses the
upload (fail closed) instead of letting an unscanned file through.
"""

from __future__ import annotations

import asyncio
import logging
import struct

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.http_status import HTTP_422_UNPROCESSABLE

logger = logging.getLogger(__name__)

_CHUNK = 64 * 1024
TIMEOUT_SECONDS = 30.0


class ScannerUnavailable(Exception):
    """clamd could not be reached or gave an answer that is not a verdict."""


def _address() -> tuple[str, int]:
    host, _, port = settings.clamd_address.rpartition(":")
    if not host or not port.isdigit():
        raise ScannerUnavailable("CLAMD_ADDRESS must be host:port")
    return host, int(port)


async def scan(data: bytes) -> str | None:
    """The name of the malware clamd found in ``data``, or None when it is clean."""
    host, port = _address()
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), TIMEOUT_SECONDS)
    except (OSError, TimeoutError) as exc:
        raise ScannerUnavailable("cannot reach clamd") from exc
    try:
        writer.write(b"zINSTREAM\0")
        for start in range(0, len(data), _CHUNK):
            chunk = data[start : start + _CHUNK]
            writer.write(struct.pack(">I", len(chunk)) + chunk)
        writer.write(struct.pack(">I", 0))
        await writer.drain()
        answer = await asyncio.wait_for(reader.readuntil(b"\0"), TIMEOUT_SECONDS)
    except (OSError, TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError) as exc:
        raise ScannerUnavailable("clamd did not answer") from exc
    finally:
        writer.close()
    verdict = answer.rstrip(b"\0").decode("utf-8", "replace")
    if verdict.endswith(" OK"):
        return None
    if verdict.endswith(" FOUND"):
        return verdict.removeprefix("stream: ").removesuffix(" FOUND")
    raise ScannerUnavailable(f"unexpected clamd answer: {verdict[:80]}")


async def scan_or_reject(data: bytes, purpose: str) -> None:
    """Refuse an infected document. Does nothing when no scanner is configured."""
    if not settings.clamd_address:
        return
    try:
        found = await scan(data)
    except ScannerUnavailable as exc:
        logger.error("virus_scan_unavailable", extra={"purpose": purpose, "reason": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The file could not be checked right now. Please try again in a few minutes.",
        ) from exc
    if found:
        logger.warning("virus_scan_refused", extra={"purpose": purpose, "signature": found})
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="This file was refused")
