#!/usr/bin/env bash
# Deterministic contract checks for mk:workflow-orchestrator — two-gate, 7-phase auto-invoked flow.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/workflow-orchestrator/SKILL.md"
WORKFLOW_PHASES="$ROOT/.claude/skills/workflow-orchestrator/references/workflow-phases.md"
PASS=0; FAIL=0
assert_match() {
  local name="$1" pattern="$2" file="$3"
  if grep -Eiq -- "$pattern" "$file"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$name"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$name"; fi
}

assert_match "two-gate model: Gate 1 before build, Gate 2 before ship" 'proceed only after Gate 1.*Gate 2 remains human approval' "$SKILL"
assert_match "Phase 3.6 Verify present in canonical phase sequence" '3\.6.*Verify' "$WORKFLOW_PHASES"
assert_match "defers to mk:cook when explicitly invoked (mutual exclusion)" 'do not activate.*.mk:cook. owns the pipeline' "$SKILL"
assert_match "NOT for explicit user-invoked single tasks (see mk:cook)" 'NOT for explicit user-invoked single tasks \(see mk:cook\)' "$SKILL"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
