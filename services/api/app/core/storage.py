from __future__ import annotations

"""Private object storage for verification documents and listing images.

When IMAGEKIT_API_KEY / IMAGEKIT_URL are unset the local stub writes files
under PRIVATE_STORAGE_DIR and issues HMAC-signed download URLs. ImageKit
keys are never hardcoded.
"""

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from app.core.config import settings

_LOCAL_BACKEND = "local"
_IMAGEKIT_BACKEND = "imagekit"


def storage_backend() -> str:
    if settings.imagekit_api_key and settings.imagekit_url:
        return _IMAGEKIT_BACKEND
    return _LOCAL_BACKEND


def storage_root() -> Path:
    path = Path(settings.private_storage_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def put_private_bytes(data: bytes, filename: str, content_type: str, *, public: bool = False) -> dict[str, str]:
    """Persist bytes. Verification documents must pass public=False."""
    if public:
        raise ValueError("private storage refuses public objects")
    key = f"{datetime.now(timezone.utc).strftime('%Y/%m')}/{uuid4().hex}-{_safe_name(filename)}"
    backend = storage_backend()
    if backend == _IMAGEKIT_BACKEND:
        # Stub: persist locally and record that ImageKit would be used in production.
        _write_local(key, data)
        provider = _IMAGEKIT_BACKEND
    else:
        _write_local(key, data)
        provider = _LOCAL_BACKEND
    return {
        "object_key": key,
        "provider": provider,
        "filename": filename,
        "content_type": content_type,
        "backend": backend,
    }


def _write_local(key: str, data: bytes) -> None:
    target = storage_root() / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def read_private_bytes(object_key: str) -> bytes:
    target = storage_root() / object_key
    if not target.is_file():
        raise FileNotFoundError(object_key)
    return target.read_bytes()


def sign_object_url(object_key: str, *, ttl_seconds: int | None = None) -> dict[str, str]:
    expires = int(
        (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds or settings.signed_url_ttl_seconds)).timestamp()
    )
    payload = json.dumps({"k": object_key, "e": expires}, separators=(",", ":"))
    digest = hmac.new(settings.secret_key.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(f"{payload}.{digest}".encode()).decode("ascii")
    return {
        "url": f"/api/v1/portal/files/{token}",
        "expires_at": datetime.fromtimestamp(expires, tz=timezone.utc).isoformat(),
        "object_key": object_key,
        "public": "false",
    }


def verify_signed_token(token: str) -> str:
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        payload, digest = raw.rsplit(".", 1)
        expected = hmac.new(settings.secret_key.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, digest):
            raise ValueError("invalid signature")
        body = json.loads(payload)
        if int(body["e"]) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("expired")
        return str(body["k"])
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("invalid signature") from exc


def _safe_name(filename: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in ".-_" else "-" for ch in filename)
    return cleaned[:80] or "file"
