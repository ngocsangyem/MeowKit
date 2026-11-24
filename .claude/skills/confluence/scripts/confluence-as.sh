#!/usr/bin/env bash
# confluence-as.sh — env-translating wrapper for the confluence-as binary.
# Mirrors jira-as.sh shape. Adds: Cloud-only URL gate, plaintext fallback rejection,
# stdout filter for the trailing print_success line emitted on success.
#
# Binary name is confluence-as (provided by the confluence-assistant-skills PyPI
# package — the upstream README that says `confluence` is wrong; verified by
# empirical install).

set -euo pipefail

# The project root: the runtime's project variable, else the nearest folder above the
# working directory that holds `.meowkit/`, else the working directory.
find_root() {
  local dir="$PWD" depth=0
  while [ "$depth" -lt 12 ] && [ "$dir" != "/" ]; do
    if [ -d "$dir/.meowkit" ] && [ "$dir" != "${HOME:-}" ]; then printf '%s\n' "$dir"; return; fi
    dir="$(dirname "$dir")"; depth=$((depth + 1))
  done
  printf '%s\n' "$PWD"
}
ROOT="${MEOWKIT_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-${CURSOR_PROJECT_DIR:-$(find_root)}}}"
CONFLUENCE_AS="$ROOT/.meowkit/envs/confluence/bin/confluence-as"
LOCAL_SETTINGS="$ROOT/.claude/settings.local.json"

if [ ! -x "$CONFLUENCE_AS" ]; then
  echo "[mk:confluence] confluence-as not installed at $CONFLUENCE_AS" >&2
  echo "[mk:confluence] Run: mewkit skill env confluence    (installs from .claude/skills/confluence/scripts/requirements.txt)" >&2
  exit 127
fi

# Refuse plaintext credential fallback in settings.local.json (security override of upstream default)
if [ -f "$LOCAL_SETTINGS" ] && grep -q "CONFLUENCE_API_TOKEN" "$LOCAL_SETTINGS" 2>/dev/null; then
  echo "[mk:confluence] credentials must live in .meowkit/.env, not in settings.local.json" >&2
  echo "[mk:confluence] Move them to .meowkit/.env as MEOW_CONFLUENCE_* (chmod 0600 recommended), then retry." >&2
  exit 2
fi

# Env files, highest priority first. A shell export beats all of them and the first
# file to set a key wins, so a project value beats the user-wide one. The files are
# parsed as KEY=VALUE lines, never sourced: sourcing would run any shell code in them.
ENV_FILES=("$ROOT/.meowkit/.env" "$ROOT/.claude/.env" "${HOME:-}/.meowkit/.env")
REFUSED_KEYS=" PATH LD_PRELOAD LD_LIBRARY_PATH DYLD_INSERT_LIBRARIES DYLD_FRAMEWORK_PATH IFS BASH_ENV ENV "

load_env_file() {
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in '' | '#'*) continue ;; esac
    case "$line" in 'export '*) line="${line#export }" ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    case "$REFUSED_KEYS" in *" $key "*) continue ;; esac
    [ -n "${!key+x}" ] && continue
    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [ "${#value}" -ge 2 ] && { [[ "$value" == \"*\" ]] || [[ "$value" == \'*\' ]]; }; then
      value="${value:1:${#value}-2}"
    else
      value="${value%%[[:space:]]#*}"
    fi
    export "$key=$value"
  done < "$1"
}

for ENV_FILE in "${ENV_FILES[@]}"; do
  if [ -f "$ENV_FILE" ]; then load_env_file "$ENV_FILE"; fi
done

: "${MEOW_CONFLUENCE_API_TOKEN:?MEOW_CONFLUENCE_API_TOKEN missing — see .meowkit/.env.example}"
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

# `adf-get <page-id>`: the CLI's `page get` has no ADF body format, so this mode reads
# the page through the package's client (fetch_adf.py) with the same credentials and gates.
if [ "${1:-}" = "adf-get" ]; then
  exec "$ROOT/.meowkit/envs/confluence/bin/python3" "$ROOT/.claude/skills/confluence/scripts/fetch_adf.py" "${2:-}"
fi

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
