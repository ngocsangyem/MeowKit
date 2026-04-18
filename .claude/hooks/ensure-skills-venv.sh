#!/usr/bin/env bash
# Bootstrap Python venv for skills that depend on it (multimodal, web-to-markdown, etc).
# Fires on SessionStart. Idempotent — no-op after first successful run.
set -euo pipefail
VENV="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/skills/.venv"
if [ ! -x "$VENV/bin/python3" ]; then
  if command -v python3 >/dev/null 2>&1; then
    python3 -m venv "$VENV" >/dev/null 2>&1 || \
      echo "[meowkit] venv creation failed; Python skills disabled until $VENV exists" >&2
  else
    echo "[meowkit] python3 not found; Python skills disabled" >&2
  fi
fi
exit 0
