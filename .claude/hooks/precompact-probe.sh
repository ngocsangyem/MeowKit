#!/bin/bash
# precompact-probe.sh — PreCompact hook: safety-baseline re-arm + telemetry.
#
# Re-arm: compaction drops the safety-baseline rule TEXT from context but leaves
# the per-session "verified (cached)" sentinel intact, so the next turn would skip
# the re-read and run with no baseline in context. To force a fresh re-read, append
# a recency marker for this session. The inject reader treats any cached-verified
# line OLDER than the latest re-arm marker as stale and withholds the skip marker
# until a genuine re-read writes a newer verification line.
#
# Ordering invariant (correctness depends on it): the host runtime fires PreCompact
# AFTER the current turn's Stop has written its verification line. The Stop hook
# re-writes the verified sentinel UNCONDITIONALLY every turn, so this re-arm — appended
# after that write — post-dates the latest verification, and the next prompt sees
# rearm newer than verify and re-reads. After the forced re-read, that turn's Stop-true
# legitimately post-dates the re-arm and the cached skip resumes. If that ordering ever
# inverted (PreCompact before the turn's Stop), the Stop write would post-date the re-arm
# and the skip would resume prematurely — so this invariant is load-bearing.
#
# Never blocks (exit 0 on all paths). No-op without a session id.
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" 2>/dev/null || true

# Re-arm FIRST (safety-critical): keep it independent of the optional telemetry
# library sourced below — a missing/broken hook-logger must never suppress the re-arm.
# Honors the same bypass switch as the Stop-side verification writer: when caching is
# disabled the reader emits nothing regardless, so the re-arm is moot and skipped.
sid="$HOOK_SESSION_ID"
if [ "${MEOWKIT_SKIP_SAFETY_SENTINEL:-on}" != "off" ] && [ -n "$sid" ]; then
  # Refuse to write if the id holds characters that could break the JSON line.
  # Host-runtime session ids are UUID-shaped — alphanumeric + dash/underscore/dot.
  case "$sid" in
    *[!A-Za-z0-9_.-]*) ;;  # unsafe → skip silently
    *)
      # Resolve the state file the same way the reader does (CLAUDE_PROJECT_DIR, else cwd).
      _state_dir="${CLAUDE_PROJECT_DIR:-.}/session-state"
      mkdir -p "$_state_dir" 2>/dev/null
      _rearm_ts=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
      printf '{"session_id":"%s","event":"precompact_rearm","ts":"%s"}\n' \
        "$sid" "$_rearm_ts" \
        >> "$_state_dir/session-sentinels.jsonl" 2>/dev/null || true
      unset _state_dir _rearm_ts
      ;;
  esac
fi

# Telemetry (optional, best-effort): never let its absence affect the re-arm above.
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/hook-logger.sh" 2>/dev/null || exit 0
log_hook_event "precompact-probe" "fired"
exit 0
