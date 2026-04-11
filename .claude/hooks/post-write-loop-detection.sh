#!/bin/bash
# SUPERSEDED — Replaced by handlers/loop-detection.cjs (dispatched via dispatch.cjs).
# Not registered in settings.json. Do not re-register.
#
# post-write-loop-detection.sh — Warn when the same file is edited too many times.
# Phase 7 middleware — doom-loop detection from LangChain harness research.
# Input: JSON on stdin (parsed via lib/read-hook-input.sh).
# Behavior: increment per-file edit count; warn at N=4, escalate at N=8.
# Never blocks — warnings feed back to agent via stdout injection.
#
# State: session-state/edit-counts.json — keyed by {session_id}:{realpath}.
# Reset: on new session (post-session.sh + project-context-loader.sh detect session change).
set -u

if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Bypass
[ "${MEOWKIT_LOOP_DETECT:-on}" = "off" ] && exit 0

# Parse JSON on stdin
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
FILE="${HOOK_FILE_PATH:-$1}"
SESSION="${HOOK_SESSION_ID:-default}"

[ -z "$FILE" ] && exit 0

# Normalize path (P10)
if command -v realpath >/dev/null 2>&1; then
  NORMALIZED=$(realpath "$FILE" 2>/dev/null || echo "$FILE")
else
  NORMALIZED="$FILE"
fi

# Compose the key
KEY="${SESSION}:${NORMALIZED}"

# State file + lock
STATE_DIR="session-state"
STATE_FILE="$STATE_DIR/edit-counts.json"
LOCK_FILE="$STATE_DIR/.edit-counts.lock"
mkdir -p "$STATE_DIR"
[ -f "$STATE_FILE" ] || echo '{}' > "$STATE_FILE"

# Python helper (P12 — no jq dep)
PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"
command -v "$PY" >/dev/null 2>&1 || exit 0  # P1 graceful degradation

# Atomic increment via flock (P9)
if command -v flock >/dev/null 2>&1; then
  exec 9> "$LOCK_FILE"
  flock -x -w 2 9 || exit 0  # skip if lock contended
fi

# Increment count for this key and read back
COUNT=$("$PY" -c "
import json, sys
try:
    with open('$STATE_FILE') as f:
        d = json.load(f)
except Exception:
    d = {}
k = '$KEY'
d[k] = d.get(k, 0) + 1
count = d[k]
with open('$STATE_FILE', 'w') as f:
    json.dump(d, f)
print(count)
" 2>/dev/null)

# Release lock
exec 9>&- 2>/dev/null || true

COUNT=${COUNT:-0}

# Emit warning / escalation based on thresholds
TRIGGERED_THRESHOLD=0
if [ "$COUNT" -ge 8 ]; then
  echo "@@LOOP_DETECT_ESCALATE@@"
  echo "Max edit budget exceeded for $FILE ($COUNT edits this session)."
  echo "Halt and re-plan. Repeated small variations to the same file almost always indicate a flawed approach."
  echo "Re-read the plan/contract, challenge your assumptions, and consider a different strategy before the next edit."
  echo "@@END_LOOP_DETECT@@"
  TRIGGERED_THRESHOLD=8
elif [ "$COUNT" -ge 4 ]; then
  echo "@@LOOP_DETECT_WARN@@"
  echo "You have edited $FILE $COUNT times this session."
  echo "Consider reconsidering your approach — repeated small variations often indicate a flawed plan."
  echo "Re-read the plan/contract and challenge your assumptions before the next edit."
  echo "@@END_LOOP_DETECT@@"
  TRIGGERED_THRESHOLD=4
fi

# Phase 8 (260408): emit canonical `loop_warning` trace record per trace-schema.md
# ownership table. ONLY emits when threshold is tripped — no emission for counts 1-3.
if [ "$TRIGGERED_THRESHOLD" -gt 0 ] && [ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" ]; then
  bash "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" "loop_warning" \
    "{\"file\":\"$FILE\",\"count\":$COUNT,\"threshold\":$TRIGGERED_THRESHOLD}" 2>/dev/null || true
fi

exit 0
