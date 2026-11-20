#!/bin/sh
# test-scripts.sh — Test cook's workflow contracts
# Usage: sh test-scripts.sh
# Runs from the scripts/ directory

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/SKILL.md"
INTENT_FILE="$(cd "$SCRIPT_DIR/../references" && pwd)/intent-detection.md"
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

# --- Declarative workflow contracts ---

# Cook is a skill specification rather than a profile-selection executable. These
# assertions pin public workflow behavior that is intentionally expressed in SKILL.md.
run_test "Cook: documented profiles" 0 grep -Eiq 'Profiles:.*quick.*standard.*release.*high-assurance' "$SKILL_FILE"
run_test "Cook: explicit flags precede plan paths" 0 sh -c '
  priority_flags=$(grep -n "Priority 1: Explicit flags" "$1" | head -1 | cut -d: -f1)
  priority_plan=$(grep -n "Priority 2: Plan path detection" "$1" | head -1 | cut -d: -f1)
  plan_branch=$(grep -n "IF input matches path pattern" "$1" | head -1 | cut -d: -f1)
  test -n "$priority_flags" && test -n "$priority_plan" && test -n "$plan_branch" || exit 1
  [ "$priority_flags" -lt "$priority_plan" ] && [ "$priority_plan" -lt "$plan_branch" ] || exit 1
  for flag in --fast --parallel --auto --no-test; do
    branch=$(grep -n "IF input contains \"$flag\"" "$1" | head -1 | cut -d: -f1)
    test -n "$branch" && [ "$priority_flags" -lt "$branch" ] && [ "$branch" -lt "$priority_plan" ] || exit 1
  done
' sh "$INTENT_FILE"
run_test "Cook: plan path selects code mode" 0 grep -Eiq 'plan\.md.*phase-\*\.md.*code.*Execute existing plan' "$SKILL_FILE"
run_test "Cook: TDD and no-test conflict blocks" 0 grep -Eiq 'no-test.*tdd.*invalid|tdd.*no-test.*invalid' "$SKILL_FILE"
run_test "Cook: Verify step remains mandatory" 0 grep -Eiq '^## Verify Step \(Mandatory\)' "$SKILL_FILE"
run_test "Cook: ship needs an explicit request" 0 grep -Eiq 'Only after an explicit ship request' "$SKILL_FILE"

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed out of $((PASS + FAIL)) tests"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All tests passed"
exit 0
