#!/bin/sh
# learning-observer.sh — PostToolUse hook
# Logs notable patterns during session for retroactive memory capture.
# Registered: PostToolUse on Edit|Write
#
# Signals detected:
#   churn   — same file edited 3+ times this session
#
# Load .claude/.env (each hook is a separate subprocess)
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
# State: session-state/learning-observer.jsonl — per-file edit ledger, self-read to
# compute edit_count for the canonical `file_edited` trace. No external reader
# (the old retroactive-capture path was removed); the verbose churn record below is
# debug-gated behind MEOWKIT_HOOK_DEBUG.

# Hook profile gating — only active in standard and strict profiles
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"
case "$MEOW_PROFILE" in
  fast) exit 0 ;;
esac

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then
  cd "$CLAUDE_PROJECT_DIR" || exit 0
fi

# State file for this session
STATE_DIR="session-state"
STATE_FILE="$STATE_DIR/learning-observer.jsonl"
mkdir -p "$STATE_DIR"

# Phase 7 (260408): JSON-on-stdin parser; prefer $HOOK_FILE_PATH, fall back to $1.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
FILE_PATH="${HOOK_FILE_PATH:-${1:-unknown}}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Track edit frequency for this file path
if [ -f "$STATE_FILE" ]; then
  EDIT_COUNT=$(grep -c "\"file\":\"$FILE_PATH\"" "$STATE_FILE" 2>/dev/null || echo "0")
  EDIT_COUNT=$((EDIT_COUNT + 1))
else
  EDIT_COUNT=1
fi

# Log the edit event
printf '{"type":"edit","file":"%s","count":%d,"ts":"%s"}\n' \
  "$FILE_PATH" "$EDIT_COUNT" "$TIMESTAMP" >> "$STATE_FILE"

# Detect churn pattern: 3+ edits to the same file this session.
# The churn record has no reader — churn is re-derivable from the canonical
# `file_edited` trace edit_count via mk:trace-analyze — so emit it only under debug.
if [ "${MEOWKIT_HOOK_DEBUG:-0}" = "1" ] && [ "$EDIT_COUNT" -ge 3 ]; then
  printf '{"type":"churn","file":"%s","count":%d,"ts":"%s"}\n' \
    "$FILE_PATH" "$EDIT_COUNT" "$TIMESTAMP" >> "$STATE_FILE"
fi

# Phase 8 (260408): emit canonical `file_edited` trace record per ownership table.
# Schema: {file: str, edit_count: int} — both fields present.
# Phase 8 m4 fix: previously emitted before EDIT_COUNT was computed → schema-violating.
# Non-blocking; trace failures don't break the hook chain.
if [ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" ] && [ "$FILE_PATH" != "unknown" ]; then
  bash "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" "file_edited" \
    "{\"file\":\"$FILE_PATH\",\"edit_count\":$EDIT_COUNT}" 2>/dev/null || true
fi

exit 0
