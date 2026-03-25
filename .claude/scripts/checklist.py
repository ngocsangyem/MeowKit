#!/usr/bin/env python3
"""Pre-ship checklist verification.

Usage: python checklist.py [directory]
Requirements: Python 3.9+, no external dependencies.
"""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from validate import EXTENSION_CHECKERS, scan_directory


def run_cmd(cmd: list[str], cwd: Path | None = None) -> int:
    """Run a command and return exit code."""
    try:
        result = subprocess.run(cmd, capture_output=True, cwd=cwd, timeout=120)
        return result.returncode
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return -1


def check_tests_pass(directory: Path) -> bool:
    """Check 1: All tests pass."""
    pkg = directory / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text())
            if "test" in data.get("scripts", {}):
                return run_cmd(["npm", "test"], cwd=directory) == 0
        except (json.JSONDecodeError, OSError):
            pass

    if (directory / "Package.swift").is_file():
        return run_cmd(["swift", "test"], cwd=directory) == 0

    if (directory / "pyproject.toml").is_file() or (directory / "pytest.ini").is_file():
        return run_cmd(["pytest"], cwd=directory) == 0

    # No test runner found — pass by default
    return True


def check_no_block_issues(directory: Path) -> bool:
    """Check 2: No BLOCK security issues."""
    findings = scan_directory(directory)
    blocks = [f for f in findings if f.severity == "BLOCK"]
    return len(blocks) == 0


def check_lint_passes(directory: Path) -> bool:
    """Check 3: Lint passes (if configured)."""
    pkg = directory / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text())
            if "lint" in data.get("scripts", {}):
                return run_cmd(["npm", "run", "lint"], cwd=directory) == 0
        except (json.JSONDecodeError, OSError):
            pass

    # No linter — pass
    return True


def check_typescript_compiles(directory: Path) -> bool:
    """Check 4: TypeScript compiles (if tsconfig.json exists)."""
    if (directory / "tsconfig.json").is_file():
        return run_cmd(["npx", "tsc", "--noEmit"], cwd=directory) == 0
    return True


def check_no_uncommitted_changes(directory: Path) -> bool:
    """Check 5: No uncommitted changes."""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            cwd=directory,
        )
        if result.returncode != 0:
            return True  # Not a git repo — skip
        return result.stdout.strip() == ""
    except FileNotFoundError:
        return True


def check_plan_approved(directory: Path) -> bool:
    """Check 6: Plan file exists and is marked approved."""
    plans_dir = directory / "tasks" / "plans"
    if not plans_dir.is_dir():
        # Also check .meowkit location
        plans_dir = directory / ".meowkit" / "plans"

    if not plans_dir.is_dir():
        return False

    for plan_file in plans_dir.glob("*.md"):
        content = plan_file.read_text(encoding="utf-8", errors="ignore")
        if "approved" in content.lower() or "status: approved" in content.lower():
            return True

    return False


def check_review_no_fail(directory: Path) -> bool:
    """Check 7: Review verdict exists and has no FAIL dimensions."""
    reviews_dir = directory / "tasks" / "reviews"
    if not reviews_dir.is_dir():
        return False

    review_files = sorted(reviews_dir.glob("*.md"), reverse=True)
    if not review_files:
        return False

    latest = review_files[0]
    content = latest.read_text(encoding="utf-8", errors="ignore")

    # Check for FAIL in review dimensions
    if "FAIL" in content:
        return False

    return True


def main() -> int:
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

    if not directory.is_dir():
        print(f"Error: {directory} is not a directory")
        return 1

    checks = [
        ("All tests pass", check_tests_pass),
        ("No BLOCK security issues", check_no_block_issues),
        ("Lint passes", check_lint_passes),
        ("TypeScript compiles", check_typescript_compiles),
        ("No uncommitted changes", check_no_uncommitted_changes),
        ("Plan file exists and approved", check_plan_approved),
        ("Review verdict has no FAIL", check_review_no_fail),
    ]

    print("=== Pre-Ship Checklist ===\n")

    any_failed = False
    for name, check_fn in checks:
        try:
            passed = check_fn(directory)
        except Exception as e:
            print(f"[FAIL] {name} (error: {e})")
            any_failed = True
            continue

        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {name}")
        if not passed:
            any_failed = True

    print()
    if any_failed:
        print("Checklist FAILED — resolve issues before shipping.")
        return 1
    else:
        print("Checklist PASSED — ready to ship.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
