#!/usr/bin/env bash
# SessionStart hook: validate .claude/.env presence + 3 MEOW_JIRA_* vars.
# Reads JSON stdin per MeowKit convention (lib/read-hook-input.sh).
# Does NOT export — each hook is a separate subprocess (per
# project-context-loader.sh comment); the wrapper handles per-call export.
set -euo pipefail

. "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/lib/read-hook-input.sh" 2>/dev/null || true

ENV_FILE="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "[mk:jira] .claude/.env missing — see .claude/.env.example for setup"
  exit 0
fi

# Probe for the 3 required keys without sourcing (avoids polluting the hook subshell)
for key in MEOW_JIRA_API_TOKEN MEOW_JIRA_EMAIL MEOW_JIRA_SITE_URL; do
  if ! grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "[mk:jira] $key missing in .claude/.env"
    exit 0
  fi
done
echo "[mk:jira] env OK"
exit 0
