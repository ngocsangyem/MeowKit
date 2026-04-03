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

echo "Session data captured to .claude/memory/"
