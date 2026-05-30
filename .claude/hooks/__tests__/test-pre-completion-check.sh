#!/bin/bash
# test-pre-completion-check.sh — Regression tests for pre-completion-check.sh
#
# Run:
#   bash .claude/hooks/__tests__/test-pre-completion-check.sh
#
# Cases:
#   1) Plan-only session, no verification-required marker -> allow Stop
#   2) verification-required marker + active plan + no evidence -> block
#   3) verification-required marker + active plan + eval evidence -> allow Stop
#   4) active-plan.json path resolves slug correctly

set -u
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 1

HOOK=".claude/hooks/pre-completion-check.sh"
PASS=0
FAIL=0

ok()  { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

reset_env() {
  rm -rf session-state 2>/dev/null || true
  mkdir -p session-state tasks/plans tasks/reviews tasks/contracts .claude/memory
  find tasks/reviews -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true
  find tasks/contracts -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true
  find .claude/memory -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true
}

run_hook() {
  printf '{"session_id":"test"}' | CLAUDE_PROJECT_DIR="$(pwd)" MEOWKIT_HARNESS_MODE=FULL bash "$HOOK" 2>/dev/null
}

echo "=== test-pre-completion-check.sh ==="

# 1) Plan-only session: no marker -> pass
reset_env
mkdir -p tasks/plans/260530-1234-demo
out=$(run_hook)
if [ -z "$out" ]; then
  ok "Plan-only session without verification-required marker allows Stop"
else
  bad "Expected no block output for plan-only session, got: $out"
fi

# 2) Marker + no evidence -> block
reset_env
mkdir -p tasks/plans/260530-1234-demo
cat > session-state/active-plan.json <<'JSON'
{"path":"tasks/plans/260530-1234-demo","slug":"260530-1234-demo"}
JSON
cat > session-state/verification-required.json <<'JSON'
{"required":true,"slug":"260530-1234-demo","source":"mk:cook"}
JSON
out=$(run_hook)
if echo "$out" | grep -q '"decision":"block"' && echo "$out" | grep -q "260530-1234-demo"; then
  ok "verification-required marker with no evidence blocks Stop"
else
  bad "Expected block JSON for missing evidence, got: $out"
fi

# 3) Marker + evidence -> pass
reset_env
mkdir -p tasks/plans/260530-1234-demo
cat > session-state/active-plan.json <<'JSON'
{"path":"tasks/plans/260530-1234-demo","slug":"260530-1234-demo"}
JSON
cat > session-state/verification-required.json <<'JSON'
{"required":true,"slug":"260530-1234-demo","source":"mk:cook"}
JSON
cat > tasks/reviews/260530-demo-evalverdict.md <<'MD'
---
status: pass
---
MD
out=$(run_hook)
if [ -z "$out" ]; then
  ok "verification evidence present allows Stop"
else
  bad "Expected pass when evidence exists, got: $out"
fi

# 4) active-plan path-only still resolves slug
reset_env
mkdir -p tasks/plans/260530-1234-demo
cat > session-state/active-plan.json <<'JSON'
{"path":"/tmp/x/tasks/plans/260530-1234-demo"}
JSON
cat > session-state/verification-required.json <<'JSON'
{"required":true}
JSON
out=$(run_hook)
if echo "$out" | grep -q '"decision":"block"' && echo "$out" | grep -q "260530-1234-demo"; then
  ok "active-plan.json path resolves slug for verification lookup"
else
  bad "Expected slug resolution from path, got: $out"
fi

echo "=== Result: ${PASS} passed, ${FAIL} failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
