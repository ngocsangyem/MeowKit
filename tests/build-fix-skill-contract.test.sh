#!/usr/bin/env bash
# Deterministic contract checks for mk:build-fix — build/compile error triage.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/build-fix/SKILL.md"
PASS=0; FAIL=0
assert_match() {
  local name="$1" pattern="$2" file="$3"
  if grep -Eiq -- "$pattern" "$file"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$name"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$name"; fi
}

assert_match "build/compile-error scope" 'Build error triage: detect language, load fix patterns, auto-retry' "$SKILL"
assert_match "chains into mk:verify to confirm green build" 'chains into .mk:verify. to confirm the build is green' "$SKILL"
assert_match "NOT for runtime errors / architectural debugging disambiguation" 'NOT for runtime errors \(see mk:fix\); NOT for architectural debugging \(see mk:investigate\)' "$SKILL"
assert_match "self-healing capped at 3 attempts before escalation" 'max 3 self-healing attempts, then escalate' "$SKILL"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
