#!/usr/bin/env bash
# Deterministic contract checks for mk:resolving-merge-conflicts.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/resolving-merge-conflicts/SKILL.md"
PASS=0; FAIL=0
assert_match() {
  local name="$1" pattern="$2" file="$3"
  if grep -Eiq -- "$pattern" "$file"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$name"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$name"; fi
}

assert_match "finishing the merge/rebase requires explicit user go-ahead" 'requires explicit user go-ahead' "$SKILL"
assert_match "scope: NOT for the full mk:ship base-branch-merge pipeline" 'NOT for the full ship pipeline that merges the base branch first \(see mk:ship\)' "$SKILL"
assert_match "resolution must not invent new behaviour" 'Do not invent new behaviour' "$SKILL"
assert_match "ask first before running completion commands" 'Ask first.*present the resolved files and check results' "$SKILL"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
