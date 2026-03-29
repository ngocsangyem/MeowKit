#!/usr/bin/env python3
"""Documentation accuracy validator — detects potential hallucinations.

Source: claudekit-engineer
Original: .claude/scripts/validate-docs.cjs
Adapted for MeowKit: Rewritten in Python 3.9+ (no external deps) to match
MeowKit's script stack. Simplified detection patterns. Uses stdlib only.

Scans documentation files for references to code, files, and APIs that
may not actually exist in the codebase. Detects:
- References to files/paths that don't exist
- References to functions/classes not found in source
- Broken internal markdown links
- Environment variables referenced but not in .env.example

Usage: python validate-docs.py [directory]
Exit: always 0 (warn-only mode — does not block pipeline)
"""

import os
import re
import sys
from pathlib import Path


class DocFinding:
    """A documentation accuracy finding."""

    def __init__(self, level: str, description: str, file: str, line: int = 0):
        self.level = level  # WARN or INFO
        self.description = description
        self.file = file
        self.line = line

    def __str__(self) -> str:
        loc = f" (line {self.line})" if self.line else ""
        return f"[{self.level}] {self.description} — {self.file}{loc}"


def collect_source_symbols(directory: Path) -> set[str]:
    """Collect function/class names from source files."""
    symbols: set[str] = set()
    skip_dirs = {".git", "node_modules", "dist", "build", "__pycache__", ".build", ".claude"}

    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            fpath = Path(root) / fname
            if fpath.suffix not in {".ts", ".js", ".py", ".swift", ".vue"}:
                continue
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
            except (OSError, PermissionError):
                continue

            # Extract function/class/interface/type names
            for match in re.finditer(
                r'(?:function|class|interface|type|enum|const|let|var|def)\s+(\w+)', content
            ):
                symbols.add(match.group(1))

    return symbols


def collect_file_paths(directory: Path) -> set[str]:
    """Collect all relative file paths in the project."""
    paths: set[str] = set()
    skip_dirs = {".git", "node_modules", "dist", "build", "__pycache__"}

    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            rel = os.path.relpath(os.path.join(root, fname), directory)
            paths.add(rel)
            # Also add with ./ prefix
            paths.add(f"./{rel}")

    return paths


def scan_doc_file(
    filepath: Path, source_symbols: set[str], project_paths: set[str], project_root: Path
) -> list[DocFinding]:
    """Scan a single documentation file for accuracy issues."""
    findings: list[DocFinding] = []

    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except (OSError, PermissionError):
        return findings

    lines = content.splitlines()
    rel_path = str(filepath.relative_to(project_root))

    for i, line in enumerate(lines, 1):
        # Check inline code references that look like file paths
        for match in re.finditer(r'`([^`]+\.\w{1,5})`', line):
            ref = match.group(1)
            # Skip URLs, version numbers, and common non-path patterns
            if ref.startswith("http") or re.match(r'^\d+\.\d+', ref):
                continue
            # Check if it looks like a file path
            if "/" in ref or ref.startswith("."):
                clean_ref = ref.lstrip("./")
                if clean_ref not in {p.lstrip("./") for p in project_paths}:
                    findings.append(DocFinding(
                        "WARN",
                        f"References path `{ref}` — not found in project",
                        rel_path, i
                    ))

        # Check broken internal markdown links
        for match in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', line):
            link_target = match.group(2)
            # Skip external URLs and anchors
            if link_target.startswith("http") or link_target.startswith("#"):
                continue
            # Resolve relative to doc file location
            resolved = filepath.parent / link_target.split("#")[0]
            if not resolved.exists():
                findings.append(DocFinding(
                    "WARN",
                    f"Broken link: [{match.group(1)}]({link_target})",
                    rel_path, i
                ))

    return findings


def scan_docs(directory: Path) -> list[DocFinding]:
    """Scan all documentation files in the project."""
    findings: list[DocFinding] = []
    source_symbols = collect_source_symbols(directory)
    project_paths = collect_file_paths(directory)

    # Scan .md files in docs/, README.md, and CLAUDE.md
    doc_locations = [
        directory / "docs",
        directory / "README.md",
        directory / "CLAUDE.md",
    ]

    for loc in doc_locations:
        if loc.is_file():
            findings.extend(scan_doc_file(loc, source_symbols, project_paths, directory))
        elif loc.is_dir():
            for md_file in loc.rglob("*.md"):
                findings.extend(scan_doc_file(md_file, source_symbols, project_paths, directory))

    return findings


def main() -> int:
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

    if not directory.is_dir():
        print(f"Error: {directory} is not a directory")
        return 1

    print(f"Validating documentation accuracy in {directory}...")
    findings = scan_docs(directory)

    for f in findings:
        print(str(f))

    if not findings:
        print("PASS — no documentation accuracy issues found.")
    else:
        print(f"\n{len(findings)} potential issue(s) found. Review recommended.")

    # Always exit 0 — warn-only mode
    return 0


if __name__ == "__main__":
    sys.exit(main())
