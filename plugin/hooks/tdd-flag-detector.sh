#!/bin/sh
# tdd-flag-detector.sh — Mechanical sentinel-write for the --tdd flag.
#
# Registered: UserPromptSubmit (always runs before agent sees the prompt).
# Reads the raw user prompt JSON on stdin, extracts the prompt text, scans
# for `--tdd` tokens, and writes the `.claude/session-state/tdd-mode` sentinel
# accordingly. This converts the otherwise-behavioral sentinel mechanism into
# a mechanical preventive control.
#
# Load .claude/.env (each hook is a separate subprocess)
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
#
# Detection rules:
#   - prompt contains `--tdd` (whole word, not `--tdd-something`)  → write 'on'
#   - prompt contains `--no-tdd` or `--tdd=off` or `--tdd off`     → delete sentinel
#   - prompt contains neither                                       → no action
#                                                                     (preserves prior state)
#
# Bypass:
#   - MEOWKIT_TDD env var (set in shell rc / CI) takes precedence and is unaffected
#   - MEOWKIT_TDD_FLAG_DETECTOR=off disables this hook entirely
#
# Graceful degradation: any failure exits 0 silently. Never blocks the agent.

set -u

# Bypass switch
[ "${MEOWKIT_TDD_FLAG_DETECTOR:-on}" = "off" ] && exit 0

# CWD anchor
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  cd "$CLAUDE_PROJECT_DIR" || exit 0
fi

# Read prompt JSON via shared parser shim
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi

# Only act on UserPromptSubmit events (the hook may be wired to other events too)
case "${HOOK_EVENT_NAME:-UserPromptSubmit}" in
  UserPromptSubmit) ;;
  *) exit 0 ;;
esac

# Extract the prompt text. read-hook-input.sh exposes HOOK_INPUT_RAW (JSON) but
# does not parse a 'prompt' field. We grep the raw JSON for the user_prompt
# field as a tolerant heuristic — Claude Code emits `"prompt":"..."` in the
# UserPromptSubmit event payload.
prompt_text=""
if [ -n "${HOOK_INPUT_RAW:-}" ]; then
  # Use python for robust JSON parse if available; fall back to grep
  PY=""
  if [ -x ".claude/skills/.venv/bin/python3" ]; then
    PY=".claude/skills/.venv/bin/python3"
  elif command -v python3 >/dev/null 2>&1; then
    PY="python3"
  fi
  if [ -n "$PY" ]; then
    prompt_text=$(printf '%s' "$HOOK_INPUT_RAW" | "$PY" -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("prompt", "") or d.get("user_prompt", "") or "")
except Exception:
    pass
' 2>/dev/null)
  fi
  # Fallback: extract via grep if python parse failed
  if [ -z "$prompt_text" ]; then
    prompt_text=$(printf '%s' "$HOOK_INPUT_RAW" | grep -oE '"(prompt|user_prompt)":"[^"]*"' | head -1 || true)
  fi
fi

# Empty prompt (e.g., SessionStart relay) → no action
[ -z "$prompt_text" ] && exit 0

# Sentinel target
sentinel_dir="${CLAUDE_PROJECT_DIR:-.}/.claude/session-state"
sentinel="$sentinel_dir/tdd-mode"

# Detect --no-tdd / --tdd=off / --tdd off → delete sentinel
case "$prompt_text" in
  *"--no-tdd"*|*"--tdd=off"*|*"--tdd off"*)
    if [ -f "$sentinel" ]; then
      rm -f "$sentinel" 2>/dev/null && echo "[tdd] sentinel cleared by --no-tdd / --tdd=off" >&2
    fi
    exit 0
    ;;
esac

# Detect --tdd as whole word (not --tdd-foo, not --tdd= prefix unless =on/=true)
case "$prompt_text" in
  *"--tdd"\ *|*"--tdd"|*"--tdd"$'\t'*)
    mkdir -p "$sentinel_dir" 2>/dev/null || exit 0
    echo on > "$sentinel" 2>/dev/null
    echo "[tdd] sentinel written by --tdd flag (mechanical detection)" >&2
    ;;
  *"--tdd=on"*|*"--tdd=true"*|*"--tdd=1"*)
    mkdir -p "$sentinel_dir" 2>/dev/null || exit 0
    echo on > "$sentinel" 2>/dev/null
    echo "[tdd] sentinel written by --tdd= flag (mechanical detection)" >&2
    ;;
esac

exit 0
