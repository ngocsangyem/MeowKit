#!/usr/bin/env python3
"""
robots_cache.py — robots.txt cache and enforcement for mk:web-to-markdown.

Cache file: .claude/cache/web-to-markdown/robots-cache.json
Cache entry format: {host: {fetched_at: ISO8601, robots_txt: <raw text>}}
TTL: 24 hours.

Atomic write: .tmp → os.replace.  For cross-process mutual exclusion, a sibling
lockfile (.robots-cache.lock) is flocked on POSIX systems before the tempfile is
written and released after os.replace.  On Windows (no fcntl), the atomic rename
alone prevents corruption; concurrent writers may lose updates but cannot corrupt
the cache (lost updates self-heal within the 24h TTL).

Exports:
    is_allowed(url: str, user_agent: str = MEOWKIT_UA) -> tuple[bool, str]
        Returns (allowed, reason).
        Reason strings:
            "cache hit allow"       — cached entry, allowed
            "cache hit deny"        — cached entry, denied
            "fresh fetch allow"     — live robots.txt fetch, allowed
            "fresh fetch deny"      — live robots.txt fetch, denied
            "robots fetch failed — default allow"  — network/parse error, allow per convention

Env vars:
    MEOWKIT_WEB_FETCH_RESPECT_ROBOTS — set to "0" to skip all robots checks.
    MEOWKIT_WEB_FETCH_ROBOTS_TTL_HOURS — TTL in hours (default 24).
"""

import json
import os
import tempfile
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse
from urllib.error import URLError

try:
    import fcntl
    _HAS_FCNTL = True
except ImportError:
    _HAS_FCNTL = False

try:
    from scripts.http_fetch import MEOWKIT_UA, safe_url as _safe_url
except ImportError:
    MEOWKIT_UA = "MeowKit/1.0 (+https://docs.meowkit.dev/skills/web-to-markdown)"
    _safe_url = None  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Cache path resolution
# ---------------------------------------------------------------------------

def _cache_dir() -> Path:
    """Resolve .claude/cache/web-to-markdown/ relative to project root."""
    # Walk up from this file to find the project root (contains .claude/)
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        if (parent / ".claude").is_dir():
            return parent / ".claude" / "cache" / "web-to-markdown"
    # Fallback: relative to cwd
    return Path(".claude") / "cache" / "web-to-markdown"


def _cache_file() -> Path:
    return _cache_dir() / "robots-cache.json"


def _ttl_hours() -> int:
    try:
        return int(os.environ.get("MEOWKIT_WEB_FETCH_ROBOTS_TTL_HOURS", "24"))
    except (ValueError, TypeError):
        return 24


# ---------------------------------------------------------------------------
# Cache read / write
# ---------------------------------------------------------------------------

def _load_cache() -> dict:
    cf = _cache_file()
    if not cf.exists():
        return {}
    try:
        with open(cf, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache(data: dict) -> None:
    """Atomic write with sibling-lockfile cross-process exclusion (M-1 fix).

    Locking strategy: open the FINAL cache path's sibling lockfile, flock it,
    then write to a tempfile + os.replace.  Flocking the tempfile (previous
    approach) gave zero cross-process exclusion because each writer held a lock
    on a DIFFERENT temp path.  The lockfile is a stable, shared coordination
    point that all writers flock on the same fd.
    """
    cf = _cache_file()
    cf.parent.mkdir(parents=True, exist_ok=True)

    lock_path = cf.parent / ".robots-cache.lock"
    lock_fd: int | None = None

    try:
        if _HAS_FCNTL:
            lock_fd = os.open(str(lock_path), os.O_CREAT | os.O_WRONLY, 0o644)
            fcntl.flock(lock_fd, fcntl.LOCK_EX)

        fd, tmp_path = tempfile.mkstemp(dir=cf.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(tmp_path, cf)
        except OSError:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except OSError:
        pass
    finally:
        if lock_fd is not None:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
                os.close(lock_fd)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# robots.txt fetch
# ---------------------------------------------------------------------------

def _fetch_robots_txt(scheme: str, host: str) -> str | None:
    """Fetch raw robots.txt for host. Returns text or None on any failure.

    Defense-in-depth (C-1): validates the constructed robots.txt URL via safe_url
    before making any network call.  This guards the case where a caller invokes
    is_allowed() directly without first running safe_url on the target URL.
    """
    robots_url = f"{scheme}://{host}/robots.txt"

    # SSRF guard — never fetch robots.txt from a private/disallowed address.
    if _safe_url is not None and _safe_url(robots_url) is None:
        return None  # treat as "robots fetch failed → default allow"

    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
        # Extract the raw text by re-fetching — robotparser doesn't expose it directly.
        # We only need a small string to store; reconstruct minimal representation.
        # Use urllib directly for the raw text.
        req = urllib.request.Request(
            robots_url,
            headers={"User-Agent": MEOWKIT_UA},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read(65536).decode("utf-8", errors="replace")
        return raw
    except (URLError, OSError):
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def is_allowed(url: str, user_agent: str = MEOWKIT_UA) -> tuple[bool, str]:
    """
    Check robots.txt for url. Returns (allowed, reason).

    Failure mode: if robots.txt cannot be fetched or parsed → default ALLOW
    per standard robots.txt conventions (robots.txt absence = no restrictions).

    Respects MEOWKIT_WEB_FETCH_RESPECT_ROBOTS=0 kill switch (caller must check).
    """
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        scheme = parsed.scheme or "https"
        if not host:
            return True, "no host — default allow"
    except Exception:
        return True, "url parse failed — default allow"

    now = datetime.now(timezone.utc)
    ttl = timedelta(hours=_ttl_hours())

    cache = _load_cache()
    entry = cache.get(host)

    # Check cache validity
    if entry and isinstance(entry, dict):
        try:
            fetched_at = datetime.fromisoformat(entry["fetched_at"])
            if now - fetched_at < ttl:
                robots_txt = entry.get("robots_txt", "")
                allowed = _check_robots_txt(robots_txt, url, user_agent)
                return allowed, "cache hit allow" if allowed else "cache hit deny"
        except (KeyError, ValueError, TypeError):
            pass

    # Fresh fetch
    robots_txt = _fetch_robots_txt(scheme, host)
    if robots_txt is None:
        return True, "robots fetch failed — default allow"

    # Update cache
    cache[host] = {
        "fetched_at": now.isoformat(),
        "robots_txt": robots_txt,
    }
    _save_cache(cache)

    allowed = _check_robots_txt(robots_txt, url, user_agent)
    return allowed, "fresh fetch allow" if allowed else "fresh fetch deny"


def _check_robots_txt(robots_txt: str, url: str, user_agent: str) -> bool:
    """Parse robots_txt text and check if url is allowed for user_agent."""
    rp = urllib.robotparser.RobotFileParser()
    try:
        rp.parse(robots_txt.splitlines())
        return rp.can_fetch(user_agent, url)
    except Exception:
        return True  # parse failure → default allow
