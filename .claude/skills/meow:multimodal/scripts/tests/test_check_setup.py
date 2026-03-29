#!/usr/bin/env python3
"""
Tests for check_setup.py — unit tests for key validation logic.

Tests cover:
- API key format validation (AIza prefix, length, Vertex AI)
- check_api_key() with/without env var
- check_dependencies() import checks
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_setup import check_api_key, check_dependencies

passed = 0
failed = 0


def ok(condition, message):
    global passed, failed
    if condition:
        print(f"✓ {message}")
        passed += 1
    else:
        print(f"✗ {message}")
        failed += 1


def eq(actual, expected, message):
    global passed, failed
    if actual == expected:
        print(f"✓ {message}")
        passed += 1
    else:
        print(f"✗ {message}")
        print(f"  Expected: {expected}")
        print(f"  Actual:   {actual}")
        failed += 1


print("Running check_setup.py tests...\n")

# ─── check_api_key — missing ─────────────────────────────────────────
print("## check_api_key() — missing key")

with patch.dict(os.environ, {}, clear=True):
    os.environ.pop('GEMINI_API_KEY', None)
    result = check_api_key()
    eq(result, None, "Returns None when key not set")

# ─── check_api_key — valid AIza format ────────────────────────────────
print("\n## check_api_key() — valid AIza format")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaSyD_test_key_1234567890abcdef'}):
    result = check_api_key()
    ok(result is not None, "Returns key for AIza format")
    eq(result, 'AIzaSyD_test_key_1234567890abcdef', "Key value preserved")

# ─── check_api_key — Vertex AI format (long, non-AIza) ───────────────
print("\n## check_api_key() — Vertex AI format")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'ya29.a0AfH6SMBxxxLongVertexAIToken_1234567890'}):
    result = check_api_key()
    ok(result is not None, "Accepts long non-AIza key (Vertex AI)")

# ─── check_api_key — too short (invalid) ─────────────────────────────
print("\n## check_api_key() — too short key")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'short'}):
    result = check_api_key()
    eq(result, None, "Rejects key that is too short")

# ─── check_api_key — empty string ────────────────────────────────────
print("\n## check_api_key() — empty string")

with patch.dict(os.environ, {'GEMINI_API_KEY': ''}):
    result = check_api_key()
    eq(result, None, "Rejects empty string key")

# ─── check_dependencies ──────────────────────────────────────────────
print("\n## check_dependencies()")

# This tests the actual import checks — google.genai and PIL may or may not be installed
# We just verify the function runs without crashing and returns a boolean
result = check_dependencies()
ok(isinstance(result, bool), "check_dependencies returns a boolean")

# ─── Summary ──────────────────────────────────────────────────────────
print(f"\n## Test Summary")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Total: {passed + failed}")

sys.exit(1 if failed > 0 else 0)
