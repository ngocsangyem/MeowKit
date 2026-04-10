#!/usr/bin/env python3
"""
secret_scrub.py — Secret-scrubbing helpers for meow:web-to-markdown.

Python port of .claude/hooks/lib/secret-scrub.sh regex set.
Applied to content and URLs BEFORE any disk write (Layer 7).

Exports:
    scrub_content(text: str) -> str
    scrub_url(url: str) -> str
"""

import re
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

# ---------------------------------------------------------------------------
# Secret patterns — each entry is (compiled_regex, label)
# Replacement: [REDACTED:<label>]
# ---------------------------------------------------------------------------

_SECRET_PATTERNS: list[tuple[re.Pattern, str]] = [
    # OpenAI / Anthropic style keys
    (re.compile(r"sk-[a-zA-Z0-9]{32,}"), "api_key"),
    (re.compile(r"pk-live-[a-zA-Z0-9]+"), "api_key"),
    # Google API key (variable length: AIza + 30-35 chars)
    (re.compile(r"AIza[a-zA-Z0-9_\-]{30,}"), "google_api_key"),
    # Bearer token (must precede JWT to capture full "Bearer <jwt>" as one unit)
    (re.compile(r"(?i)bearer\s+[a-zA-Z0-9\-._~+/]+=*"), "bearer_token"),
    # JWT: header.payload.signature (standalone, not preceded by Bearer)
    (re.compile(r"(?<![Bb]earer\s)eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+"), "jwt"),
    # AWS access key ID
    (re.compile(r"AKIA[A-Z0-9]{16}"), "aws_access_key"),
    # AWS secret (key=value form)
    (re.compile(r"(?i)aws_secret_access_key\s*[=:]\s*\S+"), "aws_secret"),
    # PEM private keys (multi-line tolerated via DOTALL)
    (re.compile(
        r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----",
        re.DOTALL,
    ), "private_key"),
    # Basic-auth embedded in URL
    (re.compile(r"https?://[^:@/\s]+:[^:@/\s]+@"), "basic_auth_url"),
    # GitHub tokens (PAT, OAuth, app, refresh)
    (re.compile(r"gh[opsr]_[a-zA-Z0-9]{36}"), "github_token"),
    # npm tokens
    (re.compile(r"npm_[a-zA-Z0-9]{36}"), "npm_token"),
    # Slack tokens (bot, user, app-level, refresh)
    (re.compile(r"xox[bpra]-[a-zA-Z0-9\-]+"), "slack_token"),
]

# Query-string param names that carry credentials
_SENSITIVE_QS_KEYS = frozenset({
    "token", "api_key", "apikey", "auth", "access_token",
    "secret", "key", "password", "pass", "credentials",
})


def scrub_content(text: str) -> str:
    """Replace known secret patterns in arbitrary text with [REDACTED:<type>]."""
    for pattern, label in _SECRET_PATTERNS:
        text = pattern.sub(f"[REDACTED:{label}]", text)
    return text


def scrub_url(url: str) -> str:
    """
    Strip credentials and sensitive query-string params from a URL string.
    Handles: basic-auth in netloc, ?token=..., ?api_key=..., etc.
    Returns the scrubbed URL, or the original on parse failure.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return url

    # Strip user:pass from netloc — rebuild without credentials
    netloc = parsed.hostname or ""
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"

    # Scrub sensitive query params
    if parsed.query:
        qs = parse_qs(parsed.query, keep_blank_values=True)
        scrubbed_qs = {
            k: (["[REDACTED:url_param]"] if k.lower() in _SENSITIVE_QS_KEYS else v)
            for k, v in qs.items()
        }
        new_query = urlencode(scrubbed_qs, doseq=True)
    else:
        new_query = ""

    # Rebuild — fragment is intentionally dropped (may carry tokens)
    return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, new_query, ""))
