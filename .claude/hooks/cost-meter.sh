#!/bin/sh
# cost-meter.sh — Track token usage per command.
# Usage: cost-meter.sh <command> <estimated_tokens> <tier> [task_summary]

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Hook profile gating — skip token tracking in standard/fast profiles for speed
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"
case "$MEOW_PROFILE" in
  standard|fast) exit 0 ;;
esac

COMMAND_NAME="$1"
ESTIMATED_TOKENS="$2"
TIER="$3"
TASK_SUMMARY="$4"

# Skip if cost tracking disabled in config
if command -v .claude/scripts/bin/meowkit-config >/dev/null 2>&1; then
  .claude/scripts/bin/meowkit-config has features.costTracking 2>/dev/null || exit 0
elif [ -f .claude/meowkit.config.json ]; then
  python3 -c "import json; exit(0 if json.load(open('.claude/meowkit.config.json')).get('features',{}).get('costTracking') else 1)" 2>/dev/null || exit 0
fi

# Safety fallback: if no arguments provided (e.g., called from PostToolUse without args), skip gracefully
if [ -z "$COMMAND_NAME" ] || [ -z "$ESTIMATED_TOKENS" ]; then
  exit 0
fi

if [ -z "$TIER" ]; then
  TIER="unknown"
fi

if [ -z "$TASK_SUMMARY" ]; then
  TASK_SUMMARY=""
fi

COST_FILE=".claude/memory/cost-log.json"
MEMORY_DIR=".claude/memory"

# Ensure directory exists
if [ ! -d "$MEMORY_DIR" ]; then
  mkdir -p "$MEMORY_DIR"
fi

# Initialize file if missing
if [ ! -f "$COST_FILE" ]; then
  echo "[]" > "$COST_FILE"
fi

TODAY=$(date "+%Y-%m-%d")

# Build the new JSON entry
NEW_ENTRY="  { \"date\": \"$TODAY\", \"command\": \"$COMMAND_NAME\", \"tier\": \"$TIER\", \"estimated_tokens\": $ESTIMATED_TOKENS, \"task_summary\": \"$TASK_SUMMARY\" }"

# Use temp file + mv for safe append
TMPFILE=$(mktemp)

# Read existing JSON, strip trailing ] and whitespace, append new entry
# Handle both empty array [] and populated array cases
CONTENT=$(cat "$COST_FILE")

if [ "$CONTENT" = "[]" ]; then
  # Empty array — start fresh
  printf "[\n%s\n]\n" "$NEW_ENTRY" > "$TMPFILE"
else
  # Non-empty array — remove trailing ], add comma + new entry + ]
  # Remove trailing newlines, then the closing bracket
  echo "$CONTENT" | sed '$ s/]$//' | sed '$ { /^$/d; }' > "$TMPFILE"
  # Add comma after last entry if needed
  # Check if last non-empty line ends with }
  LAST_CHAR=$(tail -c 2 "$TMPFILE" | head -c 1)
  if [ "$LAST_CHAR" = "}" ]; then
    printf ",\n" >> "$TMPFILE"
  fi
  printf "%s\n]\n" "$NEW_ENTRY" >> "$TMPFILE"
fi

mv "$TMPFILE" "$COST_FILE"

echo "Cost tracked: $COMMAND_NAME — $ESTIMATED_TOKENS tokens ($TIER)"
