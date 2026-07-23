#!/usr/bin/env bash
# Wraps the venv-local jira-as binary. Sources .codex/.env, translates
# MEOW_JIRA_* → JIRA_* env, sets JIRA_OUTPUT=json default, then exec's.
# Resolves to venv-local binary (NOT PATH) since `.codex/scripts/bin/setup-workflow` installs
# jira-as into .agents/skills/.venv per skills-dependencies.ts.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel):-$(pwd)}"
JIRA_AS="$ROOT/.agents/skills/.venv/bin/jira-as"
ENV_FILE="$ROOT/.codex/.env"

if [ ! -x "$JIRA_AS" ]; then
  echo "[mk:jira] jira-as not installed at $JIRA_AS" >&2
  echo "[mk:jira] Run: .codex/scripts/bin/setup-workflow    (auto-installs from .agents/skills/jira/scripts/requirements.txt)" >&2
  exit 127
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${MEOW_JIRA_API_TOKEN:?MEOW_JIRA_API_TOKEN missing — see .codex/.env.example}"
: "${MEOW_JIRA_EMAIL:?MEOW_JIRA_EMAIL missing}"
: "${MEOW_JIRA_SITE_URL:?MEOW_JIRA_SITE_URL missing}"

export JIRA_API_TOKEN="$MEOW_JIRA_API_TOKEN"
export JIRA_EMAIL="$MEOW_JIRA_EMAIL"
export JIRA_SITE_URL="$MEOW_JIRA_SITE_URL"
export JIRA_OUTPUT="${JIRA_OUTPUT:-json}"

exec "$JIRA_AS" "$@"
