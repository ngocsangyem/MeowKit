#!/bin/sh
# post-session.sh — Capture session data to memory after session ends.
# Usage: post-session.sh

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

# Append session marker to lessons.md
cat >> "$MEMORY_DIR/lessons.md" << EOF

## Session $TIMESTAMP

<!-- Session placeholder — analyst agent will fill in learnings, decisions, and outcomes -->

EOF

# Initialize cost-log.json if missing
if [ ! -f "$MEMORY_DIR/cost-log.json" ]; then
  echo "[]" > "$MEMORY_DIR/cost-log.json"
fi

echo "Session data captured to .claude/memory/"
