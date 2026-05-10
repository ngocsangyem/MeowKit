#!/usr/bin/env bash
# smoke-live.sh — manual live-credentials smoke test.
# Run after `npx mewkit setup` + populating .claude/.env.
# Verifies: wrapper resolves, env vars load, Cloud-only gate passes,
# binary returns valid JSON, expected stdout-filter behavior.
#
# This is NOT a CI test — it requires real Confluence credentials and hits
# the Atlassian API. Run manually before declaring the wrapper green.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER="$SCRIPT_DIR/confluence-as.sh"

if [ ! -x "$WRAPPER" ]; then
  echo "FAIL: wrapper not executable at $WRAPPER" >&2
  exit 1
fi

echo "=== smoke 1: space list returns valid JSON ==="
out=$("$WRAPPER" space list)
count=$(printf '%s' "$out" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(len(d.get("spaces", d) if isinstance(d, dict) else d))' 2>/dev/null || echo 0)
if [ "$count" = "0" ] || [ -z "$count" ]; then
  echo "FAIL: space list returned 0 spaces or invalid JSON" >&2
  printf '%s\n' "$out" | head -20 >&2
  exit 1
fi
echo "OK: $count space(s) visible"

echo ""
echo "=== smoke 2: print_success channel detection ==="
echo "Run these manually and inspect output:"
echo "  $WRAPPER space list 2>/dev/null | tail -3"
echo "  → if a non-JSON ✓ line appears: print_success goes to STDOUT"
echo "    set MEOW_CONFLUENCE_STDOUT_FILTER=trim-tail in .claude/.env"
echo "  → if only JSON shows: print_success goes to STDERR (no filter needed)"
