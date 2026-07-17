#!/usr/bin/env bash
# Deterministic contract checks for mk:investigate — diagnostic-only investigation.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/investigate/SKILL.md"
PASS=0; FAIL=0
assert_match() {
  local name="$1" pattern="$2" file="$3"
  if grep -Eiq -- "$pattern" "$file"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$name"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$name"; fi
}

assert_match "iron law: no fixes without root cause" 'NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST' "$SKILL"
assert_match "diagnostic-only constraint: never edit source" 'Diagnostic only.*never edit source' "$SKILL"
assert_match "NOT for applying fixes without investigation (routes to mk:fix)" 'NOT for applying fixes without investigation \(see mk:fix\)' "$SKILL"
assert_match "hands off confirmed defects to mk:fix, build failures to mk:build-fix" 'route confirmed defects to `mk:fix`, compile/build failures to `mk:build-fix`' "$SKILL"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
