#!/usr/bin/env bash
# Fail the build if hex/rgba color literals appear outside the allowed token
# bridge files. Allowlist is enforced inline below — keep it tight.
#
# Allowed locations:
#   - src/orchviz-web/lib/tokens.generated.ts   (generated source of truth)
#   - src/orchviz-web/lib/colors.ts             (token bridge + Orchviz extensions)
#   - src/orchviz-web/styles/tokens.generated.css
#   - src/orchviz-web/styles/globals.css         (CSS-var driven keyframes only)
#   - src/orchviz-web/components/canvas/        (canvas drawers — explicit alpha rgba ok)
#   - src/orchviz-web/components/drawers/pause-bodies/ (pause-state amber kept inline)
#   - **/__tests__/                              (test fixtures)
#   - lib/canvas-constants.ts                    (FPS overlay; black w/alpha ok)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SEARCH_DIR="$ROOT_DIR/src/orchviz-web"

# grep all hex / rgba / rgb literals
RAW="$(grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" \
  "$SEARCH_DIR" \
  --include="*.ts" --include="*.tsx" --include="*.css" 2>/dev/null || true)"

if [ -z "$RAW" ]; then
  echo "ok: no color literals found"
  exit 0
fi

# Filter out allowlisted paths
FILTERED="$(printf "%s\n" "$RAW" | \
  grep -v "/lib/tokens\.generated\.ts" | \
  grep -v "/lib/colors\.ts" | \
  grep -v "/styles/tokens\.generated\.css" | \
  grep -v "/styles/globals\.css" | \
  grep -v "/components/canvas/" | \
  grep -v "/components/drawers/pause-bodies/" | \
  grep -v "/__tests__/" | \
  grep -v "/lib/canvas-constants\.ts" \
  || true)"

if [ -z "$FILTERED" ]; then
  echo "ok: only allowlisted color literals remain"
  exit 0
fi

echo "FAIL: color literals found outside allowlist:"
echo "---"
printf "%s\n" "$FILTERED"
echo "---"
echo "Replace with COLORS.* from lib/colors.ts or var(--mk-*) from tokens.generated.css."
exit 1
