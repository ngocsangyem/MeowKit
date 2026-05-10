#!/usr/bin/env bash
# Wraps the venv-local jira-as binary. Sources .claude/.env, translates
# MEOW_JIRA_* → JIRA_* env, sets JIRA_OUTPUT=json default, then exec's.
# Resolves to venv-local binary (NOT PATH) since `mewkit setup` installs
# jira-as into .claude/skills/.venv per skills-dependencies.ts.
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
JIRA_AS="$ROOT/.claude/skills/.venv/bin/jira-as"
ENV_FILE="$ROOT/.claude/.env"

if [ ! -x "$JIRA_AS" ]; then
  echo "[mk:jira] jira-as not installed at $JIRA_AS" >&2
  echo "[mk:jira] Run: npx mewkit setup    (auto-installs from .claude/skills/jira/scripts/requirements.txt)" >&2
  exit 127
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${MEOW_JIRA_API_TOKEN:?MEOW_JIRA_API_TOKEN missing — see .claude/.env.example}"
: "${MEOW_JIRA_EMAIL:?MEOW_JIRA_EMAIL missing}"
: "${MEOW_JIRA_SITE_URL:?MEOW_JIRA_SITE_URL missing}"

export JIRA_API_TOKEN="$MEOW_JIRA_API_TOKEN"
export JIRA_EMAIL="$MEOW_JIRA_EMAIL"
export JIRA_SITE_URL="$MEOW_JIRA_SITE_URL"
export JIRA_OUTPUT="${JIRA_OUTPUT:-json}"

exec "$JIRA_AS" "$@"
