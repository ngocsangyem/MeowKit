#!/usr/bin/env python3
"""Focused security scanner — scans only files changed since last commit.

Usage: python security-scan.py [directory]
Falls back to scanning all files if not in a git repo.
Requirements: Python 3.9+, no external dependencies.
"""

import subprocess
import sys
from pathlib import Path

# Import shared logic from validate.py
# When run standalone, add parent to path
sys.path.insert(0, str(Path(__file__).parent))
from validate import EXTENSION_CHECKERS, Finding, scan_directory


def get_changed_files(directory: Path) -> list[Path] | None:
    """Get files changed since last commit via git diff."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            capture_output=True,
            text=True,
            cwd=directory,
        )
        if result.returncode != 0:
            # Also try for untracked files
            pass

        changed = result.stdout.strip().splitlines() if result.stdout.strip() else []

        # Also include untracked files
        untracked_result = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard"],
            capture_output=True,
            text=True,
            cwd=directory,
        )
        if untracked_result.returncode == 0 and untracked_result.stdout.strip():
            changed.extend(untracked_result.stdout.strip().splitlines())

        # Also include staged changes
        staged_result = subprocess.run(
            ["git", "diff", "--name-only", "--cached"],
            capture_output=True,
            text=True,
            cwd=directory,
        )
        if staged_result.returncode == 0 and staged_result.stdout.strip():
            changed.extend(staged_result.stdout.strip().splitlines())

        # Deduplicate
        seen = set()
        unique = []
        for f in changed:
            if f not in seen:
                seen.add(f)
                unique.append(f)

        return [directory / f for f in unique]

    except FileNotFoundError:
        # git not available
        return None


def scan_files(files: list[Path]) -> list[Finding]:
    """Scan a specific list of files."""
    all_findings: list[Finding] = []

    for filepath in files:
        if not filepath.is_file():
            continue

        ext = filepath.suffix
        checkers = EXTENSION_CHECKERS.get(ext)
        if not checkers:
            continue

        try:
            content = filepath.read_text(encoding="utf-8", errors="ignore")
        except (OSError, PermissionError):
            continue

        for checker in checkers:
            all_findings.extend(checker(filepath, content))

    return all_findings


def main() -> int:
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

    if not directory.is_dir():
        print(f"Error: {directory} is not a directory")
        return 1

    changed_files = get_changed_files(directory)

    if changed_files is not None:
        print(f"Scanning {len(changed_files)} changed file(s)...")
        findings = scan_files(changed_files)
        scanned_count = len([f for f in changed_files if f.suffix in EXTENSION_CHECKERS])
    else:
        print("No git repo detected — falling back to full scan.")
        findings = scan_directory(directory)
        scanned_count = sum(
            1 for _ in directory.rglob("*")
            if _.suffix in EXTENSION_CHECKERS
            and not any(
                p.startswith(".") or p in ("node_modules", "dist", "build", "__pycache__", ".build")
                for p in _.parts
            )
        )

    blocks = [f for f in findings if f.severity == "BLOCK"]
    warns = [f for f in findings if f.severity == "WARN"]

    for f in findings:
        print(f"{f.severity} — {f.description} at line {f.line} in {f.file}")

    if not findings:
        print("PASS — no security issues found.")

    print(f"\n{scanned_count} files scanned, {len(findings)} issues found ({len(blocks)} BLOCK, {len(warns)} WARN)")

    return 1 if blocks else 0


if __name__ == "__main__":
    sys.exit(main())
