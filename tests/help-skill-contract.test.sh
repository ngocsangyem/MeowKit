#!/usr/bin/env bash
# help-skill-contract.test.sh — grep-asserts the documented contract of the mk:help skill.
#
# The ranked next-steps feature is skill prose (no scanner script), so behavior isn't
# directly CI-testable — but the SKILL.md CONTRACT is. This guards the load-bearing
# surface: the four scan-source paths, the BLOCKED verdict enum (never a top-level FAIL
# decision), the absent-file skip behavior, and the /mk:help command wrapper.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/.claude/skills/help/SKILL.md"
WRAPPER="$ROOT/.claude/commands/mk/help.md"

PASS=0; FAIL=0; FAILED_NAMES=()
assert() {
  local name="$1" cond="$2"
  if [ "$cond" = "1" ]; then PASS=$((PASS+1)); printf "  ok   %s\n" "$name"
  else FAIL=$((FAIL+1)); FAILED_NAMES+=("$name"); printf "  FAIL %s\n" "$name"; fi
}
has() { grep -qF -- "$1" "$SKILL" && echo 1 || echo 0; }

[ -f "$SKILL" ] || { echo "FATAL: $SKILL not found"; exit 1; }

# Four scan-source paths named.
assert "names checkpoint-latest.json" "$(has 'checkpoint-latest.json')"
assert "names budget-state.json" "$(has 'budget-state.json')"
assert "names detected-model.json" "$(has 'detected-model.json')"
assert "names *-verdict.json" "$(has '-verdict.json')"

# Roadmap source named.
assert "names development-roadmap.md" "$(has 'development-roadmap.md')"

# BLOCKED enum present; no top-level FAIL decision.
assert "uses BLOCKED verdict enum" "$(grep -qF 'BLOCKED' "$SKILL" && echo 1 || echo 0)"
if grep -nE 'decision[^a-zA-Z].{0,12}"FAIL"' "$SKILL" >/dev/null 2>&1; then
  assert "no top-level FAIL decision" 0
else
  assert "no top-level FAIL decision" 1
fi

# Absent-file skip behavior documented.
if grep -qiE 'absent|skip silently|skip; ' "$SKILL"; then assert "documents absent-file skip behavior" 1; else assert "documents absent-file skip behavior" 0; fi

# Read-only / forward-looking split documented (no /mk:status duplication).
assert "documents forward-looking vs /mk:status split" "$(grep -qF '/mk:status' "$SKILL" && echo 1 || echo 0)"

# /mk:help command wrapper exists and points to mk:help.
if [ -f "$WRAPPER" ] && grep -qF 'mk:help' "$WRAPPER"; then assert "/mk:help wrapper exists and points to mk:help" 1; else assert "/mk:help wrapper exists and points to mk:help" 0; fi

# SKILL.md stays under the 500-line cap (skill-authoring Rule 3).
LINES=$(wc -l < "$SKILL" | tr -d ' ')
[ "$LINES" -lt 500 ] && assert "SKILL.md < 500 lines ($LINES)" 1 || assert "SKILL.md < 500 lines ($LINES)" 0

echo
echo "------ summary ------"
echo "passed: $PASS"
echo "failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "failures:"; for n in "${FAILED_NAMES[@]}"; do echo "  - $n"; done
  exit 1
fi
exit 0
