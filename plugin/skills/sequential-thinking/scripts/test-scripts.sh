#!/bin/sh
# Test suite for sequential-thinking scripts
# POSIX-compatible. Exits 0 if all pass, 1 on first failure.

SCRIPTS_DIR="$(dirname "$0")"
PASS=0
FAIL=0

assert_exit() {
  TEST_NAME="$1"; EXPECTED_EXIT="$2"; shift 2
  "$@" > /dev/null 2>&1
  ACTUAL_EXIT=$?
  if [ "$ACTUAL_EXIT" -eq "$EXPECTED_EXIT" ]; then
    echo "  PASS: $TEST_NAME"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $TEST_NAME (expected exit $EXPECTED_EXIT, got $ACTUAL_EXIT)"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  TEST_NAME="$1"; EXPECTED="$2"; shift 2
  OUTPUT=$("$@" 2>&1)
  if echo "$OUTPUT" | grep -q "$EXPECTED"; then
    echo "  PASS: $TEST_NAME"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $TEST_NAME (expected output containing '$EXPECTED')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== process-thought.js ==="

# Reset first
assert_contains "Reset history" 'success.*true' \
  node "$SCRIPTS_DIR/process-thought.js" --reset

# Test 1: Basic thought
assert_contains "Basic thought" 'success.*true' \
  node "$SCRIPTS_DIR/process-thought.js" --thought "Test analysis" --number 1 --total 3 --next true

# Test 2: Revision
assert_contains "Revision thought" 'success.*true' \
  node "$SCRIPTS_DIR/process-thought.js" --thought "Revised analysis" --number 2 --total 3 --next true --revision 1

# Test 3: Branch
assert_contains "Branch thought" 'success.*true' \
  node "$SCRIPTS_DIR/process-thought.js" --thought "Branch A" --number 3 --total 5 --next true --branch 2 --branchId a

# Test 4: Invalid (empty thought)
assert_exit "Reject empty thought" 1 \
  node "$SCRIPTS_DIR/process-thought.js" --thought "" --number 1 --total 3 --next true

# Test 5: Summary
assert_contains "Summary output" '"totalThoughts"' \
  node "$SCRIPTS_DIR/process-thought.js" --summary

# Test 6: History
assert_contains "History output" '"thoughts"' \
  node "$SCRIPTS_DIR/process-thought.js" --history

# Reset after tests
node "$SCRIPTS_DIR/process-thought.js" --reset > /dev/null 2>&1

echo ""
echo "=== format-thought.js ==="

# Test 7: Box format (default)
assert_contains "Box format" "Thought 1/5" \
  node "$SCRIPTS_DIR/format-thought.js" --thought "Analysis" --number 1 --total 5

# Test 8: Simple format
assert_contains "Simple format" "Thought 1/5:" \
  node "$SCRIPTS_DIR/format-thought.js" --thought "Analysis" --number 1 --total 5 --format simple

# Test 9: Markdown format
assert_contains "Markdown format" "Thought 1/5" \
  node "$SCRIPTS_DIR/format-thought.js" --thought "Analysis" --number 1 --total 5 --format markdown

# Test 10: JSON format
assert_contains "JSON format" 'regular' \
  node "$SCRIPTS_DIR/format-thought.js" --thought "Analysis" --number 1 --total 5 --format json

# Test 11: Revision format
assert_contains "Revision format" "REVISION" \
  node "$SCRIPTS_DIR/format-thought.js" --thought "Revised" --number 2 --total 5 --revision 1

# Test 12: Branch format
assert_contains "Branch format" "BRANCH" \
  node "$SCRIPTS_DIR/format-thought.js" --thought "Alt approach" --number 3 --total 5 --branch 2 --branchId a

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
