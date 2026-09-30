"""Reading an address a user supplied, safely (security plan SEC-41).

Every outbound request to a URL that came from user input goes through ``fetch_text``;
a Semgrep rule (ops/semgrep/mshwar.yml) fails CI on ``httpx`` calls with a variable URL
anywhere else. The address is untrusted, so:

* only https on port 443, with no user name or password in it;
* every address the host resolves to must be public (no loopback, private, link-local
  or metadata ranges), and the connection is pinned to the checked address, so a second
  DNS answer cannot point it somewhere else (DNS rebinding);
* redirects are followed one at a time, each checked the same way;
* the body is capped in size, and the whole read in time, so a slow drip cannot hold a job;
* proxies from the environment are ignored (``trust_env=False``): the pinned address must be
  the one connected to.
"""

from __future__ import annotations

import ipaddress
import socket
from time import monotonic
from urllib.parse import urlsplit, urlunsplit

import httpx

TIMEOUT_SECONDS = 10.0  # each connect or read
TOTAL_SECONDS = 20.0
MAX_REDIRECTS = 3


class FetchRefused(Exception):
    """The address was not read. ``reason`` is one of the codes below; ``status`` is set for
    ``status``."""

    def __init__(self, reason: str, status: int | None = None) -> None:
        super().__init__(reason if status is None else f"{reason} {status}")
        self.reason = reason
        self.status = status


# Reasons
NOT_HTTPS = "not-https"
NOT_PUBLIC = "not-public"
NOT_FOUND = "not-found"
STATUS = "status"
TOO_LARGE = "too-large"
TOO_SLOW = "too-slow"
UNREACHABLE = "unreachable"
TOO_MANY_REDIRECTS = "too-many-redirects"


def public_addresses(host: str, port: int) -> list[str]:
    """Every address ``host`` resolves to, refusing the lot if any of them is not public."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as exc:
        raise FetchRefused(NOT_FOUND) from exc
    addresses: list[str] = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global or ip.is_multicast:
            raise FetchRefused(NOT_PUBLIC)
        addresses.append(str(ip))
    if not addresses:
        raise FetchRefused(NOT_FOUND)
    return addresses


def checked_url(url: str) -> tuple[str, str]:
    """The host, and the checked public address to connect to."""
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        raise FetchRefused(NOT_HTTPS)
    if parts.username or parts.password:
        raise FetchRefused(NOT_PUBLIC)
    try:
        port = parts.port or 443
    except ValueError as exc:
        raise FetchRefused(NOT_PUBLIC) from exc
    if port != 443:
        raise FetchRefused(NOT_PUBLIC)
    return parts.hostname, public_addresses(parts.hostname, port)[0]


def fetch_text(
    url: str,
    *,
    max_bytes: int,
    user_agent: str,
    accept: str = "*/*",
    total_seconds: float = TOTAL_SECONDS,
) -> str:
    """The body at ``url`` as text (UTF-8, bad bytes replaced), or ``FetchRefused``."""
    current = url
    deadline = monotonic() + total_seconds
    for _ in range(MAX_REDIRECTS + 1):
        host, address = checked_url(current)
        parts = urlsplit(current)
        literal = f"[{address}]" if ":" in address else address
        pinned = urlunsplit(("https", literal, parts.path or "/", parts.query, ""))
        try:
            with (
                httpx.Client(timeout=TIMEOUT_SECONDS, follow_redirects=False, trust_env=False) as client,
                client.stream(
                    "GET",
                    pinned,
                    headers={"Host": host, "User-Agent": user_agent, "Accept": accept},
                    extensions={"sni_hostname": host},
                ) as response,
            ):
                if response.is_redirect:
                    current = str(httpx.URL(current).join(response.headers.get("location", "")))
                    continue
                if response.status_code != 200:
                    raise FetchRefused(STATUS, response.status_code)
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > max_bytes:
                        raise FetchRefused(TOO_LARGE)
                    if monotonic() > deadline:
                        raise FetchRefused(TOO_SLOW)
        except httpx.TimeoutException as exc:
            raise FetchRefused(TOO_SLOW) from exc
        except httpx.HTTPError as exc:
            raise FetchRefused(UNREACHABLE) from exc
        return bytes(body).decode("utf-8", errors="replace")
    raise FetchRefused(TOO_MANY_REDIRECTS)
