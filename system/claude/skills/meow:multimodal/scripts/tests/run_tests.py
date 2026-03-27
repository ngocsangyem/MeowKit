#!/usr/bin/env python3
"""
Test runner for meow:multimodal scripts.

Runs all test_*.py files in this directory.
No external test framework required — uses built-in assertions.
"""

import subprocess
import sys
from pathlib import Path


def main():
    test_dir = Path(__file__).parent
    test_files = sorted(test_dir.glob("test_*.py"))

    if not test_files:
        print("No test files found!")
        sys.exit(1)

    print(f"Running {len(test_files)} test files for meow:multimodal...\n")

    total_passed = 0
    total_failed = 0
    failed_files = []

    for test_file in test_files:
        print(f"{'=' * 60}")
        print(f"Running: {test_file.name}")
        print('=' * 60)

        result = subprocess.run(
            [sys.executable, str(test_file)],
            capture_output=False,
        )

        if result.returncode != 0:
            failed_files.append(test_file.name)

    print(f"\n{'=' * 60}")
    print("All Tests Summary")
    print('=' * 60)
    print(f"Total test files: {len(test_files)}")
    print(f"Passed: {len(test_files) - len(failed_files)}")
    print(f"Failed: {len(failed_files)}")

    if failed_files:
        print("\nFailed tests:")
        for f in failed_files:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("\n✓ All tests passed!")
        sys.exit(0)


if __name__ == '__main__':
    main()
