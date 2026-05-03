#!/usr/bin/env bash
# Sanitization-bypass guard.
#
# The orchviz-web bundle MUST receive data only via useEventSource (SSE),
# which guarantees server-side sanitization. Any direct fs / fetch / dynamic
# import inside this bundle bypasses sanitization and is a finding.
#
# Allowlist:
#   - hooks/use-event-source.ts (uses EventSource, not fetch)
#   - hooks/use-active-plan.ts / use-available-plans.ts (read sanitized plan API)
#   - hooks/use-todo-writer.ts (writes sanitized todo updates)
#   - **/__tests__/ (test fixtures may stub fs)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SEARCH_DIR="$ROOT_DIR/src/orchviz-web"

RAW="$(grep -rnE "\bfs\.|\bnew XMLHttpRequest\b|\bfetch\(" \
  "$SEARCH_DIR" \
  --include="*.ts" --include="*.tsx" 2>/dev/null || true)"

if [ -z "$RAW" ]; then
  echo "ok: no direct I/O found"
  exit 0
fi

FILTERED="$(printf "%s\n" "$RAW" | \
  grep -v "/hooks/use-event-source\.ts" | \
  grep -v "/hooks/use-active-plan\.ts" | \
  grep -v "/hooks/use-available-plans\.ts" | \
  grep -v "/hooks/use-todo-writer\.ts" | \
  grep -v "/hooks/use-overlays\.ts" | \
  grep -v "/__tests__/" \
  || true)"

if [ -z "$FILTERED" ]; then
  echo "ok: only allowlisted I/O paths"
  exit 0
fi

echo "FAIL: direct I/O found in orchviz-web outside allowlist:"
echo "---"
printf "%s\n" "$FILTERED"
echo "---"
echo "All inbound data MUST flow through useEventSource (SSE) for sanitization."
exit 1
