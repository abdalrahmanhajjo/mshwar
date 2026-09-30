"""Encrypting secrets the app must store and read back (security plan SEC-45).

A guide's connected calendar address is itself a secret: whoever has it can read their
calendar. Such values are stored as AES-256-GCM ciphertext, so a database dump or a backup
alone does not expose them.

* The key is ``DATA_ENCRYPTION_KEY`` (32 random bytes, base64) when set. Otherwise it is
  derived from ``SECRET_KEY`` with HKDF, so deploying this needs no new setting.
  ``python scripts/data_key.py`` prints the key in use, to pin it before ``SECRET_KEY``
  is rotated (docs/KEY_ROTATION.md).
* Ciphertext is ``v1.<key id>.<base64url(nonce || ciphertext || tag)>``. Keys listed in
  ``DATA_ENCRYPTION_PREVIOUS_KEYS`` still decrypt, and ``is_current`` tells the caller to
  store the value again under the current key.
* ``fingerprint`` is an HMAC of the plaintext, for "already connected?" checks without
  storing the value itself.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

_PREFIX = "v1"


class SecretBoxError(Exception):
    """A value could not be decrypted (wrong key, or tampered with)."""


def _derive(material: bytes, info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=info).derive(material)


def _decode_key(value: str) -> bytes:
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except ValueError:
        raw = b""
    if len(raw) != 32:
        raise ValueError("a data encryption key must be 32 bytes, base64-encoded")
    return raw


def _key_id(key: bytes) -> str:
    return hashlib.sha256(key).hexdigest()[:8]


def current_key() -> bytes:
    configured = settings.data_encryption_key.strip()
    if configured:
        return _decode_key(configured)
    return _derive(settings.secret_key.encode(), b"mshwar-data-encryption-v1")


def _key() -> tuple[str, bytes]:
    key = current_key()
    return _key_id(key), key


def _keys() -> dict[str, bytes]:
    previous = [value.strip() for value in settings.data_encryption_previous_keys.split(",") if value.strip()]
    keys = {_key_id(key): key for key in map(_decode_key, previous)}
    current_id, current = _key()
    keys[current_id] = current
    return keys


def encrypt(plaintext: str, context: str) -> str:
    """Encrypt ``plaintext``. ``context`` (for example "calendar-url") is bound to the value,
    so a ciphertext copied into another column does not decrypt."""
    key_id, key = _key()
    nonce = os.urandom(12)
    sealed = AESGCM(key).encrypt(nonce, plaintext.encode(), context.encode())
    return f"{_PREFIX}.{key_id}.{base64.urlsafe_b64encode(nonce + sealed).decode().rstrip('=')}"


def decrypt(token: str, context: str) -> str:
    try:
        prefix, key_id, body = token.split(".", 2)
    except ValueError as exc:
        raise SecretBoxError("not an encrypted value") from exc
    key = _keys().get(key_id)
    if prefix != _PREFIX or key is None:
        raise SecretBoxError("encrypted with another key")
    raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
    try:
        return AESGCM(key).decrypt(raw[:12], raw[12:], context.encode()).decode()
    except Exception as exc:  # noqa: BLE001 - InvalidTag and friends all mean "cannot read"
        raise SecretBoxError("cannot decrypt") from exc


def is_current(token: str) -> bool:
    """Whether ``token`` was encrypted with the current key (else store it again)."""
    parts = token.split(".", 2)
    return len(parts) == 3 and parts[1] == _key()[0]


def fingerprint(plaintext: str, context: str) -> str:
    _, key = _key()
    mac_key = _derive(key, b"mshwar-fingerprint-" + context.encode())
    return hmac.new(mac_key, plaintext.encode(), hashlib.sha256).hexdigest()
