#!/usr/bin/env bash
# Deterministic checks for mk:freeze's boundary setter.
# Invariant: a path that is not an existing directory is an error that leaves the
# saved boundary untouched. It must never become the "/" boundary, which would
# allow every absolute path while the user is told edits are restricted.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SETTER="$ROOT/.claude/skills/freeze/scripts/set-freeze.cjs"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STATE="$WORK/state"
mkdir -p "$WORK/src"
export CLAUDE_PLUGIN_DATA="$STATE"
export CLAUDE_PROJECT_DIR="$ROOT"

# An existing directory is saved with a trailing slash.
out="$(node "$SETTER" "$WORK/src" 2>&1)"; code=$?
real="$(cd "$WORK/src" && pwd -P)"
if [ "$code" -eq 0 ] && [ "$(cat "$STATE/freeze-dir.txt")" = "$real/" ]; then ok "existing directory is saved with a trailing slash"; else bad "existing directory is saved with a trailing slash ($out)"; fi

# A missing path fails with an error and keeps the previous boundary.
out="$(node "$SETTER" "$WORK/does-not-exist" 2>&1)"; code=$?
if [ "$code" -ne 0 ] && printf '%s' "$out" | grep -q 'not an existing directory'; then ok "missing path stops with an error"; else bad "missing path stops with an error ($out)"; fi
if [ "$(cat "$STATE/freeze-dir.txt")" = "$real/" ]; then ok "failed set keeps the previous boundary"; else bad "failed set keeps the previous boundary"; fi

# A file is not a directory.
touch "$WORK/a-file"
node "$SETTER" "$WORK/a-file" >/dev/null 2>&1; code=$?
if [ "$code" -ne 0 ]; then ok "a file is rejected"; else bad "a file is rejected"; fi

# With no boundary yet, a failed set writes none (it must not create "/").
rm -f "$STATE/freeze-dir.txt"
node "$SETTER" "$WORK/does-not-exist" >/dev/null 2>&1
if [ ! -e "$STATE/freeze-dir.txt" ]; then ok "failed set writes no boundary file"; else bad "failed set writes no boundary file"; fi

# The filesystem root is refused.
node "$SETTER" / >/dev/null 2>&1; code=$?
if [ "$code" -ne 0 ] && [ ! -e "$STATE/freeze-dir.txt" ]; then ok "the filesystem root is refused"; else bad "the filesystem root is refused"; fi

# No argument is a usage error.
node "$SETTER" >/dev/null 2>&1; code=$?
if [ "$code" -eq 2 ]; then ok "no argument is a usage error"; else bad "no argument is a usage error"; fi

# --clear removes the boundary.
node "$SETTER" "$WORK/src" >/dev/null 2>&1
node "$SETTER" --clear >/dev/null 2>&1
if [ ! -e "$STATE/freeze-dir.txt" ]; then ok "--clear removes the boundary"; else bad "--clear removes the boundary"; fi

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
