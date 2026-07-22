#!/usr/bin/env python3
"""scout-context.py — bounded hint scanner for mk:prompt-enhancer --deep.

Role: a fallback HINT source, NOT a mk:scout replacement. It is used when a
full mk:scout invocation is unavailable or over-budget; it performs the same
allow/forbid-filtered, capped walk and inherits the contract in
`references/deep-mode-scout.md`. When mk:scout is available and within budget,
prefer it and post-filter its result through the same lists. The enhancer is a
consumer of bounded discovery, never a broad codebase mapper (that is mk:scout).

Enforces the allow-list / forbid-list / hard caps spec'd in
`references/deep-mode-scout.md`. Default-deny: a path must survive the
forbid-list AND match the allow-list to be read.

Usage (stdin JSON):
  echo '{"keywords": ["auth"], "symbols": ["login"], "git_root": "/abs/path"}' \
    | .claude/skills/.venv/bin/python3 scripts/scout-context.py

Output (stdout JSON):
  {
    "hits": [{"path": "src/auth/login.ts", "symbols": [...], "summary": "..."}],
    "git_sha": "<sha>",
    "abort_reason": null | "NO_GIT_REPO" | "MINIMAL_DENSITY" | "NO_MATCHES"
                  | "SCOUT_BUDGET_EXCEEDED" | "SCOUT_BOUNDARY_VIOLATION"
  }

Exit codes:
  0 — success (hits or graceful abort)
  1 — internal error (logged to stderr; output JSON has abort_reason)
"""

from __future__ import annotations

import fnmatch
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# Caps (cite references/deep-mode-scout.md)
MAX_FILES = 8
MAX_LINES_PER_FILE = 100
MAX_WALL_CLOCK_SECONDS = 30

# Allow-list patterns. Glob-matched against repo-relative path.
ALLOW_LIST = [
    "docs/project-context.md",
    "docs/*.md",
    "CLAUDE.md",
    "AGENTS.md",
    "*/CLAUDE.md",
    "**/CLAUDE.md",
    "**/AGENTS.md",
    "README.md",
    "*/README.md",
    "**/README.md",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
]

# Source-file extensions allow-listed for keyword matching (read first 100 lines).
SOURCE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx",
    ".py", ".go", ".rs",
    ".java", ".rb", ".kt", ".swift",
    ".vue",
}

# Forbid-list. Checked FIRST (default-deny).
FORBID_LIST = [
    ".claude/memory/*",
    ".claude/memory/**",
    ".env",
    ".env.*",
    "tasks/*",
    "tasks/**",
    "*.pem",
    "*.key",
    "*.keystore",
    "*credentials*",
    "*secret*",
    "node_modules/*",
    "node_modules/**",
    ".git/*",
    ".git/**",
    "dist/*",
    "dist/**",
    "build/*",
    "build/**",
    "out/*",
    "out/**",
    ".next/*",
    ".next/**",
    ".cache/*",
    ".cache/**",
]

# Top-level symbol patterns by language (cheap regex, no AST).
SYMBOL_PATTERNS = {
    ".ts": [r"^export\s+(?:async\s+)?function\s+(\w+)",
            r"^export\s+class\s+(\w+)",
            r"^export\s+(?:type|interface)\s+(\w+)",
            r"^export\s+const\s+(\w+)"],
    ".tsx": [r"^export\s+(?:async\s+)?function\s+(\w+)",
             r"^export\s+class\s+(\w+)",
             r"^export\s+(?:type|interface)\s+(\w+)",
             r"^export\s+const\s+(\w+)"],
    ".js": [r"^export\s+(?:async\s+)?function\s+(\w+)",
            r"^export\s+class\s+(\w+)",
            r"^export\s+const\s+(\w+)"],
    ".jsx": [r"^export\s+(?:async\s+)?function\s+(\w+)",
             r"^export\s+class\s+(\w+)",
             r"^export\s+const\s+(\w+)"],
    ".py": [r"^def\s+(\w+)\(", r"^class\s+(\w+)"],
    ".go": [r"^func\s+(\w+)\(", r"^type\s+(\w+)\s+"],
    ".rs": [r"^pub\s+fn\s+(\w+)", r"^pub\s+struct\s+(\w+)", r"^pub\s+enum\s+(\w+)"],
    ".java": [r"^\s*public\s+(?:static\s+)?(?:[\w<>,\s]+)\s+(\w+)\s*\("],
    ".rb": [r"^def\s+(\w+)", r"^class\s+(\w+)"],
    ".kt": [r"^fun\s+(\w+)", r"^class\s+(\w+)"],
    ".swift": [r"^func\s+(\w+)", r"^class\s+(\w+)", r"^struct\s+(\w+)"],
}


