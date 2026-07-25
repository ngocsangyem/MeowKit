"""Offline SSRF regression tests for the web-to-markdown URL guard."""

import os
import socket
import sys

import pytest

_SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SKILL_DIR not in sys.path:
    sys.path.insert(0, _SKILL_DIR)

from scripts.http_fetch import safe_redirect, safe_url  # noqa: E402


def _addresses(*ips: str):
    return [(socket.AF_INET6 if ":" in ip else socket.AF_INET, 0, 0, "", (ip, 0)) for ip in ips]


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "data:text/plain,secret",
        "javascript:alert(1)",
        "ftp://example.com/file",
        "https://user:pass@example.com/private",
        "https:///missing-host",
    ],
)
def test_safe_url_rejects_invalid_url_shapes(monkeypatch, url):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: pytest.fail("invalid URL must not resolve DNS"))
    assert safe_url(url) is None


@pytest.mark.parametrize(
    "url",
    [
        "https://localhost/admin",
        "https://LOCALHOST/admin",
        "https://metadata.google.internal/computeMetadata/v1",
        "https://metadata.internal/latest/meta-data",
    ],
)
def test_safe_url_rejects_sensitive_hostnames_without_dns(monkeypatch, url):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: pytest.fail("blocked hostname must not resolve DNS"))
    assert safe_url(url) is None


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "10.0.0.8",
        "172.16.4.2",
        "192.168.1.2",
        "169.254.169.254",
        "100.64.0.1",
        "::1",
        "fe80::1",
        "fc00::1",
        "ff02::1",
    ],
)
def test_safe_url_rejects_private_and_special_addresses(monkeypatch, ip):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: _addresses(ip))
    assert safe_url("https://public.example/path") is None


def test_safe_url_accepts_public_address_and_preserves_punycode_hostname(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda host, *_args: _addresses("93.184.216.34"))
    url = "https://xn--bcher-kva.example/catalog"
    assert safe_url(url) == url


def test_safe_url_rejects_dns_failure(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: (_ for _ in ()).throw(socket.gaierror()))
    assert safe_url("https://unresolvable.example") is None


def test_safe_url_rejects_invalid_address_from_resolver(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: _addresses("not-an-ip"))
    assert safe_url("https://public.example") is None


def test_safe_url_rejects_any_private_address_in_a_multi_address_result(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: _addresses("93.184.216.34", "127.0.0.1"))
    assert safe_url("https://mixed.example") is None


def test_safe_redirect_allows_relative_same_domain_after_revalidation(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: _addresses("93.184.216.34"))
    assert safe_redirect("https://docs.example.com/start", "/next") == "https://docs.example.com/next"


@pytest.mark.parametrize(
    ("current_url", "location"),
    [
        ("https://docs.example.com/start", "http://docs.example.com/next"),
        ("https://docs.example.com/start", "https://evil.example.net/next"),
        ("https://docs.example.com/start", "https://api.example.com/next"),
    ],
)
def test_safe_redirect_rejects_downgrades_cross_domain_and_private_targets(monkeypatch, current_url, location):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_args: _addresses("127.0.0.1"))
    assert safe_redirect(current_url, location) is None
