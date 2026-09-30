"""The one way to read a user-supplied address (security plan SEC-41)."""

from __future__ import annotations

import socket
from typing import Any

import httpx
import pytest

from app.core import safe_fetch

ADDRESSES = {
    "public.example.com": ["93.184.216.34"],
    "mixed.example.com": ["93.184.216.34", "10.0.0.5"],
    "metadata.example.com": ["169.254.169.254"],
    "loop.example.com": ["127.0.0.1"],
    "v6local.example.com": ["fd00::1"],
    "hop1.example.com": ["93.184.216.35"],
}


@pytest.fixture
def served(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
    def fake_getaddrinfo(host: str, port: int, *args: Any, **kwargs: Any) -> list[Any]:
        if host not in ADDRESSES:
            raise socket.gaierror("unknown")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, port)) for address in ADDRESSES[host]]

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        path = request.url.path
        if path == "/loop":
            return httpx.Response(302, headers={"location": "https://hop1.example.com/loop"})
        if path == "/to-metadata":
            return httpx.Response(301, headers={"location": "https://metadata.example.com/latest"})
        if path == "/hop":
            return httpx.Response(302, headers={"location": "https://hop1.example.com/ok"})
        if path == "/slow":
            raise httpx.ReadTimeout("slow", request=request)
        return httpx.Response(200, text="hello " + request.headers["host"])

    real_client = httpx.Client
    monkeypatch.setattr(safe_fetch.socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(
        safe_fetch.httpx, "Client", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)
    )
    return seen


def _fetch(url: str) -> str:
    return safe_fetch.fetch_text(url, max_bytes=1000, user_agent="test")


def test_a_public_address_is_read_through_a_pinned_connection(served: list[httpx.Request]) -> None:
    assert _fetch("https://public.example.com/x") == "hello public.example.com"
    assert _fetch("https://public.example.com/hop") == "hello hop1.example.com", "a checked redirect is followed"
    assert [r.url.host for r in served] == ["93.184.216.34", "93.184.216.34", "93.184.216.35"]


@pytest.mark.parametrize(
    ("url", "reason"),
    [
        ("http://public.example.com/x", safe_fetch.NOT_HTTPS),
        ("file:///etc/passwd", safe_fetch.NOT_HTTPS),
        ("https://mixed.example.com/x", safe_fetch.NOT_PUBLIC),
        ("https://metadata.example.com/latest", safe_fetch.NOT_PUBLIC),
        ("https://loop.example.com/", safe_fetch.NOT_PUBLIC),
        ("https://v6local.example.com/", safe_fetch.NOT_PUBLIC),
        ("https://a:b@public.example.com/", safe_fetch.NOT_PUBLIC),
        ("https://public.example.com:22/", safe_fetch.NOT_PUBLIC),
        ("https://public.example.com:99999/", safe_fetch.NOT_PUBLIC),
        ("https://nowhere.example.com/", safe_fetch.NOT_FOUND),
        ("https://public.example.com/to-metadata", safe_fetch.NOT_PUBLIC),
        ("https://public.example.com/loop", safe_fetch.TOO_MANY_REDIRECTS),
        ("https://public.example.com/slow", safe_fetch.TOO_SLOW),
    ],
)
def test_unsafe_addresses_are_refused(served: list[httpx.Request], url: str, reason: str) -> None:
    with pytest.raises(safe_fetch.FetchRefused) as refused:
        _fetch(url)
    assert refused.value.reason == reason
    assert all(r.url.host.startswith("93.184.216.") for r in served), "no private address is contacted"


def test_bodies_are_capped(served: list[httpx.Request]) -> None:
    with pytest.raises(safe_fetch.FetchRefused) as refused:
        safe_fetch.fetch_text("https://public.example.com/x", max_bytes=5, user_agent="test")
    assert refused.value.reason == safe_fetch.TOO_LARGE
