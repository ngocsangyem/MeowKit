#!/bin/bash
# post-write-build-verify.sh — Auto-run compile/lint after Edit/Write on source files.
# Phase 7 middleware (Anthropic + LangChain harness research +10.8 pts measured).
#
# Registered: PostToolUse on Edit|Write matcher.
# Input: JSON on stdin (parsed via lib/read-hook-input.sh).
# Behavior: classify file by extension → run compile/lint → emit errors to stdout.
# Never blocks — errors feed back to agent via stdout injection.
# Cached by file content hash to avoid re-running on unchanged files.
#
# Env vars:
#   MEOWKIT_BUILD_VERIFY=off            — skip entirely
#   MEOWKIT_BUILD_VERIFY_TIMEOUT=N      — override timeout
#   MEOWKIT_BUILD_VERIFY_DEBUG=1        — verbose stderr

set -u

# Ensure CWD is project root
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Bypass
[ "${MEOWKIT_BUILD_VERIFY:-on}" = "off" ] && exit 0

# Density bypass — LEAN runs BuildVerify, MINIMAL skips
case "${MEOWKIT_HARNESS_MODE:-}" in
  MINIMAL) exit 0 ;;
esac

# Parse JSON on stdin
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
FILE="${HOOK_FILE_PATH:-$1}"

# Safety fallback — if no file path, skip
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# Skip non-source paths
case "$FILE" in
  */node_modules/*|*/.venv/*|*/venv/*|*/vendor/*|*/target/*|*/dist/*|*/build/*|*/.next/*|*/out/*) exit 0 ;;
  */tasks/*|*/docs/*|*/.claude/*|*/plans/*) exit 0 ;;
  *.test.*|*.spec.*|*/__tests__/*|*/tests/*) exit 0 ;;
  *.min.js|*.map|*.lock) exit 0 ;;
esac

# Classify by extension + pick commands
EXT="${FILE##*.}"
COMMANDS=""
TIMEOUT_SEC=30
case "$EXT" in
  ts|tsx)   COMMANDS="tsc --noEmit|eslint" ;;
  js|jsx|mjs|cjs) COMMANDS="eslint" ; TIMEOUT_SEC=15 ;;
  py)       COMMANDS="ruff check|mypy" ;;
  go)       COMMANDS="go build ./..." ;;
  rs)       COMMANDS="cargo check" ; TIMEOUT_SEC=60 ;;
  rb)       COMMANDS="ruby -c|rubocop" ; TIMEOUT_SEC=20 ;;
  *)        exit 0 ;;  # unknown extension → silent skip
esac

# Timeout override
TIMEOUT_SEC="${MEOWKIT_BUILD_VERIFY_TIMEOUT:-$TIMEOUT_SEC}"

# Cache check — skip if file content hash unchanged from last run
CACHE_DIR="session-state"
CACHE_FILE="$CACHE_DIR/build-verify-cache.json"
mkdir -p "$CACHE_DIR"
[ -f "$CACHE_FILE" ] || echo '{}' > "$CACHE_FILE"

# Compute file hash (md5 works on both macOS and Linux via different commands)
if command -v md5 >/dev/null 2>&1; then
  HASH=$(md5 -q "$FILE" 2>/dev/null || md5 < "$FILE" | awk '{print $1}')
elif command -v md5sum >/dev/null 2>&1; then
  HASH=$(md5sum "$FILE" 2>/dev/null | awk '{print $1}')
else
  HASH=""
fi

# Check cache via python (avoid jq dependency)
if [ -n "$HASH" ]; then
  PY=".claude/skills/.venv/bin/python3"
  [ -x "$PY" ] || PY="python3"
  CACHED=$("$PY" -c "
import json, sys
try:
    with open('$CACHE_FILE') as f:
        d = json.load(f)
    print(d.get('$FILE', ''))
except Exception:
    print('')
" 2>/dev/null)
  if [ "$CACHED" = "$HASH" ]; then
    [ "${MEOWKIT_BUILD_VERIFY_DEBUG:-}" = "1" ] && echo "cache hit: $FILE" >&2
    exit 0
  fi
fi

# Run commands sequentially; first non-zero exit short-circuits
IFS='|' read -ra CMD_LIST <<< "$COMMANDS"
OUTPUT=""
EXIT_CODE=0
for CMD in "${CMD_LIST[@]}"; do
  # Extract first word as the tool; check if available
  TOOL=$(echo "$CMD" | awk '{print $1}')
  if ! command -v "$TOOL" >/dev/null 2>&1; then
    [ "${MEOWKIT_BUILD_VERIFY_DEBUG:-}" = "1" ] && echo "tool not found: $TOOL (skipping $CMD)" >&2
    continue
  fi

  # Preserve tool-lookup env vars used by version managers (nvm, pyenv, asdf, volta,
  # cargo, rustup, go, virtualenv). Previously `env -i PATH=$PATH HOME=$HOME` stripped
  # these and broke real-world builds where tools are installed via version managers.
  BV_ENV_PASS="PATH=$PATH HOME=$HOME USER=${USER:-} LANG=${LANG:-} LC_ALL=${LC_ALL:-}"
  for v in NVM_DIR PYENV_ROOT ASDF_DIR VOLTA_HOME CARGO_HOME RUSTUP_HOME GOPATH GOROOT VIRTUAL_ENV NODE_PATH; do
    eval "val=\${$v:-}"
    [ -n "${val:-}" ] && BV_ENV_PASS="$BV_ENV_PASS $v=$val"
  done

  if command -v timeout >/dev/null 2>&1; then
    RUN_OUT=$(env -i $BV_ENV_PASS timeout "$TIMEOUT_SEC" $CMD "$FILE" 2>&1) || EXIT_CODE=$?
  elif command -v gtimeout >/dev/null 2>&1; then
    RUN_OUT=$(env -i $BV_ENV_PASS gtimeout "$TIMEOUT_SEC" $CMD "$FILE" 2>&1) || EXIT_CODE=$?
  else
    RUN_OUT=$(env -i $BV_ENV_PASS $CMD "$FILE" 2>&1) || EXIT_CODE=$?
  fi
  OUTPUT="$OUTPUT$RUN_OUT"
  [ "$EXIT_CODE" -ne 0 ] && break  # short-circuit on first failure
done

# Emit errors if any; otherwise cache the clean hash
if [ "$EXIT_CODE" -ne 0 ]; then
  echo "@@BUILD_VERIFY_ERROR@@"
  echo "file: $FILE"
  echo "exit_code: $EXIT_CODE"
  echo ""
  echo "$OUTPUT" | head -50
  echo "@@END_BUILD_VERIFY@@"

  # Phase 8 (260408): emit canonical `build_verify_result` trace record per
  # trace-schema.md ownership table. Only emits on FAILURE — clean builds skip.
  if [ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" ]; then
    bash "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/append-trace.sh" "build_verify_result" \
      "{\"file\":\"$FILE\",\"exit_code\":$EXIT_CODE}" 2>/dev/null || true
  fi
else
  # Update cache with new hash
  if [ -n "$HASH" ]; then
    "$PY" -c "
import json
try:
    with open('$CACHE_FILE') as f:
        d = json.load(f)
except Exception:
    d = {}
d['$FILE'] = '$HASH'
with open('$CACHE_FILE', 'w') as f:
    json.dump(d, f)
" 2>/dev/null || true
  fi
fi

exit 0
