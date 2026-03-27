#!/bin/sh
# cost-meter.sh — Track token usage per command.
# Usage: cost-meter.sh <command> <estimated_tokens> <tier> [task_summary]

COMMAND_NAME="$1"
ESTIMATED_TOKENS="$2"
TIER="$3"
TASK_SUMMARY="$4"

if [ -z "$COMMAND_NAME" ] || [ -z "$ESTIMATED_TOKENS" ]; then
  echo "Usage: cost-meter.sh <command> <estimated_tokens> <tier> [task_summary]"
  exit 1
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
