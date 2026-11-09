#!/usr/bin/env bash
# Deterministic contract checks for the declarative mk:fix workflow.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/fix/SKILL.md"
TEST_WORKFLOW="$ROOT/.claude/skills/fix/references/workflow-test.md"
REVIEW_CYCLE="$ROOT/.claude/skills/fix/references/review-cycle.md"
INVESTIGATE="$ROOT/.claude/skills/investigate/SKILL.md"
BUILD_FIX="$ROOT/.claude/skills/build-fix/SKILL.md"

PASS=0
FAIL=0

assert_match() {
  local name="$1" pattern="$2" file="$3"
  if grep -Eiq -- "$pattern" "$file"; then
    PASS=$((PASS + 1)); printf '  ok   %s\n' "$name"
  else
    FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$name"
  fi
}

# Routing lives in the description line the host lists, so each boundary is
# checked there, on whichever side of the pair carries it.
assert_match "runtime bugs route to fix" '^description:.*remediation of bugs' "$SKILL"
assert_match "investigation-only work routes to investigate" '^description:.*NOT for mk:investigate' "$SKILL"
assert_match "investigate hands fixes back to fix" '^description:.*not an edit.*NOT for mk:fix' "$INVESTIGATE"
assert_match "compile errors route to build-fix" '^description:.*compile.*NOT for mk:fix' "$BUILD_FIX"
assert_match "flaky failures require repeated verification" 'Run test 5x to confirm stability' "$TEST_WORKFLOW"
assert_match "security-sensitive fixes can force regression-first TDD" '--tdd.*security-sensitive' "$SKILL"
assert_match "high-risk fixes require human approval" 'risk\.requiresHumanApproval = true' "$SKILL"
assert_match "finalization asks before commit" 'Ask user about commit' "$SKILL"
assert_match "ship boundary requires user approval" 'PRESENT for user approval.*do NOT self-approve.*ship' "$REVIEW_CYCLE"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
