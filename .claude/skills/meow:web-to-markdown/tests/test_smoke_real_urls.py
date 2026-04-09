"""
Smoke tests for meow:web-to-markdown against real, stable URLs.

These tests make live network calls and are DISABLED by default.

How to run:
    MEOWKIT_RUN_SMOKE_TESTS=1 pytest -m smoke tests/test_smoke_real_urls.py -v

Requirements:
    - Network access to example.com, httpbin.org, rfc-editor.org
    - meow:web-to-markdown Python deps installed:
        .claude/skills/.venv/bin/pip install -r .claude/skills/meow:web-to-markdown/scripts/requirements.txt
    - Run from project root (so .claude/cache/ resolves correctly)
    - Set MEOWKIT_WEB_FETCH_PERSIST=off to avoid writing cache files during tests (optional)
"""

import os
import sys

import pytest

# Skip the entire module unless the opt-in env var is set.
# Keeps CI clean by default — smoke tests only run on explicit request.
pytestmark = pytest.mark.skipif(
    os.environ.get("MEOWKIT_RUN_SMOKE_TESTS") != "1",
    reason=(
        "Smoke tests disabled by default (make live network calls). "
        "Enable with: MEOWKIT_RUN_SMOKE_TESTS=1 pytest -m smoke tests/test_smoke_real_urls.py"
    ),
)

# ---------------------------------------------------------------------------
# Path bootstrap — allow import from project root
# ---------------------------------------------------------------------------

# When running from the meow:web-to-markdown skill directory directly,
# ensure the project root is on sys.path so `scripts.*` imports resolve.
_SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SKILL_DIR not in sys.path:
    sys.path.insert(0, _SKILL_DIR)

from scripts.fetch_as_markdown import fetch_as_markdown  # noqa: E402

# DATA boundary fence marker — every successful response must contain this
_DATA_FENCE = "```fetched-markdown"

# Minimum meaningful response size (bytes)
_MIN_SIZE_BYTES = 100


def _assert_success(result: str, url: str) -> None:
    """Shared assertions for every smoke test result."""
    assert "Fetched" in result, f"Expected 'Fetched' in result for {url!r}; got: {result[:200]!r}"
    assert url in result, f"Expected URL {url!r} in result; got: {result[:200]!r}"
    assert _DATA_FENCE in result, (
        f"Expected DATA boundary fence '{_DATA_FENCE}' in result for {url!r}; "
        f"got: {result[:200]!r}"
    )
    assert len(result.encode("utf-8")) >= _MIN_SIZE_BYTES, (
        f"Result for {url!r} is suspiciously small ({len(result.encode('utf-8'))} bytes)"
    )


@pytest.mark.smoke
def test_example_com_smoke():
    """
    Fetch https://example.com — the canonical stable baseline.

    IANA maintains this page specifically for testing. It has minimal
    JavaScript and a predictable HTML structure: heading + paragraph.
    Smoke: verify static fetch path returns a valid DATA-wrapped response.
    """
    url = "https://example.com"
    result = fetch_as_markdown(url, caller="user:direct")
    _assert_success(result, url)


@pytest.mark.smoke
def test_httpbin_html_smoke():
    """
    Fetch https://httpbin.org/html — known stable HTML endpoint.

    httpbin returns a deterministic Herman Melville excerpt HTML page.
    Smoke: verify the static fetch + html-to-markdown pipeline on a real
    HTTP service. The response is predictable enough to check for a content
    keyword.
    """
    url = "https://httpbin.org/html"
    result = fetch_as_markdown(url, caller="user:direct")
    _assert_success(result, url)


@pytest.mark.smoke
def test_rfc_editor_rfc9110_smoke():
    """
    Fetch https://www.rfc-editor.org/rfc/rfc9110.html — stable IETF RFC.

    RFC 9110 (HTTP Semantics) is a long-lived, stable document maintained by
    the IETF. Smoke: verify fetch handles a large, well-structured HTML page
    from a reliable authoritative source. Also exercises the size-cap path
    (RFC 9110 is ~400KB of HTML).
    """
    url = "https://www.rfc-editor.org/rfc/rfc9110.html"
    result = fetch_as_markdown(url, caller="user:direct")
    _assert_success(result, url)