def _emit(payload: dict[str, Any]) -> None:
    """Write JSON result and flush."""
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    sys.stdout.flush()


def _git_sha(git_root: Path) -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(git_root),
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


def _resolve_git_root(hint: str | None) -> Path | None:
    candidate = Path(hint).resolve() if hint else Path.cwd().resolve()
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=str(candidate),
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    root = result.stdout.strip()
    return Path(root) if root else None


def _matches_any(rel_path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pat) for pat in patterns)


def _is_forbidden(rel_path: str) -> bool:
    """Default-deny check. Forbid wins over allow."""
    return _matches_any(rel_path, FORBID_LIST)


def _is_allowed_metadata(rel_path: str) -> bool:
    return _matches_any(rel_path, ALLOW_LIST)


def _is_allowed_source(rel_path: str) -> bool:
    return Path(rel_path).suffix in SOURCE_EXTENSIONS


def _git_check_ignore(git_root: Path, rel_path: str) -> bool:
    """Returns True if path is .gitignored (treat as forbidden)."""
    try:
        result = subprocess.run(
            ["git", "check-ignore", "-q", rel_path],
            cwd=str(git_root),
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0


def _walk_repo(git_root: Path) -> list[str]:
    """Return repo-relative file paths, skipping common heavy dirs early."""
    skip_dirs = {".git", "node_modules", "dist", "build", "out", ".next", ".cache"}
    paths: list[str] = []
    for root, dirs, files in os.walk(git_root):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
        for f in files:
            full = Path(root) / f
            try:
                rel = full.relative_to(git_root).as_posix()
            except ValueError:
                continue
            paths.append(rel)
    return paths


def _score_candidate(rel_path: str, keywords: list[str], symbols: list[str]) -> int:
    """Higher = more relevant. Used to rank candidates within budget."""
    score = 0
    name = Path(rel_path).name.lower()
    haystack = rel_path.lower()
    for kw in keywords:
        if not kw:
            continue
        kw_lower = kw.lower()
        if kw_lower in name:
            score += 3
        elif kw_lower in haystack:
            score += 1
    for sym in symbols:
        if sym and sym.lower() in haystack:
            score += 2
    if rel_path == "docs/project-context.md":
        score += 5
    if rel_path == "CLAUDE.md":
        score += 4
    if rel_path == "README.md":
        score += 2
    return score


def _read_capped(path: Path, max_lines: int) -> list[str] | None:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            lines: list[str] = []
            for i, line in enumerate(fh):
                if i >= max_lines:
                    break
                lines.append(line.rstrip("\n"))
            return lines
    except (FileNotFoundError, PermissionError, OSError):
        return None


def _extract_symbols(rel_path: str, lines: list[str]) -> list[str]:
    suffix = Path(rel_path).suffix
    patterns = SYMBOL_PATTERNS.get(suffix, [])
    symbols: list[str] = []
    seen: set[str] = set()
    for line in lines:
        for pat in patterns:
            for match in re.finditer(pat, line):
                name = match.group(1)
                if name and name not in seen:
                    seen.add(name)
                    symbols.append(name)
    return symbols[:10]


def _extract_summary(rel_path: str, lines: list[str]) -> str:
    """First non-empty line of a public docstring or top comment, ≤80 chars."""
    suffix = Path(rel_path).suffix
    if suffix in {".md", ""}:
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                return stripped[:80]
        return ""
    for raw in lines[:20]:
        line = raw.strip()
        if not line:
            continue
        # Python triple-quoted docstring start
        if line.startswith(('"""', "'''")):
            text = line.strip('"').strip("'").strip()
            if text:
                return text[:80]
            continue
        # JS/TS/Java/Go single-line or block comment
        if line.startswith("//"):
            return line.lstrip("/ ").strip()[:80]
        if line.startswith("/*") or line.startswith("*"):
            return line.lstrip("/* ").strip()[:80]
        if line.startswith("#") and suffix == ".py":
            return line.lstrip("# ").strip()[:80]
    return ""


def _scan_for_violations(hits: list[dict[str, Any]]) -> bool:
    """Failsafe: scan output for forbid-list references."""
    forbidden_substrings = [
        ".claude/memory/",
        ".env",
        "id_rsa",
        "id_ed25519",
        "credentials",
        "secret",
    ]
    for hit in hits:
        path = hit.get("path", "")
        summary = hit.get("summary", "")
        for needle in forbidden_substrings:
            if needle in path:
                return True
            if needle in summary.lower():
                return True
    return False


def main() -> int:
    raw = sys.stdin.read().strip()
    if not raw:
        _emit({"hits": [], "git_sha": None, "abort_reason": "NO_INPUT"})
        return 0

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON input: {exc}", file=sys.stderr)
        _emit({"hits": [], "git_sha": None, "abort_reason": "INVALID_INPUT"})
        return 1

    keywords = [k for k in payload.get("keywords", []) if isinstance(k, str)]
    symbols = [s for s in payload.get("symbols", []) if isinstance(s, str)]
    git_root_hint = payload.get("git_root")

    if os.environ.get("MEOWKIT_AUTOBUILD_MODE") == "MINIMAL":
        _emit({"hits": [], "git_sha": None, "abort_reason": "MINIMAL_DENSITY"})
        return 0

    git_root = _resolve_git_root(git_root_hint)
    if git_root is None:
        _emit({"hits": [], "git_sha": None, "abort_reason": "NO_GIT_REPO"})
        return 0

    git_sha = _git_sha(git_root)
    start = time.monotonic()

    all_paths = _walk_repo(git_root)

    candidates: list[tuple[int, str]] = []
    for rel in all_paths:
        if _is_forbidden(rel):
            continue
        if _git_check_ignore(git_root, rel):
            continue
        if not (_is_allowed_metadata(rel) or _is_allowed_source(rel)):
            continue
        score = _score_candidate(rel, keywords, symbols)
        if score <= 0 and not _is_allowed_metadata(rel):
            continue
        candidates.append((score, rel))
        if time.monotonic() - start > MAX_WALL_CLOCK_SECONDS:
            _emit({
                "hits": [],
                "git_sha": git_sha,
                "abort_reason": "SCOUT_BUDGET_EXCEEDED",
            })
            return 0

    candidates.sort(key=lambda x: (-x[0], x[1]))
    selected = candidates[:MAX_FILES]

    if not selected:
        _emit({"hits": [], "git_sha": git_sha, "abort_reason": "NO_MATCHES"})
        return 0

    hits: list[dict[str, Any]] = []
    for _, rel in selected:
        if time.monotonic() - start > MAX_WALL_CLOCK_SECONDS:
            _emit({
                "hits": hits,
                "git_sha": git_sha,
                "abort_reason": "SCOUT_BUDGET_EXCEEDED",
            })
            return 0
        full = git_root / rel
        lines = _read_capped(full, MAX_LINES_PER_FILE)
        if lines is None:
            continue
        hit: dict[str, Any] = {"path": rel}
        syms = _extract_symbols(rel, lines)
        if syms:
            hit["symbols"] = syms
        summary = _extract_summary(rel, lines)
        if summary:
            hit["summary"] = summary
        hits.append(hit)

    if _scan_for_violations(hits):
        _emit({"hits": [], "git_sha": git_sha, "abort_reason": "SCOUT_BOUNDARY_VIOLATION"})
        return 0

    _emit({"hits": hits, "git_sha": git_sha, "abort_reason": None})
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
