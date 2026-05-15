#!/bin/bash
# post-session.sh — Capture session data to memory after session ends.
# Usage: post-session.sh

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Load .claude/.env (each hook is a separate subprocess)
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true

# Parse JSON stdin to populate HOOK_SESSION_ID. Required for the sentinel
# write block at end of file; also used by the cost-log session_id field.
# Non-fatal if absent (graceful degradation per read-hook-input.sh contract).
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi

# Hook profile gating — CF7 fix: run by default, opt-OUT only on fast profile
# Memory capture, cost tracking, and trace records require this hook to run.
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"
case "$MEOW_PROFILE" in
  fast) exit 0 ;;
esac

# Retroactive capture budget (MeowKit v2.0: extended from 2min/3 markers)
MAX_CAPTURE_SECONDS=300
MAX_MARKERS=5

MEMORY_DIR=".claude/memory"

# Skip if memory disabled in config
if [ -f .claude/meowkit.config.json ]; then
  if command -v .claude/scripts/bin/meowkit-config >/dev/null 2>&1; then
    .claude/scripts/bin/meowkit-config has features.memory 2>/dev/null || { echo "Memory disabled in config — skipping"; exit 0; }
  elif ! command -v python3 >/dev/null 2>&1; then
    echo "Warning: python3 not found — meowkit-config unavailable; proceeding with memory capture" >&2
  fi
fi

# Ensure memory directory exists
if [ ! -d "$MEMORY_DIR" ]; then
  mkdir -p "$MEMORY_DIR"
fi

# Get current timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")

# Count files in recent commits (captures actual work done)
RECENT_FILES=$(git log --oneline -5 --name-only 2>/dev/null | grep -v '^[a-f0-9]' | sort -u | wc -l | tr -d ' ')

# mkdir-based atomic lock (POSIX portable — flock does not exist on macOS)
LOCKDIR="$MEMORY_DIR/.lessons.lock"
acquire_lock() {
  local _timeout=5
  while [ "$_timeout" -gt 0 ]; do
    if mkdir "$LOCKDIR" 2>/dev/null; then
      trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT
      return 0
    fi
    # Stale lock detection (>60 seconds old)
    # If stat fails (network FS, race), treat the lock as live — using echo 0 would
    # set _lock_age to ~unix-epoch and cause spurious stale-eviction.
    if [ -d "$LOCKDIR" ]; then
      local _lock_mtime _lock_age
      _lock_mtime=$(stat -f %m "$LOCKDIR" 2>/dev/null || stat -c %Y "$LOCKDIR" 2>/dev/null)
      if [ -z "$_lock_mtime" ]; then
        sleep 1; _timeout=$((_timeout - 1)); continue  # stat failed — treat as live lock, retry
      fi
      _lock_age=$(( $(date +%s) - _lock_mtime ))
      if [ "$_lock_age" -gt 60 ]; then rmdir "$LOCKDIR" 2>/dev/null; continue; fi
    fi
    sleep 1
    _timeout=$((_timeout - 1))
  done
  return 1
}

# The retroactive NEEDS_CAPTURE heredoc has been removed. lessons.md is archived.
# The model-change flag below targets fixes.md.

# Initialize cost-log.json if missing
if [ ! -f "$MEMORY_DIR/cost-log.json" ]; then
  echo "[]" > "$MEMORY_DIR/cost-log.json"
fi

# Append cost entry from budget-state (values passed via env vars to avoid shell-to-Python injection)
BUDGET_STATE_FILE="session-state/budget-state.json"
if [ -f "$BUDGET_STATE_FILE" ] && command -v python3 >/dev/null 2>&1; then
  # Scrub secrets from budget-state before passing to the Python block.
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/secret-scrub.sh" 2>/dev/null || true
  if command -v scrub_secrets >/dev/null 2>&1; then
    CLEAN_BUDGET=$(scrub_secrets "$(cat "$BUDGET_STATE_FILE" 2>/dev/null || echo '{}')")
  else
    CLEAN_BUDGET=$(cat "$BUDGET_STATE_FILE" 2>/dev/null || echo '{}')
  fi
  # Include session_id + model + cache-token fields per cost-tracking.md spec.
  # Atomic write: temp file + os.replace rename — safe under concurrent invocations.
  _CLEAN_BUDGET="$CLEAN_BUDGET" \
  _COST_LOG="$MEMORY_DIR/cost-log.json" \
  _TIMESTAMP="$TIMESTAMP" \
  _SESSION_ID="${HOOK_SESSION_ID:-}" \
  _MODEL_HINT="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-unknown}}}" \
  python3 -c '
