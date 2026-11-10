#!/usr/bin/env python3
"""Brand-prose lint for the toolkit .claude/ markdown source tree.

Reports:
  - "MeowKit" narrative prose (not backtick-identifier)
  - "Claude Code" / "claude-code" narrative prose (not backtick-identifier)
  - "Anthropic" non-citation mentions (citation = ±2 lines contain
    "research" / "thesis" / "field report" keyword OR the
    `<!-- research-citation -->` marker OR a blockquote prefix)

Skips:
  - lines inside fenced code blocks
  - backtick-wrapped tokens on the line
  - files matching an allowlist glob (PurePosixPath.match semantics)

Usage:
  check-anthropic-context.py <root-dir> [<allowlist-file>]

Exits 0 silently when nothing emits. Each violation is printed as
`path:line: message` for editor jump-to-error compatibility.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path, PurePosixPath

WINDOW = 2
CITATION_KEYWORDS = re.compile(r"\bresearch\b|\bthesis\b|\bfield\s+report\b", re.IGNORECASE)
CITATION_MARKER = re.compile(r"<!--\s*research-citation\s*-->")
BLOCKQUOTE_ANTHROPIC = re.compile(r"^\s*>.*\bAnthropic\b")
ANTHROPIC_TOKEN = re.compile(r"\bAnthropic\b")
MEOWKIT_TOKEN = re.compile(r"\bMeowKit\b")
CLAUDE_CODE_TOKEN = re.compile(r"\bClaude Code\b|\bclaude-code\b")
BACKTICK_SEGMENT = re.compile(r"`[^`]*`")
# Documented factual-prefix forms — preserve them in source. Converters still
# substitute the target name at migrate time so output stays target-clean.
# Case-insensitive on "on" so mid-sentence use ("but on Claude Code, ...") passes.
FACTUAL_PREFIX = re.compile(r"\b[Oo]n Claude Code,\s")


def load_allowlist(path: str) -> list[str]:
    if not path:
        return []
    p = Path(path)
    if not p.is_file():
        return []
    patterns: list[str] = []
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # Allow a reason comment after a full-path pattern. The lint consumes
        # only the pattern; a separate format guard enforces that the reason is
        # present and that the pattern is not dangerously broad.
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        patterns.append(line)
    return patterns


def is_allowlisted(rel_path: str, patterns: list[str]) -> bool:
    p = PurePosixPath(rel_path)
    return any(p.match(pat) for pat in patterns)


def strip_backticks(line: str) -> str:
    return BACKTICK_SEGMENT.sub("", line)


def is_citation_context(idx: int, lines: list[str]) -> bool:
    lo = max(0, idx - WINDOW)
    hi = min(len(lines) - 1, idx + WINDOW)
    for j in range(lo, hi + 1):
        text = lines[j]
        if CITATION_MARKER.search(text):
            return True
        if CITATION_KEYWORDS.search(text):
            return True
        if BLOCKQUOTE_ANTHROPIC.match(text):
            return True
    return False


def scan_file(path: Path) -> list[str]:
    violations: list[str] = []
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return violations
    lines = text.splitlines()
    in_fence = False
    # YAML frontmatter (--- ... ---) at file head holds identifier-style values
    # (description, adapted_for, keywords) — exempt from narrative-prose rules.
    in_frontmatter = False
    if lines and lines[0].strip() == "---":
        in_frontmatter = True
    for idx, line in enumerate(lines):
        if in_frontmatter:
            if idx > 0 and line.strip() == "---":
                in_frontmatter = False
            continue
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        clean = strip_backticks(line)
        # Strip the documented factual-prefix form before checking — "On Claude Code, X"
        # is allowed in source per the branding style guide.
        scoped = FACTUAL_PREFIX.sub("", clean)
        # MeowKit narrative prose
        if MEOWKIT_TOKEN.search(scoped):
            violations.append(f"{path}:{idx + 1}: 'MeowKit' narrative prose — use 'the toolkit'")
        # Claude Code narrative prose
        if CLAUDE_CODE_TOKEN.search(scoped):
            violations.append(f"{path}:{idx + 1}: 'Claude Code' narrative prose — use 'the host runtime' or 'On Claude Code, ...'")
        # Anthropic non-citation
        if ANTHROPIC_TOKEN.search(clean) and not is_citation_context(idx, lines):
            violations.append(f"{path}:{idx + 1}: non-citation Anthropic mention — use 'per the runtime's plugin contract' or mark as citation")
    return violations


def rel_for(md_path: Path, root: Path) -> str:
    """Path used for allowlist matching — relative to root.parent (matches full-scan)."""
    base = root.parent if root.parent.exists() else root
    try:
        return md_path.relative_to(base).as_posix()
    except ValueError:
        return md_path.as_posix()


def main() -> int:
    # Parse: <root> [<allowlist>] [--files f1 f2 ...]. Default (no --files) scans the
    # whole root tree exactly as before — back-compat for the full-tree CI path.
    argv = sys.argv[1:]
    files_arg: list[str] = []
    if "--files" in argv:
        i = argv.index("--files")
        files_arg = argv[i + 1 :]
        argv = argv[:i]
    if len(argv) < 1:
        print("usage: check-anthropic-context.py <root> [<allowlist>] [--files <md>...]", file=sys.stderr)
        return 2
    root = Path(argv[0])
    allow_path = argv[1] if len(argv) > 1 else ""
    allow_patterns = load_allowlist(allow_path)

    if files_arg:
        # Scan only the listed markdown files that exist (callers pass changed files,
        # which may include deletions or non-markdown paths — silently skip those).
        md_paths = [Path(f) for f in files_arg if f.endswith(".md") and Path(f).is_file()]
    else:
        if not root.is_dir():
            print(f"check-anthropic-context: {root} not a directory", file=sys.stderr)
            return 2
        md_paths = sorted(root.rglob("*.md"))

    violations: list[str] = []
    for md_path in md_paths:
        rel = rel_for(md_path, root)
        if is_allowlisted(rel, allow_patterns):
            continue
        violations.extend(scan_file(md_path))

    for line in violations:
        print(line)
    # Contract: violations are reported on STDOUT, not via exit code — this always
    # returns 0. Callers (lint-brand-prose.sh) MUST check stdout content, not $?.
    return 0


if __name__ == "__main__":
    sys.exit(main())
