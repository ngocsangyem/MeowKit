#!/usr/bin/env bash
# Deterministic contract checks for mk:validate-plan — 8-dimension plan validation.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/validate-plan/SKILL.md"
PASS=0; FAIL=0
assert_match() {
  local name="$1" pattern="$2" file="$3"
  if grep -Eiq -- "$pattern" "$file"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$name"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$name"; fi
}

assert_match "validates plan against 8 dimensions" 'Validates an approved plan against 8 dimensions' "$SKILL"
assert_match "runs after Gate 1 approval and before Phase 2" 'after Gate 1 plan approval and before Phase 2' "$SKILL"
assert_match "NOT for creating plans (routes to mk:plan-creator)" 'NOT for creating plans \(see mk:plan-creator\)' "$SKILL"
assert_match "read-only analysis: does NOT modify plan files" 'Does NOT modify plan files.*read-only analysis' "$SKILL"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
