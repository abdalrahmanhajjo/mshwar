"""Which image licences Mshwar will publish, shared by the importer and guide proposals.

Reusable licences only: CC0, CC BY, CC BY-SA and public domain. Non-commercial,
no-derivatives, non-free and "all rights reserved" are refused.
"""

from __future__ import annotations

import re

_REJECTED = (
    "cc-by-nc",
    "cc by-nc",
    "cc-by-nd",
    "cc by-nd",
    "noncommercial",
    "non-commercial",
    "noderiv",
    "no derivative",
    "non-free",
    "nonfree",
    "fair use",
    "all rights reserved",
)

# A Commons file page, and the upload host its images are served from.
COMMONS_PAGE = re.compile(r"^https://commons\.wikimedia\.org/wiki/File:[^\s]+$")
COMMONS_IMAGE = re.compile(r"^https://upload\.wikimedia\.org/wikipedia/commons/[^\s]+\.(?:jpe?g|png|webp)$", re.I)


def license_allowed(short: str, raw: str = "") -> bool:
    """True only for reusable licences (CC0 / CC-BY / CC-BY-SA / public domain)."""
    text = f"{short} {raw}".lower().strip()
    if any(marker in text for marker in _REJECTED):
        return False
    if "public domain" in text or text.startswith("pd"):
        return True
    return text.startswith("cc0") or text.startswith("cc-by") or text.startswith("cc by")


__all__ = ["COMMONS_IMAGE", "COMMONS_PAGE", "license_allowed"]
