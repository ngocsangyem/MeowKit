#!/usr/bin/env bash
# Restrict diagnostic-only investigations to their report directory.
set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel):-$(pwd)}"
cd "$PROJECT_ROOT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_INPUT_HELPER="$SCRIPT_DIR/../../../hooks/lib/read-hook-input.sh"
if [ ! -f "$HOOK_INPUT_HELPER" ]; then
  HOOK_INPUT_HELPER="$PROJECT_ROOT/.codex/hooks/lib/read-hook-input.sh"
fi

if [ ! -f "$HOOK_INPUT_HELPER" ]; then
  printf '%s\n' '{"permissionDecision":"deny","message":"[investigate] Cannot verify the report path."}'
  exit 2
fi

. "$HOOK_INPUT_HELPER"

if [ -z "${HOOK_FILE_PATH:-}" ]; then
  printf '%s\n' '{"permissionDecision":"deny","message":"[investigate] A diagnostic report path is required."}'
  exit 2
fi

if python3 - "$PROJECT_ROOT" "$HOOK_FILE_PATH" <<'PY'
import os
import sys

root, requested = sys.argv[1:]
target = requested if os.path.isabs(requested) else os.path.join(root, requested)
allowed = os.path.realpath(os.path.join(root, "tasks", "reports"))
target = os.path.realpath(target)
sys.exit(0 if os.path.commonpath((allowed, target)) == allowed else 1)
PY
then
  printf '%s\n' '{}'
  exit 0
fi

printf '%s\n' '{"permissionDecision":"deny","message":"[investigate] Only diagnostic reports under tasks/reports/** may be written."}'
exit 2
