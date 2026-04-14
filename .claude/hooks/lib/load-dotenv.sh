#!/bin/sh
# load-dotenv.sh — Shared dotenv loader for MeowKit hooks.
# Source this at the top of any hook that reads MEOWKIT_* env vars.
# Loads .claude/.env if present. Does NOT override existing env vars.
#
# Usage: . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh"
#
# Security: validates keys as POSIX var names, blocks dangerous keys
# (PATH, LD_PRELOAD, etc.) to prevent env injection via rogue .env files.
#
# Parsing: handles inline comments on unquoted values, trims key whitespace,
# preserves quoted values containing `#` (e.g., API keys with literal hash).

_MEOWKIT_DOTENV="${CLAUDE_PROJECT_DIR:-.}/.claude/.env"
if [ -f "$_MEOWKIT_DOTENV" ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    case "$_line" in \#*|"") continue ;; esac
    _key="${_line%%=*}"
    _val="${_line#*=}"

    # Trim leading/trailing whitespace from key (users may indent .env lines)
    _key="${_key#"${_key%%[! 	]*}"}"
    _key="${_key%"${_key##*[! 	]}"}"

    # Validate key is a legal POSIX var name: [A-Za-z_][A-Za-z0-9_]*
    case "$_key" in
      ''|[!A-Za-z_]*|*[!A-Za-z0-9_]*) continue ;;
    esac

    # Block dangerous keys that could alter shell/linker behavior
    case "$_key" in
      PATH|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_INSERT_LIBRARIES|DYLD_FRAMEWORK_PATH|IFS|BASH_ENV|ENV)
        continue
        ;;
    esac

    # Detect if value is quoted BEFORE stripping comments.
    # Quoted values (API_KEY="abc#123") must preserve `#` literally.
    _quoted=0
    case "$_val" in
      \"*\"|\'*\') _quoted=1 ;;
    esac

    # Strip inline comments only for unquoted values (" # " pattern)
    if [ "$_quoted" = "0" ]; then
      _val="${_val%%[[:space:]]#*}"
    fi

    # Now strip surrounding quotes (if any)
    _val="${_val%\"}" ; _val="${_val#\"}"
    _val="${_val%\'}" ; _val="${_val#\'}"

    # Only set if not already in environment (shell export takes precedence)
    # Use printenv instead of eval to avoid command injection
    if ! printenv "$_key" > /dev/null 2>&1; then
      export "$_key=$_val"
    fi
  done < "$_MEOWKIT_DOTENV"
fi
unset _MEOWKIT_DOTENV _line _key _val _quoted
