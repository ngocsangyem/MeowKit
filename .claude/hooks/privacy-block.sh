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

# Hook profile gating — safety-critical: NEVER skip regardless of profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"

# Phase 7 (260408): source JSON-on-stdin parser; prefer $HOOK_FILE_PATH, fall back to $1.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
FILE_PATH="${HOOK_FILE_PATH:-$1}"

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
