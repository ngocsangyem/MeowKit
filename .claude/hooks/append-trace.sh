#!/bin/bash
# append-trace.sh — Append a single JSONL trace record to .claude/memory/trace-log.jsonl.
# Phase 8: shared trace writer for hooks + harness steps.
#
# Usage:
#   append-trace.sh <event-type> '<json-payload-string>'
#
# Example:
#   append-trace.sh file_edited '{"file":"src/foo.ts","edit_count":3}'
#
# Behavior:
#   - Uses flock for atomic appends (concurrent hook safety; falls back to plain
#     append on macOS where flock(1) is not in the base install — atomicity
#     guaranteed only for records ≤ PIPE_BUF/512 bytes in fallback mode)
#   - Scrubs secrets via lib/secret-scrub.sh before write
#   - Rotates the log when it exceeds 50MB → trace-log.{YYMMDD-HHMMSS}.jsonl.gz
#   - Schema-versioned via top-level `schema_version: 1.0` field
#
# Exit: 0 always (never block hook chain on trace failures)
set -u

# Args. Note: do NOT use ${2:-{}} — bash parses that as ${2:-{} + literal },
# which appends a stray `}` when $2 is non-empty. Use separate default assignment.
EVENT="${1:-unknown}"
PAYLOAD="${2:-}"
[ -z "$PAYLOAD" ] && PAYLOAD="{}"

# Resolve project root
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && cd "$CLAUDE_PROJECT_DIR"

LOG_DIR=".claude/memory"
LOG_FILE="$LOG_DIR/trace-log.jsonl"
LOCK_FILE="$LOG_DIR/.trace-log.lock"
MAX_BYTES=$((50 * 1024 * 1024))  # 50MB

mkdir -p "$LOG_DIR" 2>/dev/null || exit 0

# Source secret scrubber (graceful if missing)
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/secret-scrub.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/secret-scrub.sh"
else
  scrub_secrets() { echo "$1"; }
fi

# Scrub the payload
SCRUBBED=$(scrub_secrets "$PAYLOAD")

# Build the record via python (avoid jq dependency)
PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"
command -v "$PY" >/dev/null 2>&1 || exit 0

# Pass EVENT and SCRUBBED via env vars (NOT shell string interpolation) to avoid
# injection from special chars (single/triple quotes, Python escapes). A filename
# like O'Brien.ts would otherwise crash the parser silently and drop the trace record.
RECORD=$(MEOWKIT_TRACE_EVENT="$EVENT" MEOWKIT_TRACE_PAYLOAD="$SCRUBBED" "$PY" -c "
import json, sys, os
from datetime import datetime, timezone

event = os.environ.get('MEOWKIT_TRACE_EVENT', 'unknown')
payload_str = os.environ.get('MEOWKIT_TRACE_PAYLOAD', '')

# Parse the payload — accept any JSON OR fall back to a string-wrapped object
try:
    data = json.loads(payload_str) if payload_str else {}
    if not isinstance(data, dict):
        data = {'value': data}
except (json.JSONDecodeError, ValueError):
    data = {'raw': payload_str}

record = {
    'schema_version': '1.0',
    'ts': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'event': event,
    'run_id': os.environ.get('MEOWKIT_RUN_ID', ''),
    'harness_version': os.environ.get('MEOWKIT_HARNESS_VERSION', '3.0.0'),
    'model': os.environ.get('MEOWKIT_MODEL_HINT', os.environ.get('CLAUDE_MODEL', '')),
    'density': os.environ.get('MEOWKIT_HARNESS_MODE', ''),
    'data': data,
}
print(json.dumps(record, separators=(',', ':')))
" 2>/dev/null)

[ -z "$RECORD" ] && exit 0

# Atomic append via flock
if command -v flock >/dev/null 2>&1; then
  exec 9>> "$LOG_FILE"
  flock -x -w 2 9 || exit 0
  echo "$RECORD" >&9
  exec 9>&- 2>/dev/null || true
else
  # macOS may not have flock — fall back to atomic append (single write call is atomic on POSIX for small writes)
  echo "$RECORD" >> "$LOG_FILE"
fi

# Rotate if file exceeds max size
if [ -f "$LOG_FILE" ]; then
  SIZE=$(stat -f %z "$LOG_FILE" 2>/dev/null || stat -c %s "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt "$MAX_BYTES" ] 2>/dev/null; then
    TS=$(date +%y%m%d-%H%M%S)
    ROTATED="$LOG_DIR/trace-log.${TS}.jsonl"
    mv "$LOG_FILE" "$ROTATED" 2>/dev/null && \
      gzip "$ROTATED" 2>/dev/null && \
      : > "$LOG_FILE"
  fi
fi

exit 0
