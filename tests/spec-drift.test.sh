#!/usr/bin/env bash
# spec-drift.test.sh — regression gate for Phase 4 + Phase 5 spec rewrites.
#
# Three checks:
#   1. (Phase 4) No agent/skill/command file contains ##pattern: / ##decision: /
#      ##note: as an agent-output instruction. Exclusions: capture-architecture.md,
#      memory-system.md, CLAUDE.md, lines marked user-typed / user-only /
#      keyboard shortcut / human-only / user keyboard.
#   2. (Phase 5) No agent/skill/command file writes to patterns.json or
#      lessons.md (the v2.4.1 deprecated/archived stubs). Exclusions: lines
#      explicitly marked deprecated / archived / tombstone / stub / removed /
#      "do not" / "not write" / mentions of the v2.4.1 split files in the same
#      line (review-patterns.json contains "patterns.json" as a substring).
#   3. (Phase 5 — analyst-specific) `analyst.md` does not reference
#      patterns.json or lessons.md as a write target.
#
# Exit 0 on clean; exit 1 with the offending lines on any hit.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PASS=0
FAIL=0
FAILED_NAMES=()

assert_zero() {
  local name="$1" output="$2"
  if [ -z "$output" ]; then
    PASS=$((PASS+1))
    printf "  ok   %s\n" "$name"
  else
    FAIL=$((FAIL+1))
    FAILED_NAMES+=("$name")
    printf "  FAIL %s\n      hits:\n%s\n" "$name" "$(printf '%s' "$output" | sed 's/^/        /')"
  fi
}

# ---------- Check 1: Phase 4 — no agent-API ##prefix instructions ----------
P4_HITS="$(
  grep -rn '##pattern\|##decision\|##note' \
    "$ROOT/.claude/agents/" \
    "$ROOT/.claude/skills/" \
    "$ROOT/.claude/commands/" 2>/dev/null \
  | grep -v 'capture-architecture\.md' \
  | grep -v 'memory-system\.md' \
  | grep -v 'CLAUDE\.md' \
  | grep -v 'user-typed\|user-only\|keyboard shortcut\|human-only\|user keyboard' \
  || true
)"
assert_zero "Phase 4 — no residual ##prefix agent-API instructions" "$P4_HITS"

# ---------- Check 2: Phase 5 — no writes to patterns.json / lessons.md ----------
P5_HITS="$(
  grep -rn 'patterns\.json\|lessons\.md' \
    "$ROOT/.claude/agents/" \
    "$ROOT/.claude/skills/" \
    "$ROOT/.claude/commands/" 2>/dev/null \
  | grep -iE 'write|append|update|edit' \
  | grep -v 'deprecated\|archived\|tombstone\|stub\|removed\|do not\|DO NOT\|not write\|NOT write' \
  | grep -v 'review-patterns\|fixes\.\|architecture-decisions' \
  || true
)"
assert_zero "Phase 5 — no residual patterns.json/lessons.md write references" "$P5_HITS"

# ---------- Check 3: analyst.md does not write to deprecated stubs ----------
ANALYST="$ROOT/.claude/agents/analyst.md"
if [ -f "$ANALYST" ]; then
  A_HITS="$(
    grep -nE 'patterns\.json|lessons\.md' "$ANALYST" \
    | grep -iE 'write|append|update|edit|extract.*into|maintain' \
    | grep -v 'deprecated\|archived\|stub\|do NOT\|do not\|NOT write\|review-patterns\|fixes\.\|architecture-decisions' \
    || true
  )"
else
  A_HITS="analyst.md not found"
fi
assert_zero "analyst.md — does not target patterns.json/lessons.md as write target" "$A_HITS"

echo
echo "------ summary ------"
echo "passed: $PASS"
echo "failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "failures:"
  for n in "${FAILED_NAMES[@]}"; do
    echo "  - $n"
  done
  exit 1
fi
exit 0
