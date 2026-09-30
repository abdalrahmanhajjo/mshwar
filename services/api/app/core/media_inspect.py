"""Content checks for uploads (MSHWAR-112).

Uploads are untrusted until these pass. The checks read file structure only;
nothing is decoded, resized or re-encoded here (metadata is cut out of the file
structure, see ``strip_metadata``) - image processing happens in
ImageKit, outside the API process.

* images: the header must parse as the declared format, with sane dimensions
  under ``MAX_IMAGE_PIXELS`` (decompression-bomb guard), and the bytes must not
  carry markup that a browser could be tricked into running;
* PDFs: a real PDF envelope with no active content (JavaScript, launch
  actions, embedded files, XFA forms).
"""

from __future__ import annotations

import re
import struct
from dataclasses import dataclass

MAX_DIMENSION = 12_000


class UnsafeUpload(ValueError):
    """The bytes are not a safe file of the declared type."""


@dataclass(frozen=True)
class Inspected:
    content_type: str
    width: int | None = None
    height: int | None = None


_MARKUP = re.compile(rb"<\s*(?:script|html|svg|iframe|object|embed|body)\b|<\?php|javascript:", re.IGNORECASE)
_PDF_ACTIVE = re.compile(rb"/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|SubmitForm|ImportData)\b")


def _png_size(data: bytes) -> tuple[int, int]:
    if len(data) < 33 or data[12:16] != b"IHDR":
        raise UnsafeUpload("not a PNG image")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


_JPEG_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def _jpeg_size(data: bytes) -> tuple[int, int]:
    index = 2
    length = len(data)
    while index + 4 <= length:
        if data[index] != 0xFF:
            raise UnsafeUpload("not a JPEG image")
        marker = data[index + 1]
        if marker == 0xFF:  # fill byte
            index += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            index += 2
            continue
        (segment,) = struct.unpack(">H", data[index + 2 : index + 4])
        if segment < 2:
            raise UnsafeUpload("not a JPEG image")
        if marker in _JPEG_SOF:
            if index + 9 > length:
                break
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return width, height
        if marker == 0xDA:  # start of scan before any frame header
            break
        index += 2 + segment
    raise UnsafeUpload("not a JPEG image")


def _webp_size(data: bytes) -> tuple[int, int]:
    chunk = data[12:16]
    if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF
    if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8X" and len(data) >= 30:
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return width, height
    raise UnsafeUpload("not a WebP image")


_SIZERS = {"image/png": _png_size, "image/jpeg": _jpeg_size, "image/webp": _webp_size}


def inspect_image(data: bytes, content_type: str, max_pixels: int) -> Inspected:
    sizer = _SIZERS.get(content_type)
    if sizer is None:
        raise UnsafeUpload("unsupported image type")
    try:
        width, height = sizer(data)
    except struct.error as exc:
        raise UnsafeUpload("truncated image") from exc
    if not (0 < width <= MAX_DIMENSION and 0 < height <= MAX_DIMENSION) or width * height > max_pixels:
        raise UnsafeUpload("image dimensions are not allowed")
    if _MARKUP.search(data[:4096]) or _MARKUP.search(data[-4096:]):
        raise UnsafeUpload("image contains markup")
    return Inspected(content_type, width, height)


def inspect_pdf(data: bytes) -> Inspected:
    if not re.match(rb"%PDF-[12]\.\d", data[:8]):
        raise UnsafeUpload("not a PDF document")
    if b"%%EOF" not in data[-2048:]:
        raise UnsafeUpload("truncated PDF document")
    if _PDF_ACTIVE.search(data):
        raise UnsafeUpload("PDF contains active content")
    return Inspected("application/pdf")


def inspect_upload(data: bytes, content_type: str, max_pixels: int) -> Inspected:
    if content_type == "application/pdf":
        return inspect_pdf(data)
    return inspect_image(data, content_type, max_pixels)


# --- Metadata removal (security plan SEC-51) -------------------------------------------
# Photos carry EXIF: the GPS position they were taken at, the camera's serial number, the
# owner's name. These are removed from the file structure before it is stored; the image
# data itself is untouched (no decoding here, as above). A JPEG keeps its orientation, so
# a phone photo is not shown sideways.

