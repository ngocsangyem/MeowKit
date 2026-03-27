#!/bin/sh
# pre-implement.sh — Blocks implementation if no failing test exists for the current feature.
# Usage: pre-implement.sh <feature-name-or-file-path>

set -e

FEATURE="$1"

if [ -z "$FEATURE" ]; then
  echo "Usage: pre-implement.sh <feature-name-or-file-path>"
  exit 1
fi

# Extract a simple name from a file path if given
FEATURE_NAME=$(basename "$FEATURE" | sed 's/\.[^.]*$//')

echo "Checking for failing tests for: $FEATURE_NAME"

# Search for test files referencing the feature
FOUND_TESTS=""

for dir in __tests__ tests; do
  if [ -d "$dir" ]; then
    matches=$(grep -rl "$FEATURE_NAME" "$dir" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      FOUND_TESTS="$matches"
    fi
  fi
done

# Also search for *.test.ts, *.spec.ts, *.test.swift in current tree
if [ -z "$FOUND_TESTS" ]; then
  matches=$(find . -type f \( -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.swift" -o -name "*.test.js" -o -name "*.spec.js" -o -name "*.test.py" \) -exec grep -l "$FEATURE_NAME" {} + 2>/dev/null || true)
  if [ -n "$matches" ]; then
    FOUND_TESTS="$matches"
  fi
fi

if [ -z "$FOUND_TESTS" ]; then
  echo "BLOCKED: No test file found for [$FEATURE_NAME]. Write failing tests first (Phase 2)."
  exit 1
fi

echo "Found test files referencing $FEATURE_NAME. Running test suite..."

# Detect test runner and run tests
TEST_EXIT=0

if [ -f "package.json" ]; then
  # Check for vitest or jest
  if grep -q '"vitest"' package.json 2>/dev/null; then
    npx vitest run 2>&1 || TEST_EXIT=$?
  elif grep -q '"jest"' package.json 2>/dev/null; then
    npx jest 2>&1 || TEST_EXIT=$?
  elif grep -q '"test"' package.json 2>/dev/null; then
    npm test 2>&1 || TEST_EXIT=$?
  else
    echo "No test runner detected in package.json."
    TEST_EXIT=0
  fi
elif [ -f "Package.swift" ]; then
  swift test 2>&1 || TEST_EXIT=$?
elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "pytest.ini" ]; then
  pytest 2>&1 || TEST_EXIT=$?
else
  echo "No recognized test runner found."
  TEST_EXIT=0
fi

if [ "$TEST_EXIT" -eq 0 ]; then
  echo "BLOCKED: Tests must FAIL before implementation. Your tests are passing — they don't test new behavior yet."
  exit 1
else
  echo "PASS: Failing tests confirmed. Proceeding to implementation."
  exit 0
fi
