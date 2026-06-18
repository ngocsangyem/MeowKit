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
#   8. Latest-line-wins for a repeated session_id.
#   9. PreCompact re-arm invalidates a prior verification; a fresh verification
#      after the re-arm restores the cached-skip marker.
#  10. Same-ts tie between verification and re-arm — file position decides.
#  11. PreCompact handler edge cases — empty session id / missing file → exit 0,
#      no spurious write.
#
# Run: bash .claude/hooks/__tests__/test-sentinel.sh
# Exit 0 on PASS, 1 on FAIL.

set -u
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 1

HANDLER=".claude/hooks/handlers/safety-sentinel-inject.cjs"
PROBE=".claude/hooks/precompact-probe.sh"
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
  # write_log_line <session_id> <safety:true|false> <phase_zero:true|false> [ts]
  printf '{"session_id":"%s","safety":%s,"phase_zero":%s,"ts":"%s"}\n' \
    "$1" "$2" "$3" "${4:-2026-05-16T00:00:00Z}" >> "$LOG_FILE"
}

write_rearm_line() {
  # write_rearm_line <session_id> [ts]  — synthesize a re-arm marker directly
  printf '{"session_id":"%s","event":"precompact_rearm","ts":"%s"}\n' \
    "$1" "${2:-2026-05-16T00:00:00Z}" >> "$LOG_FILE"
}

run_precompact() {
  # Invoke the real PreCompact hook with synthesized stdin (same pattern as the
  # host runtime — JSON on stdin), so the producer side is exercised end-to-end.
  local sid="$1"
  printf '{"session_id":"%s","hook_event_name":"PreCompact"}' "$sid" \
    | CLAUDE_PROJECT_DIR="$(pwd)" bash "$PROBE" 2>/dev/null
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

# ─── Test 9: PreCompact re-arm invalidates, fresh verification restores ─────
cleanup
# Baseline: a verification line → markers emitted (baseline intact before re-arm).
write_log_line "test-sess-9" "true" "true"
out=$(run_handler "test-sess-9")
if echo "$out" | grep -q "Safety baseline: verified" \
   && echo "$out" | grep -q "Phase-zero rules: verified"; then
  ok "Re-arm: baseline markers emitted before PreCompact"
else
  bad "Re-arm: expected baseline markers, got: '$out'"
fi
# Invoke the real PreCompact hook → it must append a precompact_rearm line.
run_precompact "test-sess-9"
if grep -q '"session_id":"test-sess-9","event":"precompact_rearm"' "$LOG_FILE"; then
  ok "Re-arm: PreCompact hook appended a precompact_rearm line"
else
  bad "Re-arm: no precompact_rearm line found after hook invocation"
fi
# Reader must now withhold markers — the verification pre-dates the re-arm.
out=$(run_handler "test-sess-9")
if [ -z "$out" ]; then
  ok "Re-arm: verification older than re-arm → markers suppressed"
else
  bad "Re-arm: expected suppression, got: '$out'"
fi
# A fresh verification (the re-read turn's Stop) post-dates the re-arm → restored.
write_log_line "test-sess-9" "true" "true"
out=$(run_handler "test-sess-9")
if echo "$out" | grep -q "Safety baseline: verified" \
   && echo "$out" | grep -q "Phase-zero rules: verified"; then
  ok "Re-arm: verification after re-arm → markers restored"
else
  bad "Re-arm: expected restored markers, got: '$out'"
fi

# ─── Test 10: Same-ts tie — file position decides ──────────────────────────
cleanup
# Equal ts on verification then re-arm: re-arm has the later position → suppress.
write_log_line  "test-sess-10" "true" "true" "2026-05-16T12:00:00Z"
write_rearm_line "test-sess-10"               "2026-05-16T12:00:00Z"
out=$(run_handler "test-sess-10")
if [ -z "$out" ]; then
  ok "Same-ts tie: later-position re-arm suppresses markers"
else
  bad "Same-ts tie: expected suppression, got: '$out'"
fi
# Equal ts again, verification now last → later position wins → markers emitted.
write_log_line "test-sess-10" "true" "true" "2026-05-16T12:00:00Z"
out=$(run_handler "test-sess-10")
if echo "$out" | grep -q "Safety baseline: verified"; then
  ok "Same-ts tie: later-position verification restores markers"
else
  bad "Same-ts tie: expected markers, got: '$out'"
fi

# ─── Test 11: PreCompact handler edge cases ────────────────────────────────
# Empty session id → exit 0, no line appended.
cleanup
run_precompact ""; rc=$?
if [ "$rc" -eq 0 ] && [ ! -s "$LOG_FILE" ]; then
  ok "Edge: empty session id → exit 0, no spurious write"
else
  bad "Edge: empty session id rc=$rc, log non-empty? ($(wc -l < "$LOG_FILE") lines)"
fi
# Missing log file → hook creates state dir and writes cleanly, exit 0.
rm -f "$LOG_FILE"
run_precompact "test-sess-11"; rc=$?
if [ "$rc" -eq 0 ] && grep -q '"session_id":"test-sess-11","event":"precompact_rearm"' "$LOG_FILE"; then
  ok "Edge: missing file → hook recreates and re-arms, exit 0"
else
  bad "Edge: missing-file case rc=$rc, line present? ($(cat "$LOG_FILE" 2>/dev/null))"
fi

# Final cleanup
cleanup

echo "=== Result: ${PASS} passed, ${FAIL} failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
