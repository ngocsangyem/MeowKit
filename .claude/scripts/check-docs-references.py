#!/usr/bin/env python3
"""Check every docs/* reference in shipped .claude/ files against the Type-1 allowlist.

Mirrors packages/mewkit/src/core/check-docs-references.ts. Both implementations parse the
fenced ALLOWLIST-START / ALLOWLIST-END block in .claude/rules/docs-reference-contract.md
as the single source of truth.

Usage:
    python3 .claude/scripts/check-docs-references.py [path/to/.claude]

Exits 1 on any ERROR finding. WARN findings do not change the exit code.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

# Subdirs of .claude/ that ship in the release zip and are subject to the contract.
SCAN_DIRS = (
    "agents",
    "skills",
    "commands",
    "memory",
    "hooks",
    "scripts",
    "rules",
    "rules-conditional",
    "modes",
    "benchmarks",
)

# Files allowed to mention banned paths (they DEFINE the bans).
FILE_WHITELIST = {
    "rules/docs-reference-contract.md",
    "rules/skill-authoring-rules.md",
}

# Skills with project-side Grep semantics — skip path checks inside them.
SKILL_DIR_WHITELIST = ("skills/docs-finder",)

SCAN_SUFFIXES = (".md", ".sh", ".py", ".cjs", ".js")

URL_RE = re.compile(r"https?://[^\s)\]\"'`,]+")
ANGLE_RE = re.compile(r"<[^>]*>")
TOKEN_RE = re.compile(r"docs/[A-Za-z0-9_./\-]+")


def extract_fenced(content: str, start_marker: str, end_marker: str) -> list[str]:
    start = f"<!-- {start_marker} -->"
    end = f"<!-- {end_marker} -->"
    si = content.find(start)
    ei = content.find(end)
    if si == -1 or ei == -1 or ei < si:
        return []
    block = content[si + len(start):ei]
    return [
        line.strip()
        for line in block.splitlines()
        if line.strip() and not line.strip().startswith(("#", "<!--"))
    ]


def parse_allowlist(contract_path: Path) -> tuple[list[str], list[str]]:
    content = contract_path.read_text(encoding="utf-8")
    return (
        extract_fenced(content, "ALLOWLIST-START", "ALLOWLIST-END"),
        extract_fenced(content, "RESERVED-START", "RESERVED-END"),
    )


def is_allowed(token: str, allowed: Iterable[str]) -> bool:
    for entry in allowed:
        if entry.endswith("/"):
            if token.startswith(entry):
                return True
        elif token == entry:
            return True
    return False


def strip_urls(line: str) -> str:
    return URL_RE.sub("", line)


def extract_tokens(line: str) -> list[str]:
    # Strip URL fragments and angle-bracket-wrapped content (HTML tags and placeholders)
    cleaned = ANGLE_RE.sub("", strip_urls(line))
    tokens: list[str] = []
    for match in TOKEN_RE.finditer(cleaned):
        token = match.group(0).rstrip(".,)]")
        tokens.append(token)
    return tokens


def walk_files(root: Path) -> list[Path]:
    out: list[Path] = []
    if not root.is_dir():
        return out
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        # `__tests__` joins `tests`: a docs/ path inside a test file is fixture
        # data, not a runtime reference, and a fixture string never resolves.
        # Kept identical to core/check-docs-references.ts (parity is enforced).
        if any(part in {"node_modules", ".venv", "tests", "__tests__", "__pycache__"} for part in path.parts):
            continue
        if path.suffix in SCAN_SUFFIXES:
            out.append(path)
    return out


def is_in_whitelisted_skill(rel_path: str) -> bool:
    for prefix in SKILL_DIR_WHITELIST:
        if rel_path.startswith(prefix + "/"):
            return True
    return False


def check(claude_dir: Path) -> int:
    contract_path = claude_dir / "rules" / "docs-reference-contract.md"
    if not contract_path.exists():
        print(f"Contract file missing: {contract_path}", file=sys.stderr)
        return 2
    allowed, reserved = parse_allowlist(contract_path)

    errors = 0
    warns = 0
    scanned = 0

    for sub in SCAN_DIRS:
        for file in walk_files(claude_dir / sub):
            scanned += 1
            rel = str(file.relative_to(claude_dir))
            rel_posix = rel.replace("\\", "/")
            if rel_posix in FILE_WHITELIST:
                continue
            if is_in_whitelisted_skill(rel_posix):
                continue

            content = file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(content.splitlines(), start=1):
                for token in extract_tokens(line):
                    if is_allowed(token, allowed):
                        continue
                    if is_allowed(token, reserved):
                        print(f"{rel_posix}:{lineno}: WARN: {token} — reserved future path")
                        warns += 1
                        continue
                    print(
                        f"{rel_posix}:{lineno}: ERROR: {token} "
                        "— not on Type-1 allowlist"
                    )
                    errors += 1

    print(
        f"\nScanned {scanned} files. {errors} error(s), {warns} warning(s).",
        file=sys.stderr,
    )
    return 1 if errors > 0 else 0


def main() -> int:
    if len(sys.argv) > 1:
        target = Path(sys.argv[1]).resolve()
    else:
        target = Path.cwd() / ".claude"
    if not target.is_dir():
        print(f"Not a directory: {target}", file=sys.stderr)
        return 2
    return check(target)


if __name__ == "__main__":
    sys.exit(main())