import json, os, tempfile
clean_budget = os.environ["_CLEAN_BUDGET"]
cost_log = os.environ["_COST_LOG"]
timestamp = os.environ["_TIMESTAMP"]
try:
    b = json.loads(clean_budget)
    with open(cost_log) as f: logs = json.load(f)
    logs.append({
        "date": timestamp,
        "session_id": os.environ.get("_SESSION_ID", ""),
        "model": os.environ.get("_MODEL_HINT", "unknown"),
        "cost_usd": b.get("estimated_cost_usd", 0),
        "tokens_in": b.get("estimated_input_tokens", 0),
        "tokens_out": b.get("estimated_output_tokens", 0),
        "cache_write_tokens": b.get("cache_write_tokens", 0),
        "cache_read_tokens": b.get("cache_read_tokens", 0),
    })
    if len(logs) > 1000: logs = logs[-1000:]
    tmp_fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(cost_log))
    try:
        with os.fdopen(tmp_fd, "w") as f: json.dump(logs, f, indent=2)
        os.replace(tmp_path, cost_log)  # atomic on POSIX
    except Exception:
        try: os.unlink(tmp_path)
        except: pass
except Exception:
    pass
' 2>/dev/null || true
fi

# Detect model-version change → flag dead-weight audit needed.
# Writes flag to fixes.md (the bug-class topic file).
LAST_MODEL_FILE="$MEMORY_DIR/last-model-id.txt"
CURRENT_MODEL="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-unknown}}}"

if [ ! -f "$LAST_MODEL_FILE" ]; then
  # First run: write current model (no comparison yet)
  echo "$CURRENT_MODEL" > "$LAST_MODEL_FILE"
elif [ "$CURRENT_MODEL" != "unknown" ]; then
  LAST_MODEL=$(cat "$LAST_MODEL_FILE" 2>/dev/null || echo "unknown")
  if [ "$CURRENT_MODEL" != "$LAST_MODEL" ] && [ "$LAST_MODEL" != "unknown" ]; then
    # Header-date format — required for memory-prune.py to parse the date.
    # A sub-bullet date would make these entries permanently immune to pruning.
    cat >> "$MEMORY_DIR/fixes.md" << 'FIXES_EOF'

## DATE_PLACEHOLDER — dead-weight-audit-needed (auto-flagged)
- Reason: model version changed — run /mk:trace-analyze
- Logged at: TIME_PLACEHOLDER
FIXES_EOF
    # Replace placeholders — values contain only digits/colons/hyphens/space, no injection risk
    FIXES_DATE=$(date "+%Y-%m-%d")
    FIXES_TIME=$(date "+%H:%M")
    sed -i.bak "s/DATE_PLACEHOLDER/$FIXES_DATE/; s/TIME_PLACEHOLDER/$FIXES_TIME/" "$MEMORY_DIR/fixes.md" 2>/dev/null
    rm -f "$MEMORY_DIR/fixes.md.bak"
    echo "Dead-weight audit flagged: model changed $LAST_MODEL → $CURRENT_MODEL" >&2
  fi
  # Always update the recorded model for next comparison
  echo "$CURRENT_MODEL" > "$LAST_MODEL_FILE"
fi

# M9 partial fix: threshold hint — sum lines across all topic files
TOTAL=$(wc -l "$MEMORY_DIR"/fixes.md "$MEMORY_DIR"/review-patterns.md \
  "$MEMORY_DIR"/architecture-decisions.md "$MEMORY_DIR"/security-notes.md \
  2>/dev/null | tail -1 | awk '{print $1}')
[ "${TOTAL:-0}" -gt 500 ] && echo "HINT: topic files total $TOTAL lines — consider /mk:memory --prune" >&2

