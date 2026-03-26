#!/bin/sh
# run-playwright.sh — Execute Playwright test file and report result
# Usage: run-playwright.sh <test-file.spec.ts>
# Exit: 0 = all tests passed, 1 = failures detected

TEST_FILE="$1"

if [ -z "$TEST_FILE" ]; then
  echo "Usage: run-playwright.sh <test-file.spec.ts>"
  exit 1
fi

if [ ! -f "$TEST_FILE" ]; then
  echo "Error: Test file not found: $TEST_FILE"
  exit 1
fi

# Check Playwright is installed
if ! npx playwright --version >/dev/null 2>&1; then
  echo "Error: Playwright not installed."
  echo "Fix: pnpm add -D @playwright/test && npx playwright install"
  exit 1
fi

echo "Running: $TEST_FILE"
npx playwright test "$TEST_FILE" --reporter=line 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "PASS — all tests in $TEST_FILE passed"
else
  echo "FAIL — test failures detected in $TEST_FILE"
fi

exit $EXIT_CODE
