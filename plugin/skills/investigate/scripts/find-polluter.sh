#!/bin/bash
# Bisection script to find which test creates unwanted files/state
# Usage: ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh '.git' 'src/**/*.test.ts'

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 '.git' 'src/**/*.test.ts'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

# Auto-detect test runner. Prefer pnpm > yarn > bun > npm based on lockfile presence.
if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
  TEST_RUNNER=(pnpm test)
elif [ -f "yarn.lock" ] && command -v yarn >/dev/null 2>&1; then
  TEST_RUNNER=(yarn test)
elif [ -f "bun.lockb" ] && command -v bun >/dev/null 2>&1; then
  TEST_RUNNER=(bun test)
elif [ -f "package.json" ] && command -v npm >/dev/null 2>&1; then
  TEST_RUNNER=(npm test --)
else
  echo "No recognized test runner (npm/yarn/pnpm/bun) or package.json — aborting."
  exit 2
fi

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo "Test runner: ${TEST_RUNNER[*]}"
echo ""

# Get list of test files (quote the pattern to prevent shell expansion from breaking multi-segment patterns)
TEST_FILES=$(find . -path "$TEST_PATTERN" | sort)
TOTAL=$(printf '%s\n' "$TEST_FILES" | grep -c . || echo 0)

echo "Found $TOTAL test files"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo "No test files matched '$TEST_PATTERN'. Check the glob syntax."
  exit 1
fi

COUNT=0
while IFS= read -r TEST_FILE; do
  [ -z "$TEST_FILE" ] && continue
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test — pass file path as a single argument
  "${TEST_RUNNER[@]}" "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  ${TEST_RUNNER[*]} $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done <<< "$TEST_FILES"

echo ""
echo "✅ No polluter found - all tests clean!"
exit 0
