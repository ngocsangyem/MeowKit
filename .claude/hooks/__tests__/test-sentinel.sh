#!/bin/bash
# test-sentinel.sh — Integration test for the safety/phase-zero sentinel pipeline.
#
# State model: single append-only JSONL log at
# `session-state/session-sentinels.jsonl`. One line per Stop event with
# {session_id, safety, phase_zero, ts}. Reader matches on session_id.
#
# Covers:
#   1. Turn 1 (no log) — handler emits NO marker.
#   2. Turn 2 (line present for current session) — handler emits both markers.
#   3. Partial flags (safety=true, phase_zero=false) — only safety marker.
#   4. New session — log contains lines for OTHER session ids only → no marker.
#   5. MEOWKIT_SKIP_SAFETY_SENTINEL=off — handler emits nothing even when log
#      contains a matching entry.
#   6. Empty session_id — handler emits nothing.
#   7. Corrupt JSONL line — handler skips it and still finds the good line.
#
# Run: bash .claude/hooks/__tests__/test-sentinel.sh
# Exit 0 on PASS, 1 on FAIL.

set -u
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 1

HANDLER=".claude/hooks/handlers/safety-sentinel-inject.cjs"
STATE_DIR="session-state"
LOG_FILE="$STATE_DIR/session-sentinels.jsonl"
PASS=0
FAIL=0

ok()  { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

run_handler() {
  local sid="$1"
  local skip="${2:-on}"
  CLAUDE_PROJECT_DIR="$(pwd)" \
  MEOWKIT_SKIP_SAFETY_SENTINEL="$skip" \
  node -e "
    const h = require('./${HANDLER}');
    h({ session_id: '${sid}' }).then(out => { process.stdout.write(out || ''); });
  " 2>/dev/null
}

write_log_line() {
  # write_log_line <session_id> <safety:true|false> <phase_zero:true|false>
  printf '{"session_id":"%s","safety":%s,"phase_zero":%s,"ts":"2026-05-16T00:00:00Z"}\n' \
    "$1" "$2" "$3" >> "$LOG_FILE"
}

cleanup() { : > "$LOG_FILE" 2>/dev/null; }
mkdir -p "$STATE_DIR" 2>/dev/null
: > "$LOG_FILE"

echo "=== test-sentinel.sh ==="

# ─── Test 1: Turn 1 — empty log ─────────────────────────────────────
cleanup
out=$(run_handler "test-sess-1")
if [ -z "$out" ]; then
  ok "Turn 1: empty log → handler emits empty"
else
  bad "Turn 1: handler emitted output: '$out'"
fi

# ─── Test 2: Turn 2 — both flags true ───────────────────────────────
cleanup
write_log_line "test-sess-2" "true" "true"
out=$(run_handler "test-sess-2")
if echo "$out" | grep -q "Safety baseline: verified (cached, session test-sess-2)" \
   && echo "$out" | grep -q "Phase-zero rules: verified (cached, session test-sess-2)"; then
  ok "Turn 2: both flags → handler emits both markers"
else
  bad "Turn 2: expected both markers, got: '$out'"
fi

# ─── Test 3: Partial (safety only) ──────────────────────────────────
cleanup
write_log_line "test-sess-3" "true" "false"
out=$(run_handler "test-sess-3")
if echo "$out" | grep -q "Safety baseline: verified" \
   && ! echo "$out" | grep -q "Phase-zero rules: verified"; then
  ok "Partial flags: only safety marker emitted"
else
  bad "Partial flags: expected only safety marker, got: '$out'"
fi

# ─── Test 4: New session — log contains other session id ───────────
cleanup
write_log_line "test-sess-OLD" "true" "true"
out=$(run_handler "test-sess-NEW")
if [ -z "$out" ]; then
  ok "New session: log has only other ids → no marker"
else
  bad "New session: handler emitted markers for wrong session: '$out'"
fi

# ─── Test 5: MEOWKIT_SKIP_SAFETY_SENTINEL=off bypass ───────────────
cleanup
write_log_line "test-sess-5" "true" "true"
out=$(run_handler "test-sess-5" "off")
if [ -z "$out" ]; then
  ok "Env-var bypass: =off suppresses markers"
else
  bad "Env-var bypass: handler emitted markers despite =off: '$out'"
fi

# ─── Test 6: Empty session_id ──────────────────────────────────────
out=$(run_handler "")
if [ -z "$out" ]; then
  ok "Empty session_id: handler emits nothing"
else
  bad "Empty session_id: handler emitted output: '$out'"
fi

# ─── Test 7: Corrupt JSONL line ignored ────────────────────────────
cleanup
echo "this is not json" >> "$LOG_FILE"
write_log_line "test-sess-7" "true" "true"
out=$(run_handler "test-sess-7")
if echo "$out" | grep -q "session test-sess-7"; then
  ok "Corrupt line skipped, valid line below still matched"
else
  bad "Corrupt line: expected match below, got: '$out'"
fi

# ─── Test 8: Latest-line-wins for repeated session_id ──────────────
cleanup
write_log_line "test-sess-8" "false" "false"
write_log_line "test-sess-8" "true" "true"
out=$(run_handler "test-sess-8")
if echo "$out" | grep -q "Safety baseline: verified" \
   && echo "$out" | grep -q "Phase-zero rules: verified"; then
  ok "Multiple entries: latest line wins"
else
  bad "Multiple entries: expected latest=true, got: '$out'"
fi

# Final cleanup
cleanup

echo "=== Result: ${PASS} passed, ${FAIL} failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
