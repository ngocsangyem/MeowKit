#!/usr/bin/env python3
"""
injection_detect.py — Layer 5 pre-write injection scanner for meow:web-to-markdown.

Multi-pass scanner applied to cleaned markdown BEFORE persistence and preview.
On any CRITICAL hit → caller must invoke HARD_STOP (quarantine + security-log + return error).

Pattern data is in injection_patterns.py.

Passes (in order):
  1. Normalize: strip zero-width chars, NFKC Unicode normalize
  2. Scan plaintext against all pattern sets
  3. Decode base64 blocks (>=64 chars not inside code fences) → re-scan
  4. Decode ROT13 → scan for injection keywords
  5. Context-flood detection (>5000 chars + repetition ratio >0.3 → WARN)
  6. Delimiter-injection check (excess backtick fences)

Export: scan(text: str) -> InjectionVerdict
"""

import base64
import codecs
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Literal

from scripts.injection_patterns import (
    _INSTRUCTION_OVERRIDE,
    _ROLE_PLAYING,
    _ENCODING_OBFUSCATION,
    _CONTEXT_MANIPULATION,
    _MEOWKIT_SPECIFIC,
)

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

Severity = Literal["CRITICAL", "WARN", "INFO"]
Category = Literal[
    "instruction_override",
    "role_playing",
    "encoding_obfuscation",
    "context_manipulation",
    "meowkit_specific",
    "context_flood",
    "delimiter_injection",
]


@dataclass
class InjectionVerdict:
    hit: bool
    category: Category | str
    severity: Severity
    matched_pattern: str
    details: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Compile all patterns at module load; fail loud if any regex is invalid
# ---------------------------------------------------------------------------

def _compile(patterns: list[tuple[str, str]], category: str) -> list[tuple[re.Pattern, str, str]]:
    compiled = []
    for pat_str, reason in patterns:
        try:
            compiled.append((re.compile(pat_str), reason, category))
        except re.error as exc:
            # Never silently swallow a bad pattern; fail at import time
            raise ValueError(f"Bad regex in {category}: {pat_str!r} — {exc}") from exc
    return compiled


_ALL_PATTERNS: list[tuple[re.Pattern, str, str]] = (
    _compile(_INSTRUCTION_OVERRIDE, "instruction_override")
    + _compile(_ROLE_PLAYING, "role_playing")
    + _compile(_ENCODING_OBFUSCATION, "encoding_obfuscation")
    + _compile(_CONTEXT_MANIPULATION, "context_manipulation")
    + _compile(_MEOWKIT_SPECIFIC, "meowkit_specific")
)

# Fence-near-system-marker: WARN-only check (not CRITICAL — not added to _ALL_PATTERNS)
# Detects a bare ``` within 3 lines of known system/role marker text.
# Applied in a dedicated pass after Pass 2 so it returns severity=WARN, not CRITICAL.
_FENCE_SYSTEM_MARKER = re.compile(
    r"```[^\n]*\n(?:[^\n]*\n){0,3}"          # bare fence then 0-3 lines
    r"(\[SYSTEM\]|\[INSTRUCTIONS?\]|<\|system\|>|assistant\s*:|human\s*:|"
    r"### +new +instructions?|## +instructions?)",
    re.MULTILINE | re.IGNORECASE,
)

# Pattern for base64 blocks: >=64 chars of base64 alphabet outside code fences
_B64_BLOCK = re.compile(r"(?<![`\w])[A-Za-z0-9+/]{64,}={0,2}(?![`\w])")

# ROT13 injection keywords to check after decoding
_ROT13_KEYWORDS = re.compile(
    r"(?i)\b(ignore|forget|disregard|override|jailbreak|system\s+prompt|do\s+anything\s+now)\b"
)

# Zero-width + invisible chars
_ZERO_WIDTH = re.compile(r"[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E]")

# Cyrillic homoglyphs (>=3 consecutive)
_CYRILLIC_HOMOGLYPH = re.compile(r"[\u0430\u0435\u043E\u0440\u0441\u0443\u0445\u0456]{3,}")
# Greek homoglyphs (>=2 consecutive)
_GREEK_HOMOGLYPH = re.compile(r"[\u03B1\u03B5\u03BF\u03C1\u03BD\u03C4]{2,}")

# Code-fence detector (to exclude base64 inside legitimate fences)
_CODE_FENCE = re.compile(r"```[^`]*```", re.DOTALL)


def _repetition_ratio(text: str) -> float:
    words = text.split()
    if len(words) < 10:
        return 0.0
    unique = len(set(w.lower() for w in words))
    return 1.0 - (unique / len(words))