_JPEG_DROP = {0xE1, 0xED, 0xFE} | set(range(0xE3, 0xED)) | {0xEF}  # EXIF/XMP, IPTC, comment, APPn
_PNG_DROP = {b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME"}
_WEBP_DROP = {b"EXIF", b"XMP "}


def _jpeg_orientation(segment: bytes) -> int | None:
    """The orientation tag (0x0112) of an EXIF APP1 body, or None."""
    if not segment.startswith(b"Exif\x00\x00") or len(segment) < 14:
        return None
    tiff = segment[6:]
    order = {b"II": "<", b"MM": ">"}.get(tiff[:2])
    if order is None:
        return None
    try:
        (offset,) = struct.unpack(order + "I", tiff[4:8])
        (count,) = struct.unpack(order + "H", tiff[offset : offset + 2])
        for entry in range(min(count, 512)):
            start = offset + 2 + entry * 12
            tag, kind, _, value = struct.unpack(order + "HHIH", tiff[start : start + 10])
            if tag == 0x0112 and kind == 3:
                return value if 1 <= value <= 8 else None
    except struct.error:
        return None
    return None


def _orientation_segment(orientation: int) -> bytes:
    body = b"Exif\x00\x00MM\x00\x2a\x00\x00\x00\x08" + struct.pack(">HHHIHH", 1, 0x0112, 3, 1, orientation, 0)
    body += b"\x00\x00\x00\x00"  # no next IFD
    return b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body


def _join_jpeg(start: bytes, kept: list[bytes], orientation: int | None, rest: bytes) -> bytes:
    if orientation and orientation != 1:
        # Readers look for EXIF at the front: right after the JFIF header, if any.
        at = 1 if kept and kept[0][1] == 0xE0 else 0
        kept.insert(at, _orientation_segment(orientation))
    return start + b"".join(kept) + rest


def _strip_jpeg(data: bytes) -> bytes:
    kept: list[bytes] = []
    index, orientation = 2, None
    while index + 2 <= len(data):
        if data[index] != 0xFF:
            raise UnsafeUpload("not a JPEG image")
        marker = data[index + 1]
        if marker == 0xFF:
            index += 1
            continue
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            kept.append(data[index : index + 2])
            index += 2
            continue
        if marker in (0xDA, 0xD9):  # start of scan (the rest is image data), or the end
            return _join_jpeg(data[:2], kept, orientation, data[index:])
        if index + 4 > len(data):
            break
        (length,) = struct.unpack(">H", data[index + 2 : index + 4])
        end = index + 2 + length
        if length < 2 or end > len(data):
            raise UnsafeUpload("not a JPEG image")
        if marker in _JPEG_DROP:
            if marker == 0xE1 and orientation is None:
                orientation = _jpeg_orientation(data[index + 4 : end])
        else:
            kept.append(data[index:end])
        index = end
    raise UnsafeUpload("not a JPEG image")


def _strip_png(data: bytes) -> bytes:
    out = bytearray(data[:8])
    index = 8
    while index + 12 <= len(data):
        (length,) = struct.unpack(">I", data[index : index + 4])
        kind = data[index + 4 : index + 8]
        end = index + 12 + length
        if end > len(data):
            raise UnsafeUpload("truncated image")
        if kind not in _PNG_DROP:
            out += data[index:end]
        index = end
        if kind == b"IEND":
            return bytes(out)
    raise UnsafeUpload("truncated image")


def _strip_webp(data: bytes) -> bytes:
    chunks = bytearray()
    index = 12
    while index + 8 <= len(data):
        kind = data[index : index + 4]
        (length,) = struct.unpack("<I", data[index + 4 : index + 8])
        end = index + 8 + length + (length & 1)
        if index + 8 + length > len(data):
            raise UnsafeUpload("truncated image")
        chunk = bytearray(data[index:end])
        if kind == b"VP8X" and len(chunk) >= 9:
            chunk[8] &= ~0x0C & 0xFF  # clear the "has EXIF" and "has XMP" flags
        if kind not in _WEBP_DROP:
            chunks += chunk
        index = end
    return b"RIFF" + struct.pack("<I", len(chunks) + 4) + b"WEBP" + bytes(chunks)


def strip_metadata(data: bytes, content_type: str) -> bytes:
    """The same image without its metadata. PDFs and other types are returned unchanged."""
    if content_type == "image/jpeg":
        return _strip_jpeg(data)
    if content_type == "image/png":
        return _strip_png(data)
    if content_type == "image/webp":
        return _strip_webp(data)
    return data
