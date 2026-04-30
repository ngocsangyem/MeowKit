#!/usr/bin/env python3
"""
http_fetch.py — Safe HTTP fetching with SSRF guard and streaming size cap.

Extracted from fetch_as_markdown.py to keep files under 400 lines.

Exports:
    safe_url(url: str) -> str | None
    safe_redirect(current_url: str, location: str) -> str | None
    static_fetch(url: str, timeout: int) -> tuple[str | None, int, str]
    PLAYWRIGHT_REJECTED_SCHEMES: frozenset[str]
"""

import ipaddress
import os
import socket
from urllib.parse import urlparse, urljoin

import requests
import requests.exceptions

try:
    from scripts.rate_limit import throttle as _throttle
except ImportError:
    # Fallback if imported outside package context (e.g. direct script invocation)
    def _throttle(host: str) -> None:  # type: ignore[misc]
        pass

try:
    from scripts.html_to_markdown import maybe_fix_mojibake
except ImportError:
    # Fallback if imported outside package context
    def maybe_fix_mojibake(text: str) -> str:  # type: ignore[misc]
        return text

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PLAYWRIGHT_REJECTED_SCHEMES = frozenset({"file", "chrome", "about", "data", "javascript"})
_BLOCKED_HOSTNAMES = frozenset({"localhost", "metadata.google.internal", "metadata.internal"})
# RFC 6598 CGN range — not caught by ipaddress flags on Python 3.12
_BLOCKED_NETWORKS = [ipaddress.ip_network("100.64.0.0/10")]
_DEFAULT_MAX_BYTES = 10 * 1024 * 1024
_HARD_CEILING_BYTES = 100 * 1024 * 1024

# Honest User-Agent (task 3.6) — identifies this tool rather than spoofing a browser.
# Used in static_fetch headers and passed to Playwright new_context(user_agent=...).
MEOWKIT_UA = "MeowKit/1.0 (+https://meowkit.dev/skills/web-to-markdown)"


def _max_bytes() -> int:
    try:
        val = int(os.environ.get("MEOWKIT_WEB_FETCH_MAX_BYTES", _DEFAULT_MAX_BYTES))
        return min(val, _HARD_CEILING_BYTES)
    except (ValueError, TypeError):
        return _DEFAULT_MAX_BYTES


# ---------------------------------------------------------------------------
# Layer 2: URL safety guard
# ---------------------------------------------------------------------------

