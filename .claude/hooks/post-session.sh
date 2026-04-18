#!/bin/bash
# post-session.sh — Capture session data to memory after session ends.
# Usage: post-session.sh

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Load .claude/.env (each hook is a separate subprocess)
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true

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
    # H1 fix: if stat fails (network FS, race), treat lock as live — don't use echo 0 which
    # would set _lock_age to ~unix-epoch causing spurious stale-eviction.
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

# NOTE: NEEDS_CAPTURE heredoc removed in phase-05 — lessons.md migration complete.
# The model-change flag below now targets fixes.md instead of lessons.md.

# Initialize cost-log.json if missing
if [ ! -f "$MEMORY_DIR/cost-log.json" ]; then
  echo "[]" > "$MEMORY_DIR/cost-log.json"
fi

# Append cost entry from budget-state (values passed via env vars to avoid shell-to-Python injection)
BUDGET_STATE_FILE="session-state/budget-state.json"
if [ -f "$BUDGET_STATE_FILE" ] && command -v python3 >/dev/null 2>&1; then
  # H3 fix: scrub secrets from budget-state before passing to Python block
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/secret-scrub.sh" 2>/dev/null || true
  if command -v scrub_secrets >/dev/null 2>&1; then
    CLEAN_BUDGET=$(scrub_secrets "$(cat "$BUDGET_STATE_FILE" 2>/dev/null || echo '{}')")
  else
    CLEAN_BUDGET=$(cat "$BUDGET_STATE_FILE" 2>/dev/null || echo '{}')
  fi
  # M1 fix: include session_id + model + cache token fields per cost-tracking.md spec.
  # M7 fix: write to temp file then atomic rename (os.replace) — concurrent-safe.
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

# Phase 6 extension (260408): detect model version change → flag dead-weight audit needed.
# phase-05 update: writes flag to fixes.md (was lessons.md, now archived).
LAST_MODEL_FILE="$MEMORY_DIR/last-model-id.txt"
CURRENT_MODEL="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-unknown}}}"

if [ ! -f "$LAST_MODEL_FILE" ]; then
  # First run: write current model (no comparison yet)
  echo "$CURRENT_MODEL" > "$LAST_MODEL_FILE"
elif [ "$CURRENT_MODEL" != "unknown" ]; then
  LAST_MODEL=$(cat "$LAST_MODEL_FILE" 2>/dev/null || echo "unknown")
  if [ "$CURRENT_MODEL" != "$LAST_MODEL" ] && [ "$LAST_MODEL" != "unknown" ]; then
    # Write model-change flag to fixes.md (replaces lessons.md NEEDS_CAPTURE marker)
    cat >> "$MEMORY_DIR/fixes.md" << 'FIXES_EOF'

## dead-weight-audit-needed (auto-flagged)
- Reason: model version changed — run /meow:trace-analyze
- Date: TIMESTAMP_PLACEHOLDER
FIXES_EOF
    # Replace placeholder — TIMESTAMP contains only digits/colons/hyphens, no injection risk
    FIXES_TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
    sed -i.bak "s/TIMESTAMP_PLACEHOLDER/$FIXES_TIMESTAMP/" "$MEMORY_DIR/fixes.md" 2>/dev/null
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
[ "${TOTAL:-0}" -gt 500 ] && echo "HINT: topic files total $TOTAL lines — consider /meow:memory --prune" >&2

# Phase 8 (260408): emit session_end trace record (canonical per trace-schema.md).
# Non-blocking; trace failures don't break the hook chain.
if [ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" ]; then
  bash "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" "session_end" \
    "{\"recent_files\":${RECENT_FILES:-0}}" 2>/dev/null || true
fi

echo "Session data captured to .claude/memory/"

# NOTE: Phase 9 conversation-summary cache clear lives in project-context-loader.sh
# (SessionStart hook) — see M2 fix in red-team-260408-2202-phase-09-review.md.
# Stop hook is the wrong home: standard|fast profile short-circuits at top of this
# file, so the cache-clear branch was dead code. SessionStart always runs.
