from __future__ import annotations

import pytest

from app.core.storage import (
    put_private_bytes,
    read_private_bytes,
    sign_object_url,
    storage_backend,
    verify_signed_token,
)


def test_local_backend_when_imagekit_unset() -> None:
    assert storage_backend() == "local"


def test_private_put_and_signed_url(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.storage.settings.private_storage_dir", str(tmp_path))
    stored = put_private_bytes(b"secret-doc", "license.pdf", "application/pdf", public=False)
    assert stored["provider"] == "local"
    assert stored["object_key"]
    assert read_private_bytes(stored["object_key"]) == b"secret-doc"
    signed = sign_object_url(stored["object_key"], ttl_seconds=60)
    assert signed["public"] == "false"
    assert verify_signed_token(signed["url"].rsplit("/", 1)[1]) == stored["object_key"]


def test_refuses_public_flag() -> None:
    with pytest.raises(ValueError):
        put_private_bytes(b"x", "a.txt", "text/plain", public=True)


def test_invalid_signature_is_rejected() -> None:
    with pytest.raises(ValueError):
        verify_signed_token("not-a-token")
