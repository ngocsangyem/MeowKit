#!/usr/bin/env python3
"""
rate_limit.py — In-memory per-host rate limiter for mk:web-to-markdown.

NOT persistent across processes — counter resets on interpreter restart.
This is intentional: the limiter prevents hammering within a single session.
Cross-session rate limiting is deferred to v2 (would require a shared lock file
and carries its own complexity/risk).

Exports:
    throttle(host: str) -> None
        Sleeps if the last call to `host` was less than THROTTLE_MS ago,
        then updates the last-call timestamp for that host.

Env vars:
    MEOWKIT_WEB_FETCH_THROTTLE_MS — milliseconds between calls per host.
        Default: 2000 (2 seconds).
        Set to 0 to disable throttling entirely.
        Must be a non-negative integer; invalid values fall back to default.
"""

import os
import time

_DEFAULT_THROTTLE_MS = 2000

# Per-host last-call timestamps (monotonic clock seconds). Keyed by hostname.
_last_call: dict[str, float] = {}


def _throttle_ms() -> int:
    """Read throttle interval from env. Returns 0 if disabled, default on bad parse."""
    raw = os.environ.get("MEOWKIT_WEB_FETCH_THROTTLE_MS", "")
    if raw == "":
        return _DEFAULT_THROTTLE_MS
    try:
        val = int(raw)
        return max(0, val)
    except (ValueError, TypeError):
        return _DEFAULT_THROTTLE_MS


def throttle(host: str) -> None:
    """
    Sleep if needed to maintain per-host rate limit, then record this call.

    Args:
        host: Hostname string (e.g. "docs.example.com"). Case-insensitive.
    """
    interval_ms = _throttle_ms()
    if interval_ms == 0:
        return

    key = host.lower()
    now = time.monotonic()

    last = _last_call.get(key)
    if last is not None:
        elapsed_ms = (now - last) * 1000
        remaining_ms = interval_ms - elapsed_ms
        if remaining_ms > 0:
            time.sleep(remaining_ms / 1000.0)

    # Record after sleep so the timestamp is as close to the actual call as possible
    _last_call[key] = time.monotonic()
