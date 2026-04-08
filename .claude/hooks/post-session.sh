#!/bin/sh
# post-session.sh — Capture session data to memory after session ends.
# Usage: post-session.sh

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Hook profile gating — skip memory capture in standard/fast profiles for speed
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"
case "$MEOW_PROFILE" in
  standard|fast) exit 0 ;;
esac

# Retroactive capture budget (MeowKit v2.0: extended from 2min/3 markers)
MAX_CAPTURE_SECONDS=300
MAX_MARKERS=5

MEMORY_DIR=".claude/memory"

# Skip if memory disabled in config
if [ -f .claude/meowkit.config.json ]; then
  if command -v .claude/scripts/bin/meowkit-config >/dev/null 2>&1; then
    .claude/scripts/bin/meowkit-config has features.memory 2>/dev/null || { echo "Memory disabled in config — skipping"; exit 0; }
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

# Detect if recent commits contain CRITICAL or SECURITY signals
# Markers tagged CRITICAL or SECURITY are processed by Phase 0 regardless of age or MAX_MARKERS limit
RECENT_MESSAGES=$(git log --oneline -5 2>/dev/null | tr '[:upper:]' '[:lower:]')
PRIORITY_TAG=""
case "$RECENT_MESSAGES" in
  *critical*|*security*|*vuln*|*cve*|*hotfix*) PRIORITY_TAG=" CRITICAL" ;;
esac

# Append machine-readable session marker for Phase 0 retroactive capture
cat >> "$MEMORY_DIR/lessons.md" << EOF

## Session $TIMESTAMP — NEEDS_CAPTURE${PRIORITY_TAG}
- Files in recent commits: $RECENT_FILES
- Status: uncaptured
EOF

# Read learning observer patterns if available
OBSERVER_FILE="session-state/learning-observer.jsonl"
if [ -f "$OBSERVER_FILE" ]; then
  CHURN_COUNT=$(grep -c '"type":"churn"' "$OBSERVER_FILE" 2>/dev/null || echo "0")
  if [ "$CHURN_COUNT" -gt 0 ]; then
    echo "Learning observer detected $CHURN_COUNT churn patterns this session" >&2
    # Append churn summary to session marker for Phase 0 retroactive capture
    cat >> "$MEMORY_DIR/lessons.md" << EOF
- Learning observer: $CHURN_COUNT churn pattern(s) detected (files edited 3+ times)
EOF
  fi
fi

# Initialize cost-log.json if missing
if [ ! -f "$MEMORY_DIR/cost-log.json" ]; then
  echo "[]" > "$MEMORY_DIR/cost-log.json"
fi

# Phase 6 extension (260408): detect model version change → flag dead-weight audit needed.
# Reads the current model id from the most recent CLAUDE_MODEL / ANTHROPIC_MODEL env var
# and compares against last session's recorded value at .claude/memory/last-model-id.txt.
# On change, appends `dead-weight-audit-needed` to lessons.md so Phase 0 surfaces it.
LAST_MODEL_FILE="$MEMORY_DIR/last-model-id.txt"
CURRENT_MODEL="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-unknown}}}"

if [ ! -f "$LAST_MODEL_FILE" ]; then
  # First run: write current model + exit (no comparison yet)
  echo "$CURRENT_MODEL" > "$LAST_MODEL_FILE"
elif [ "$CURRENT_MODEL" != "unknown" ]; then
  LAST_MODEL=$(cat "$LAST_MODEL_FILE" 2>/dev/null || echo "unknown")
  if [ "$CURRENT_MODEL" != "$LAST_MODEL" ] && [ "$LAST_MODEL" != "unknown" ]; then
    cat >> "$MEMORY_DIR/lessons.md" << EOF

## Session $TIMESTAMP — dead-weight-audit-needed
- Reason: model version changed from "$LAST_MODEL" to "$CURRENT_MODEL"
- Action: run dead-weight audit per docs/dead-weight-audit.md
- Status: uncaptured
EOF
    echo "Dead-weight audit flagged: model changed $LAST_MODEL → $CURRENT_MODEL" >&2
  fi
  # Always update the recorded model for next comparison
  echo "$CURRENT_MODEL" > "$LAST_MODEL_FILE"
fi

# Phase 8 (260408): emit session_end trace record (canonical per trace-schema.md).
# Non-blocking; trace failures don't break the hook chain.
if [ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" ]; then
  bash "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" "session_end" \
    "{\"recent_files\":${RECENT_FILES:-0},\"priority_tag\":\"${PRIORITY_TAG// /_}\"}" 2>/dev/null || true
fi

echo "Session data captured to .claude/memory/"
