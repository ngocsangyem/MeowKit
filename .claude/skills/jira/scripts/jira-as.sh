#!/usr/bin/env bash
# Wraps the jira-as binary. Reads the env files (project .meowkit/.env, the pre-move
# .claude/.env, then ~/.meowkit/.env), translates
# MEOW_JIRA_* → JIRA_* env, sets JIRA_OUTPUT=json default, then exec's.
#
# Resolved from THIS SKILL's own environment, never from PATH: the binary is
# installed by `mewkit skill env jira` from this skill's pinned requirements, and
# a `jira-as` that happens to be on PATH is some other installation with some
# other version.
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
JIRA_AS="$ROOT/.meowkit/envs/jira/bin/jira-as"

if [ ! -x "$JIRA_AS" ]; then
  echo "[jira] jira-as not installed at $JIRA_AS" >&2
  echo "[jira] Run: mewkit skill env jira" >&2
  echo "[jira] That installs only what .claude/skills/jira/scripts/requirements.txt pins." >&2
  exit 127
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

: "${MEOW_JIRA_API_TOKEN:?MEOW_JIRA_API_TOKEN missing — see .meowkit/.env.example}"
: "${MEOW_JIRA_EMAIL:?MEOW_JIRA_EMAIL missing}"
: "${MEOW_JIRA_SITE_URL:?MEOW_JIRA_SITE_URL missing}"

export JIRA_API_TOKEN="$MEOW_JIRA_API_TOKEN"
export JIRA_EMAIL="$MEOW_JIRA_EMAIL"
export JIRA_SITE_URL="$MEOW_JIRA_SITE_URL"
export JIRA_OUTPUT="${JIRA_OUTPUT:-json}"

exec "$JIRA_AS" "$@"