def safe_url(url: str) -> str | None:
    """
    Validate URL before any network call. Returns the URL if safe, else None.

    Blocks:
    - Non-http(s) schemes
    - Credentials in netloc (user:pass@)
    - Private/loopback/link-local/reserved/multicast IPv4 + IPv6
    - Hostname blocklist (localhost, GCE metadata, etc.)
    - DNS resolution failure (conservative — no DNS = reject)
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return None

    if parsed.scheme not in ("http", "https"):
        return None
    if parsed.username or parsed.password:
        return None

    hostname = parsed.hostname
    if not hostname:
        return None
    if hostname.lower() in _BLOCKED_HOSTNAMES:
        return None

    # DNS resolve + IP classification (handles IPv4 + IPv6 including mapped forms)
    # KNOWN LIMITATION (out-of-scope v1, M-2): DNS TOCTOU / DNS rebinding — safe_url resolves
    # hostname here, but requests.get() re-resolves independently. A TTL=0 rebinding attacker
    # could serve a public IP to getaddrinfo and a private IP to requests. Mitigated at network
    # layer (egress firewall to RFC1918); single-resolve-by-IP pattern deferred to v2 due to
    # TLS SNI / virtual-hosting complexity.
    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except (socket.gaierror, OSError):
        return None  # DNS failure → reject (SSRF guard)

    for (_fam, _type, _proto, _canon, sockaddr) in addr_infos:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            return None
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast):
            return None
        if any(ip in net for net in _BLOCKED_NETWORKS):
            return None

    return url


def safe_redirect(current_url: str, location: str) -> str | None:
    """
    Validate a redirect hop.

    Rejects:
    - https → http downgrade
    - Cross-eTLD+1 domain jump (simple last-2-label comparison)

    Returns the absolute validated URL, or None if unsafe.
    """
    try:
        abs_location = urljoin(current_url, location)
        parsed_cur = urlparse(current_url)
        parsed_nxt = urlparse(abs_location)
    except Exception:
        return None

    if parsed_cur.scheme == "https" and parsed_nxt.scheme == "http":
        return None

    def _etld1(host: str) -> str:
        # KNOWN LIMITATION (out-of-scope v1, M-4): naive last-2-labels eTLD+1 check.
        # Breaks on ccTLDs like .co.uk / .com.au — attacker.co.uk and victim.co.uk
        # share the same eTLD+1 ("co.uk") allowing cross-subdomain redirects.
        # PSL-based tldextract deferred to v2 to avoid adding new dependency now.
        parts = host.lower().split(".")
        return ".".join(parts[-2:]) if len(parts) >= 2 else host

    if _etld1(parsed_cur.hostname or "") != _etld1(parsed_nxt.hostname or ""):
        return None

    return safe_url(abs_location)


# ---------------------------------------------------------------------------
# Layer 3: Streaming HTTP fetch with size cap and manual redirect loop
# ---------------------------------------------------------------------------

def static_fetch(url: str, timeout: int = 15) -> tuple[str | None, int, str]:
    """
    HTTP GET with streaming size cap and allow_redirects=False + manual re-validation.

    Returns (html_text_or_None, http_status_code, content_type_or_error_tag).
    Never raises — all network errors are caught and returned as (None, code, tag).
    """
    max_bytes = _max_bytes()
    current_url = url
    hops = 0

    while hops < 3:  # max 3 hops (0,1,2); hops<3 matches spec "max 3 redirects"
        # Per-domain rate limit (task 3.5) — sleep if we called this host too recently.
        # Called after safe_url validation, before the actual network call.
        _throttle(urlparse(current_url).hostname or current_url)
        try:
            r = requests.get(
                current_url,
                headers={
                    "User-Agent": MEOWKIT_UA,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                },
                timeout=timeout,
                stream=True,
                allow_redirects=False,
            )
        except requests.exceptions.SSLError:
            return None, 0, "ssl_error"
        except requests.exceptions.Timeout:
            return None, 0, "timeout"
        except requests.exceptions.ConnectionError:
            return None, 0, "connection_error"
        except requests.exceptions.RequestException:
            return None, 0, "request_error"

        http_status = r.status_code
        content_type = r.headers.get("content-type", "")

        # Manual redirect — re-validate each hop (Layer 2)
        if http_status in (301, 302, 303, 307, 308):
            location = r.headers.get("location", "")
            try:
                r.close()
            except Exception:
                pass
            if not location:
                return None, http_status, content_type
            next_url = safe_redirect(current_url, location)
            if next_url is None:
                return None, http_status, "unsafe_redirect"
            current_url = next_url
            hops += 1
            continue

        # Content-length pre-check
        try:
            cl = int(r.headers.get("content-length", 0))
            if cl > max_bytes:
                return None, http_status, f"size_exceeded_content_length:{cl}"
        except (ValueError, TypeError):
            pass

        # HTTP error status
        try:
            r.raise_for_status()
        except requests.exceptions.HTTPError:
            return None, http_status, f"http_error_{http_status}"

        # Streaming read with hard cap
        total = 0
        chunks: list[bytes] = []
        try:
            for chunk in r.iter_content(8192):
                total += len(chunk)
                if total > max_bytes:
                    return None, http_status, f"size_exceeded_stream:{total}"
                chunks.append(chunk)
        except requests.exceptions.RequestException:
            return None, http_status, "stream_error"

        raw = b"".join(chunks)

        # Encoding detection — r.apparent_encoding is unsafe after iter_content()
        # because it accesses r.content which raises RuntimeError after streaming.
        # Use chardet directly on the already-buffered bytes instead.
        encoding = r.encoding
        if not encoding or encoding.lower() == "iso-8859-1":
            import chardet
            detected = chardet.detect(raw)
            encoding = detected.get("encoding") or "utf-8"
        try:
            text = raw.decode(encoding, errors="replace")
        except (LookupError, UnicodeDecodeError):
            text = raw.decode("utf-8", errors="replace")

        return maybe_fix_mojibake(text), http_status, content_type

    return None, 0, "max_redirects_exceeded"
