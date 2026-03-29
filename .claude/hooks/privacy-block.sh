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

TOOL_NAME="$1"
FILE_PATH="$2"

# Only check file-accessing tools
case "$TOOL_NAME" in
  Read|Edit|Write) ;;
  Bash)
    # Check if bash command references sensitive files
    if echo "$FILE_PATH" | grep -qiE '\.env|\.key|\.pem|credentials|secret|keystore|\.ssh'; then
      echo "@@PRIVACY_BLOCK@@"
      echo "Sensitive file pattern detected in bash command."
      echo "Ask user for approval before accessing."
      exit 1
    fi
    exit 0
    ;;
  *) exit 0 ;;
esac

# Check file path against blocked patterns
if echo "$FILE_PATH" | grep -qiE '\.env($|\.)|\.key$|\.pem$|credentials|secret|keystore|\.ssh/'; then
  echo "@@PRIVACY_BLOCK@@"
  echo "File '$FILE_PATH' matches sensitive file pattern."
  echo "Use AskUserQuestion to get explicit user approval before accessing."
  exit 1
fi

exit 0
