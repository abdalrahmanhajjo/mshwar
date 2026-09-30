"""Uploaded photos lose their metadata before they are stored (security plan SEC-51)."""

from __future__ import annotations

import struct
import zlib

import pytest

from app.core.media_inspect import UnsafeUpload, inspect_upload, strip_metadata
from tests.media_fixtures import tiny_jpeg, tiny_png

GPS = b"GPS 33.8938N 35.5018E serial CAM-12345 owner Rania"


def _exif(order: str = ">", orientation: int = 6) -> bytes:
    mark = b"MM" if order == ">" else b"II"
    ifd = struct.pack(order + "H", 2)
    ifd += struct.pack(order + "HHIHH", 0x0112, 3, 1, orientation, 0)
    ifd += struct.pack(order + "HHII", 0x010F, 2, len(GPS), 38)
    ifd += b"\x00\x00\x00\x00"
    body = b"Exif\x00\x00" + mark + struct.pack(order + "HI", 42, 8) + ifd + GPS
    return b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body


def _jpeg_with(*segments: bytes) -> bytes:
    plain = tiny_jpeg(4, 3)
    return plain[:20] + b"".join(segments) + plain[20:]


def _png_chunk(kind: bytes, body: bytes) -> bytes:
    return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))


@pytest.mark.parametrize("order", [">", "<"])
def test_jpeg_loses_exif_xmp_and_comments_but_keeps_orientation(order: str) -> None:
    xmp = b"\xff\xe1" + struct.pack(">H", 2 + 29 + len(GPS)) + b"http://ns.adobe.com/xap/1.0/\x00" + GPS
    comment = b"\xff\xfe" + struct.pack(">H", 2 + len(GPS)) + GPS
    icc = b"\xff\xe2" + struct.pack(">H", 2 + 12) + b"ICC_PROFILE\x00"
    photo = _jpeg_with(_exif(order), xmp, comment, icc)
    clean = strip_metadata(photo, "image/jpeg")
    assert GPS not in clean and b"http://ns.adobe.com" not in clean
    assert b"ICC_PROFILE" in clean, "the colour profile stays"
    assert clean[2:4] == b"\xff\xe0" and clean[20:22] == b"\xff\xe1", "orientation right after JFIF"
    assert clean[20:].find(b"\x01\x12\x00\x03") > 0 and b"\x00\x06\x00\x00" in clean
    assert inspect_upload(clean, "image/jpeg", 40_000_000).width == 4
    assert strip_metadata(clean, "image/jpeg") == clean, "stripping twice changes nothing"


def test_upright_jpeg_keeps_no_exif_at_all() -> None:
    clean = strip_metadata(_jpeg_with(_exif(orientation=1)), "image/jpeg")
    assert b"Exif" not in clean
    assert clean == tiny_jpeg(4, 3)


def test_png_and_webp_lose_text_and_exif_chunks() -> None:
    png = tiny_png(3, 3)
    photo = png + _png_chunk(b"tEXt", b"Comment\x00" + GPS) + _png_chunk(b"eXIf", GPS) + _png_chunk(b"IEND", b"")
    clean = strip_metadata(photo, "image/png")
    assert GPS not in clean and clean.endswith(_png_chunk(b"IEND", b""))
    assert inspect_upload(clean, "image/png", 40_000_000).height == 3

    vp8x = b"VP8X" + struct.pack("<I", 10) + bytes([0x0C, 0, 0, 0]) + (1).to_bytes(3, "little") * 2
    exif = b"EXIF" + struct.pack("<I", len(GPS)) + GPS
    image = b"VP8L" + struct.pack("<I", 5) + b"\x2f\x01\x40\x00\x00" + b"\x00"
    chunks = vp8x + image + exif
    webp = b"RIFF" + struct.pack("<I", len(chunks) + 4) + b"WEBP" + chunks
    cleaned = strip_metadata(webp, "image/webp")
    assert GPS not in cleaned
    assert cleaned[20] & 0x0C == 0, "the metadata flags are cleared"
    assert struct.unpack("<I", cleaned[4:8])[0] == len(cleaned) - 8


def test_pdf_is_left_alone_and_broken_images_are_refused() -> None:
    assert strip_metadata(b"%PDF-1.4 x", "application/pdf") == b"%PDF-1.4 x"
    with pytest.raises(UnsafeUpload):
        strip_metadata(b"\xff\xd8\x00\x00\x00\x00", "image/jpeg")
    with pytest.raises(UnsafeUpload):
        strip_metadata(tiny_png() + b"\x00\x00\xff\xffIDAT", "image/png")


@pytest.mark.asyncio
async def test_a_stored_document_photo_has_no_location() -> None:
    from httpx import ASGITransport, AsyncClient

    from app.core.mailer import RecordingMailer, set_mailer
    from app.core.rate_limit import limiter
    from app.main import app
    from tests.media_fixtures import b64
    from tests.test_guides import _apply, _grant_admin, _register

    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        await _register(api, "exif")
        await _apply(api, tier="host")
        uploaded = await api.post(
            "/api/v1/guides/me/documents/upload",
            json={
                "kind": "id",
                "filename": "id.jpg",
                "content_type": "image/jpeg",
                "content_base64": b64(_jpeg_with(_exif())),
            },
        )
        assert uploaded.status_code == 200, uploaded.text
        admin = await _register(api, "exif-reviewer")
        await _grant_admin(admin["id"])
        case = (await api.get(f"/api/v1/admin/guides/{uploaded.json()['id']}")).json()
        opened = await api.get(case["document_links"]["id"])
        assert opened.status_code == 200
        assert opened.content.startswith(b"\xff\xd8") and GPS not in opened.content
