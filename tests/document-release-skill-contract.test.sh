#!/usr/bin/env bash
# Deterministic contract checks for mk:document-release — post-ship documentation sync.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/document-release/SKILL.md"
PASS=0; FAIL=0
assert_match() {
  local name="$1" pattern="$2" file="$3"
  if grep -Eiq -- "$pattern" "$file"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$name"
  else FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$name"; fi
}

assert_match "post-ship timing" 'Post-ship documentation update' "$SKILL"
assert_match "runs after mk:ship prepares change, before PR merges" 'Runs after .*mk:ship.* prepares the change and before the PR merges' "$SKILL"
assert_match "updates README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md" 'updates README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md' "$SKILL"
assert_match "NOT for initial doc creation (routes to mk:docs-init)" 'NOT for initial doc creation \(see mk:docs-init\)' "$SKILL"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
