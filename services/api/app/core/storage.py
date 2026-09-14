from __future__ import annotations

"""Private object storage for verification documents and listing images.

When IMAGEKIT_API_KEY / IMAGEKIT_URL are unset the local stub writes files
under PRIVATE_STORAGE_DIR and issues HMAC-signed download URLs. ImageKit
keys are never hardcoded.
"""

import base64
import binascii
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

import httpx

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
        with httpx.Client(timeout=20) as client:
            response = client.post(
                "https://upload.imagekit.io/api/v1/files/upload",
                auth=(settings.imagekit_api_key, ""),
                files={"file": (_safe_name(filename), data, content_type)},
                data={
                    "fileName": key.rsplit("/", 1)[-1],
                    "folder": "/mshwar/" + key.rsplit("/", 1)[0],
                    "isPrivateFile": "true",
                    "useUniqueFileName": "false",
                },
            )
        if response.status_code != 200:
            raise ValueError("Private storage unavailable")
        path = response.json().get("filePath", "")
        if not isinstance(path, str) or not path.startswith("/mshwar/"):
            raise ValueError("Invalid private storage response")
        key = "imagekit:" + path
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
    if object_key.startswith("imagekit:"):
        expires = int(datetime.now(timezone.utc).timestamp()) + min(settings.signed_url_ttl_seconds, 300)
        url = settings.imagekit_url.rstrip("/") + quote(object_key[len("imagekit:") :], safe="/")
        signature = hmac.new(
            settings.imagekit_api_key.encode(), (url.removeprefix(settings.imagekit_url.rstrip("/") + "/") + str(expires)).encode(), hashlib.sha1
        ).hexdigest()
        with httpx.Client(timeout=20) as client:
            response = client.get(url, params={"ik-t": expires, "ik-s": signature})
        if response.status_code != 200:
            raise FileNotFoundError("File not available")
        return response.content
    root = storage_root().resolve()
    target = (root / object_key).resolve()
    if root not in target.parents:
        raise FileNotFoundError("File not available")
    if not target.is_file():
        raise FileNotFoundError(object_key)
    return target.read_bytes()


def sign_object_url(object_key: str, *, ttl_seconds: int | None = None) -> dict[str, str]:
    expires = int(
        (
            datetime.now(timezone.utc)
            + timedelta(seconds=max(1, min(ttl_seconds or settings.signed_url_ttl_seconds, 300)))
        ).timestamp()
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
        if int(body["e"]) <= int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("expired")
        return str(body["k"])
    except (ValueError, TypeError, KeyError, binascii.Error, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("invalid signature") from exc


def _safe_name(filename: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in ".-_" else "-" for ch in filename)
    return cleaned[:80] or "file"
