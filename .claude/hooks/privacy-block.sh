#!/bin/bash
# MeowKit Privacy Block Hook
# PreToolUse: Block reads of sensitive files before they happen.
# Upgrades injection-rules.md Rule 4 from behavioral to preventive.
#
# Matches: Read, Edit, Write, Bash tool calls
# Blocks: .env*, *.key, *.pem, *credentials*, *secret*, *.keystore, ~/.ssh/*
#
# When blocked: outputs JSON marker for agent to prompt user approval.
# Agent must use AskUserQuestion tool to get explicit approval before retrying.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# settings.json matcher already filters to Read, Edit|Write — no need to check tool name
# $1 = file path passed via $TOOL_INPUT_FILE_PATH
FILE_PATH="$1"

# If no file path provided, allow (safety fallback)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Check file path against blocked patterns
if echo "$FILE_PATH" | grep -qiE '\.env($|\.)|\.key$|\.pem$|credentials|secret|keystore|\.ssh/'; then
  echo "@@PRIVACY_BLOCK@@"
  echo "File '$FILE_PATH' matches sensitive file pattern."
  echo "Use AskUserQuestion to get explicit user approval before accessing."
  exit 1
fi

exit 0
