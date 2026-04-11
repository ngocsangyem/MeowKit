#!/bin/sh
# load-dotenv.sh — Shared dotenv loader for MeowKit hooks.
# Source this at the top of any hook that reads MEOWKIT_* env vars.
# Loads .claude/.env if present. Does NOT override existing env vars.
#
# Usage: . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh"

_MEOWKIT_DOTENV="${CLAUDE_PROJECT_DIR:-.}/.claude/.env"
if [ -f "$_MEOWKIT_DOTENV" ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    case "$_line" in \#*|"") continue ;; esac
    _key="${_line%%=*}"
    _val="${_line#*=}"
    # Strip surrounding quotes
    _val="${_val%\"}" ; _val="${_val#\"}"
    _val="${_val%\'}" ; _val="${_val#\'}"
    # Only set if not already in environment (shell export takes precedence)
    # Use printenv instead of eval to avoid command injection
    if ! printenv "$_key" > /dev/null 2>&1; then
      export "$_key=$_val"
    fi
  done < "$_MEOWKIT_DOTENV"
fi
unset _MEOWKIT_DOTENV _line _key _val
