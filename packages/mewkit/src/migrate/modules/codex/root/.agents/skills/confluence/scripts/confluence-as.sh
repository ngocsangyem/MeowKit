#!/usr/bin/env bash
# confluence-as.sh — env-translating wrapper for the confluence-as binary.
# Mirrors jira-as.sh shape. Adds: Cloud-only URL gate, plaintext fallback rejection,
# stdout filter for the trailing print_success line emitted on success.
#
# Binary name is confluence-as (provided by the confluence-assistant-skills PyPI
# package — the upstream README that says `confluence` is wrong; verified by
# empirical install).

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel):-$(pwd)}"
CONFLUENCE_AS="$ROOT/.agents/skills/.venv/bin/confluence-as"
ENV_FILE="$ROOT/.codex/.env"
LOCAL_SETTINGS="$ROOT/.codex/settings.local.json"

if [ ! -x "$CONFLUENCE_AS" ]; then
  echo "[mk:confluence] confluence-as not installed at $CONFLUENCE_AS" >&2
  echo "[mk:confluence] Run: .codex/scripts/bin/setup-workflow    (auto-installs from .agents/skills/confluence/scripts/requirements.txt)" >&2
  exit 127
fi

# Refuse plaintext credential fallback in settings.local.json (security override of upstream default)
if [ -f "$LOCAL_SETTINGS" ] && grep -q "CONFLUENCE_API_TOKEN" "$LOCAL_SETTINGS" 2>/dev/null; then
  echo "[mk:confluence] credentials must live in .codex/.env, not .codex/settings.local.json" >&2
  echo "[mk:confluence] Move CONFLUENCE_* vars to .codex/.env (chmod 0600 recommended), then retry." >&2
  exit 2
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${MEOW_CONFLUENCE_API_TOKEN:?MEOW_CONFLUENCE_API_TOKEN missing — see .codex/.env.example}"
: "${MEOW_CONFLUENCE_EMAIL:?MEOW_CONFLUENCE_EMAIL missing}"
: "${MEOW_CONFLUENCE_SITE_URL:?MEOW_CONFLUENCE_SITE_URL missing}"

# Cloud-only gate — refuse Server/DC URLs at exec time
case "$MEOW_CONFLUENCE_SITE_URL" in
  *.atlassian.net|*.atlassian.net/*) ;;
  *)
    echo "[mk:confluence] Cloud-only — site URL must end in .atlassian.net" >&2
    echo "[mk:confluence] Detected: $MEOW_CONFLUENCE_SITE_URL" >&2
    echo "[mk:confluence] For Server/DC, use MCP Atlassian per references/install-and-auth.md" >&2
    exit 3
    ;;
esac

export CONFLUENCE_API_TOKEN="$MEOW_CONFLUENCE_API_TOKEN"
export CONFLUENCE_EMAIL="$MEOW_CONFLUENCE_EMAIL"
export CONFLUENCE_SITE_URL="$MEOW_CONFLUENCE_SITE_URL"
export CONFLUENCE_OUTPUT="${CONFLUENCE_OUTPUT:-json}"

# Stdout-filter mode (controls print_success trailing-line stripping):
#   off       — pass through raw (default until empirical channel verified)
#   trim-tail — strip the last stdout line (use only after smoke-live.sh confirms
#               print_success goes to stdout, not stderr)
FILTER_MODE="${MEOW_CONFLUENCE_STDOUT_FILTER:-off}"

if [ "$FILTER_MODE" = "off" ]; then
  exec "$CONFLUENCE_AS" "$@"
fi

# trim-tail mode: capture, drop trailing line, validate JSON, emit clean
RAW=$("$CONFLUENCE_AS" "$@")
RC=$?
if [ $RC -ne 0 ]; then
  printf '%s\n' "$RAW"
  exit $RC
fi
TRIMMED=$(printf '%s\n' "$RAW" | sed '$d')
if printf '%s' "$TRIMMED" | python3 -c 'import json,sys; json.loads(sys.stdin.read())' 2>/dev/null; then
  printf '%s\n' "$TRIMMED"
else
  echo "[mk:confluence] WARN: trim-tail filter produced invalid JSON; passing raw" >&2
  printf '%s\n' "$RAW"
fi