def _normalize(text: str) -> str:
    """Strip zero-width chars and apply NFKC normalization (catches homoglyphs)."""
    text = _ZERO_WIDTH.sub("", text)
    return unicodedata.normalize("NFKC", text)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scan(text: str) -> InjectionVerdict:
    """
    Scan fetched markdown for prompt-injection indicators.

    Returns InjectionVerdict with:
      - hit=True → HARD_STOP required (severity CRITICAL)
      - hit=False, severity=WARN → context-flood or non-critical signal
      - hit=False, severity=INFO → clean

    The caller is responsible for HARD_STOP behavior on hit=True.
    """
    details: list[str] = []

    # --- Pass 1: Normalize ---
    normalized = _normalize(text)

    # Check for homoglyph attacks (not caught by NFKC for all scripts)
    if _CYRILLIC_HOMOGLYPH.search(text):
        return InjectionVerdict(
            hit=True,
            category="encoding_obfuscation",
            severity="CRITICAL",
            matched_pattern="Cyrillic homoglyph sequence",
            details=["Cyrillic lookalike characters detected — possible homoglyph attack"],
        )
    if _GREEK_HOMOGLYPH.search(text):
        return InjectionVerdict(
            hit=True,
            category="encoding_obfuscation",
            severity="CRITICAL",
            matched_pattern="Greek homoglyph sequence",
            details=["Greek lookalike characters detected — possible homoglyph attack"],
        )

    # --- Pass 2: Scan normalized plaintext ---
    for pattern, reason, category in _ALL_PATTERNS:
        m = pattern.search(normalized)
        if m:
            return InjectionVerdict(
                hit=True,
                category=category,  # type: ignore[arg-type]
                severity="CRITICAL",
                matched_pattern=reason,
                details=[f"Matched: {m.group(0)!r}"],
            )

    # --- Pass 2b: Fence-near-system-marker (WARN, not HARD_STOP) ---
    m = _FENCE_SYSTEM_MARKER.search(normalized)
    if m:
        details.append(f"Bare fence within 3 lines of system/role marker: {m.group(0)[:120]!r}")
        return InjectionVerdict(
            hit=False,
            category="delimiter_injection",
            severity="WARN",
            matched_pattern="fence-near-system-marker",
            details=details,
        )

    # --- Pass 3: Base64 decode + re-scan ---
    # Strip known code fences so we don't decode legitimate code samples
    text_no_fences = _CODE_FENCE.sub("", normalized)
    for b64_match in _B64_BLOCK.finditer(text_no_fences):
        raw = b64_match.group(0)
        padded = raw + "=" * (-len(raw) % 4)
        try:
            decoded_bytes = base64.b64decode(padded, validate=False)
            decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
        except Exception:
            continue
        decoded_normalized = _normalize(decoded_str)
        for pattern, reason, category in _ALL_PATTERNS:
            m = pattern.search(decoded_normalized)
            if m:
                return InjectionVerdict(
                    hit=True,
                    category=category,  # type: ignore[arg-type]
                    severity="CRITICAL",
                    matched_pattern=f"[base64-encoded] {reason}",
                    details=[f"Decoded block: {decoded_str[:120]!r}"],
                )

    # --- Pass 4: ROT13 decode + scan ---
    rot13_decoded = codecs.encode(normalized, "rot_13")
    if _ROT13_KEYWORDS.search(rot13_decoded):
        return InjectionVerdict(
            hit=True,
            category="encoding_obfuscation",
            severity="CRITICAL",
            matched_pattern="[rot13-encoded] injection keyword",
            details=[f"ROT13-decoded snippet: {rot13_decoded[:200]!r}"],
        )

    # --- Pass 5: Context-flood detection (WARN, not HARD_STOP) ---
    if len(text) > 5000 and _repetition_ratio(text) > 0.3:
        return InjectionVerdict(
            hit=False,
            category="context_flood",
            severity="WARN",
            matched_pattern="CONTEXT_FLOOD_WARN",
            details=[
                f"Content length {len(text)} chars, "
                f"repetition ratio {_repetition_ratio(text):.2f} > 0.3"
            ],
        )

    # --- Pass 6: Delimiter-injection check ---
    raw_fence_count = text.count("```")
    fenced_blocks = len(_CODE_FENCE.findall(text))
    # Each fenced block consumes 2 fences; excess unpaired fences are suspicious
    excess = raw_fence_count - (fenced_blocks * 2)
    if excess > 2:
        return InjectionVerdict(
            hit=False,
            category="delimiter_injection",
            severity="WARN",
            matched_pattern="excess-backtick-fences",
            details=[
                f"Raw fence markers: {raw_fence_count}, "
                f"paired blocks: {fenced_blocks}, excess: {excess}"
            ],
        )

    return InjectionVerdict(
        hit=False,
        category="",
        severity="INFO",
        matched_pattern="",
    )