# Phase 8 (260408): emit session_end trace record (canonical per trace-schema.md).
# Non-blocking; trace failures don't break the hook chain.
if [ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" ]; then
  bash "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" "session_end" \
    "{\"recent_files\":${RECENT_FILES:-0}}" 2>/dev/null || true
fi

# Safety/phase-zero sentinel write — enables agent-detector to skip the
# 10-file rule-load loop on turns 2..N of the same session. State lives in a
# single append-only JSONL log keyed by session_id, not one file per session.
# project-context-loader.sh truncates the log on new-session detection so it
# never accumulates state from prior sessions.
if [ "${MEOWKIT_SKIP_SAFETY_SENTINEL:-on}" != "off" ] && [ -n "${HOOK_SESSION_ID:-}" ]; then
  # Refuse to write if session_id contains characters that could break JSON.
  # Session IDs from the host runtime are UUID-shaped — alphanumeric + dash/underscore/dot.
  case "$HOOK_SESSION_ID" in
    *[!A-Za-z0-9_.-]*) ;;  # unsafe → skip silently
    *)
      mkdir -p session-state 2>/dev/null
      _SENTINEL_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
      printf '{"session_id":"%s","safety":true,"phase_zero":true,"ts":"%s"}\n' \
        "$HOOK_SESSION_ID" "$_SENTINEL_TS" \
        >> session-state/session-sentinels.jsonl 2>/dev/null || true
      unset _SENTINEL_TS
      ;;
  esac
fi

# Memory auto-prune (gated by MEOWKIT_MEMORY_PRUNE and daily rate-limit).
# Failure modes handled:
#   - empty TODAY (date(1) failure)        → [ -n "$TODAY" ] guard skips cleanly
#   - Python error (exit != 0)             → LAST_PRUNE_FILE NOT advanced; retries tomorrow
#   - prune-log location                   → session-state/, NOT .claude/memory/.
#     Loaders never scan session-state/, which breaks the injection-rules.md Rule 11
#     carrier chain (memory files are both untrusted input AND sensitive data).
MEOWKIT_MEMORY_PRUNE="${MEOWKIT_MEMORY_PRUNE:-on}"
PRUNE_AGE="${MEOWKIT_MEMORY_PRUNE_AGE_DAYS:-90}"
# Validate PRUNE_AGE is integer to prevent shell→python arg injection.
case "$PRUNE_AGE" in ''|*[!0-9]*) PRUNE_AGE=90 ;; esac
LAST_PRUNE_FILE="session-state/last-prune-date"
TODAY=$(date +%Y-%m-%d 2>/dev/null)
LAST_PRUNE=$(cat "$LAST_PRUNE_FILE" 2>/dev/null || echo "")

if [ "$MEOWKIT_MEMORY_PRUNE" != "off" ] && [ -n "$TODAY" ] && [ "$TODAY" != "$LAST_PRUNE" ]; then
  VENV_PY="${CLAUDE_PROJECT_DIR:-.}/.claude/skills/.venv/bin/python3"
  PRUNE_SCRIPT="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/memory-prune.py"
  MEM_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/memory"
  PRUNE_LOG="session-state/prune-log.md"  # NOT inside .claude/memory/
  mkdir -p session-state 2>/dev/null
  if [ -x "$VENV_PY" ] && [ -f "$PRUNE_SCRIPT" ]; then
    PRUNE_RESULT=$("$VENV_PY" "$PRUNE_SCRIPT" "$MEM_DIR" "$PRUNE_AGE" "$PRUNE_LOG" 2>/dev/null)
    PRUNE_EXIT=$?
    [ -n "$PRUNE_RESULT" ] && echo "Memory prune: $PRUNE_RESULT"
    if [ "$PRUNE_EXIT" -eq 0 ]; then
      echo "$TODAY" > "$LAST_PRUNE_FILE"
    else
      echo "Memory prune failed (exit $PRUNE_EXIT) — will retry tomorrow" >&2
    fi
  fi
fi

echo "Session data captured to .claude/memory/"

# NOTE: conversation-summary cache clear lives in project-context-loader.sh
# (SessionStart hook). Stop hook is the wrong home: standard|fast profile
# short-circuits at top of this file, so a cache-clear branch here would be
# dead code. SessionStart always runs.
