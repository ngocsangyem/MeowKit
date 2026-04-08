#!/bin/bash
# read-hook-input.sh — Shared JSON-on-stdin parser shim for meowkit hooks.
#
# Per Claude Code docs (verified 260408 against code.claude.com/docs/en/hooks):
# hooks receive their input as a JSON object on stdin, NOT as positional args.
# Phase 7 migration of meowkit hooks to this convention.
#
# Usage (in any hook):
#   #!/bin/bash
#   . "$CLAUDE_PROJECT_DIR/.claude/hooks/lib/read-hook-input.sh"
#   echo "tool: $HOOK_TOOL_NAME, file: $HOOK_FILE_PATH"
#
# Exports the following env vars (empty string if not present in input):
#   HOOK_INPUT_RAW       — raw JSON string (for hooks that need full structure)
#   HOOK_TOOL_NAME       — tool_name field
#   HOOK_FILE_PATH       — tool_input.file_path (Edit/Write/Read)
#   HOOK_COMMAND         — tool_input.command (Bash)
#   HOOK_SESSION_ID      — session_id
#   HOOK_TOOL_USE_ID     — tool_use_id
#   HOOK_CWD             — cwd
#   HOOK_EVENT_NAME      — hook_event_name
#   HOOK_TRANSCRIPT_PATH — transcript_path
#
# Reqs: Bash 3.2+. Uses Python (.claude/skills/.venv/bin/python3, falls back to system python3).
# Graceful degradation: if no python available OR JSON parse error, exports empty vars + warns.

# Sourcing guard — must be sourced, not executed (P3)
if [ "${BASH_SOURCE[0]:-}" = "${0}" ]; then
  echo "ERROR: read-hook-input.sh must be sourced, not executed directly" >&2
  exit 1
fi

# Determine python interpreter (P1 graceful degradation)
_HOOK_PY=""
if [ -x ".claude/skills/.venv/bin/python3" ]; then
  _HOOK_PY=".claude/skills/.venv/bin/python3"
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -x "$CLAUDE_PROJECT_DIR/.claude/skills/.venv/bin/python3" ]; then
  _HOOK_PY="$CLAUDE_PROJECT_DIR/.claude/skills/.venv/bin/python3"
elif command -v python3 >/dev/null 2>&1; then
  _HOOK_PY="python3"
elif command -v python >/dev/null 2>&1; then
  _HOOK_PY="python"
fi

# Read all of stdin into a variable, but only if stdin has data pending.
# If stdin is a tty (interactive terminal) or not ready, `cat` would block forever.
# `[ -t 0 ]` detects interactive terminal; we skip reading in that case.
# For hooks invoked by Claude Code, stdin is a pipe with JSON; [ -t 0 ] is false.
if [ -t 0 ]; then
  HOOK_INPUT_RAW=""
else
  HOOK_INPUT_RAW="$(cat 2>/dev/null || true)"
fi

# Default exports (P4 — every field gets a default empty value, no KeyError)
export HOOK_INPUT_RAW
export HOOK_TOOL_NAME=""
export HOOK_FILE_PATH=""
export HOOK_COMMAND=""
export HOOK_SESSION_ID=""
export HOOK_TOOL_USE_ID=""
export HOOK_CWD=""
export HOOK_EVENT_NAME=""
export HOOK_TRANSCRIPT_PATH=""

if [ -z "$_HOOK_PY" ]; then
  echo "WARN: read-hook-input.sh: no python interpreter found; HOOK_* vars empty" >&2
  return 0 2>/dev/null || exit 0
fi

if [ -z "$HOOK_INPUT_RAW" ]; then
  # No stdin — could be a SessionStart hook or a hook with no tool input
  return 0 2>/dev/null || exit 0
fi

# Parse JSON via python (P2 robust try/except)
# Single python invocation extracts all fields and emits shell-safe export lines
_HOOK_PARSED=$("$_HOOK_PY" -c '
import json, sys, shlex

try:
    data = json.loads(sys.stdin.read() or "{}")
except (json.JSONDecodeError, ValueError) as e:
    sys.stderr.write("WARN: read-hook-input.sh: JSON parse failed: " + str(e) + "\n")
    sys.exit(0)

tool_input = data.get("tool_input", {}) or {}

fields = {
    "HOOK_TOOL_NAME":       data.get("tool_name", ""),
    "HOOK_FILE_PATH":       tool_input.get("file_path", ""),
    "HOOK_COMMAND":         tool_input.get("command", ""),
    "HOOK_SESSION_ID":      data.get("session_id", ""),
    "HOOK_TOOL_USE_ID":     data.get("tool_use_id", ""),
    "HOOK_CWD":             data.get("cwd", ""),
    "HOOK_EVENT_NAME":      data.get("hook_event_name", ""),
    "HOOK_TRANSCRIPT_PATH": data.get("transcript_path", ""),
}

for k, v in fields.items():
    # shlex.quote ensures the value is shell-safe
    print(f"export {k}={shlex.quote(str(v))}")
' <<< "$HOOK_INPUT_RAW" 2>/dev/null)

# Eval the export statements (safe — values are shlex-quoted)
if [ -n "$_HOOK_PARSED" ]; then
  eval "$_HOOK_PARSED"
fi

# Cleanup local var
unset _HOOK_PY _HOOK_PARSED

return 0 2>/dev/null || exit 0
