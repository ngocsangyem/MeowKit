#!/bin/sh
# test-scripts.sh — Test both gate validation scripts
# Usage: sh test-scripts.sh
# Runs from the scripts/ directory

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

run_test() {
  TEST_NAME="$1"
  EXPECTED_EXIT="$2"
  shift 2

  if OUTPUT=$("$@" 2>&1); then
    ACTUAL_EXIT=0
  else
    ACTUAL_EXIT=$?
  fi

  if [ "$ACTUAL_EXIT" -eq "$EXPECTED_EXIT" ]; then
    echo "PASS: $TEST_NAME → $OUTPUT"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $TEST_NAME — expected exit $EXPECTED_EXIT, got $ACTUAL_EXIT → $OUTPUT"
    FAIL=$((FAIL + 1))
  fi
}

# Create temp files for testing
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# --- Gate 1 Tests ---

# Test 1: Valid plan with all sections
cat > "$TMPDIR/valid-plan.md" << 'PLAN'
# Plan: Test Feature
## Problem
Users cannot login.
## Success Criteria
- [ ] Login works
- [ ] Tests pass
## Technical Approach
Implement OAuth2 flow.
## Phases
| # | Phase |
|---|-------|
| 1 | Auth  |
PLAN
run_test "Gate 1: valid plan" 0 sh "$SCRIPT_DIR/validate-gate-1.sh" "$TMPDIR/valid-plan.md"

# Test 2: Plan missing success criteria
cat > "$TMPDIR/incomplete-plan.md" << 'PLAN'
# Plan: Incomplete
## Problem
Something is broken.
PLAN
run_test "Gate 1: missing sections" 1 sh "$SCRIPT_DIR/validate-gate-1.sh" "$TMPDIR/incomplete-plan.md"

# Test 3: Non-existent file
run_test "Gate 1: file not found" 1 sh "$SCRIPT_DIR/validate-gate-1.sh" "$TMPDIR/nonexistent.md"

# --- Gate 2 Tests ---

# Test 4: Clean review (no critical, no FAIL)
run_test "Gate 2: clean review" 0 sh -c "printf 'Score: 9.2/10\nCritical (0): []\nWarnings (1): [minor issue]\n' | sh '$SCRIPT_DIR/validate-gate-2.sh' -"

# Test 5: Review with critical issues
run_test "Gate 2: critical issues" 1 sh -c "printf 'Score: 6/10\nCritical (2): [XSS, SQL injection]\nSecurity: FAIL\n' | sh '$SCRIPT_DIR/validate-gate-2.sh' -"

# Test 6: Review with FAIL dimension
run_test "Gate 2: FAIL dimension" 1 sh -c "printf 'Score: 7/10\nFAIL: architecture violated\n' | sh '$SCRIPT_DIR/validate-gate-2.sh' -"

# Test 8: Incidental "failed" in prose should NOT trigger block
run_test "Gate 2: incidental 'failed' in prose" 0 sh -c "printf 'Score: 8.5/10\nCritical (0): []\nThis approach failed to consider edge cases but was corrected.\n' | sh '$SCRIPT_DIR/validate-gate-2.sh' -"

# Test 7: File not found
run_test "Gate 2: file not found" 1 sh "$SCRIPT_DIR/validate-gate-2.sh" "$TMPDIR/nonexistent-verdict.md"

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed out of $((PASS + FAIL)) tests"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All tests passed"
exit 0
