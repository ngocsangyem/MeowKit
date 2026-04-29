#!/bin/bash
# hook-logger.sh — Append-only JSONL logger for hook fires.
# Sourced by hooks; calls log_hook_event "<hook>" "<event>" [<detail-json>].
#
# Stream positioning:
#   - .claude/hooks/.logs/hook-log.jsonl is INTERNAL hook-fire telemetry (gitignored)
#   - .claude/memory/trace-log.jsonl (append-trace.sh) is SHARED memory (may be committed)
#
# Rotation: adapted from append-trace.sh:97-107. 50MB threshold, mv-rename.
# Differs by intent: hook-log is read frequently for telemetry — DO NOT gzip rotated files.

HOOK_LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/.logs"
HOOK_LOG_FILE="$HOOK_LOG_DIR/hook-log.jsonl"
HOOK_LOG_MAX_BYTES=$((50 * 1024 * 1024))

log_hook_event() {
  # $1 = hook name, $2 = event ("start"|"end"|"error"|"fired"), $3 = optional detail JSON
  local hook="${1:-unknown}"
  local event="${2:-fired}"
  local detail="${3:-null}"

  mkdir -p "$HOOK_LOG_DIR" 2>/dev/null || return 0

  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"ts":"%s","hook":"%s","event":"%s","session":"%s","detail":%s}\n' \
    "$ts" "$hook" "$event" "${HOOK_SESSION_ID:-unknown}" "$detail" \
    >> "$HOOK_LOG_FILE" 2>/dev/null || return 0

  # Rotation — same threshold as append-trace.sh, no gzip
  if [ -f "$HOOK_LOG_FILE" ]; then
    local size
    size=$(stat -f %z "$HOOK_LOG_FILE" 2>/dev/null || stat -c %s "$HOOK_LOG_FILE" 2>/dev/null || echo 0)
    if [ "$size" -gt "$HOOK_LOG_MAX_BYTES" ] 2>/dev/null; then
      local rotts
      rotts=$(date +%y%m%d-%H%M%S)
      mv "$HOOK_LOG_FILE" "$HOOK_LOG_DIR/hook-log.${rotts}.jsonl" 2>/dev/null && : > "$HOOK_LOG_FILE"
    fi
  fi
}
