#!/bin/bash
# Brand-prose lint for the toolkit .claude/ markdown source tree.
# Delegates all checks to check-anthropic-context.py because path-glob allowlist
# matching needs PurePosixPath semantics that bash + grep --exclude can't model.
#
# Exit 0 = clean tree. Exit 1 = violations found. Exit 2 = misconfigured.
# Run from the meowkit/ working directory.

set -euo pipefail

ROOT=".claude"
ALLOWLIST=".claude/.brand-allowlist.txt"
PY_HELPER=".claude/scripts/check-anthropic-context.py"

if [ ! -d "$ROOT" ]; then
  echo "lint-brand-prose: $ROOT not found (run from meowkit/ working directory)" >&2
  exit 2
fi

if [ ! -f "$PY_HELPER" ]; then
  echo "lint-brand-prose: $PY_HELPER missing" >&2
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "lint-brand-prose: python3 required but not on PATH" >&2
  exit 2
fi

HITS=$(python3 "$PY_HELPER" "$ROOT" "$ALLOWLIST")

if [ -n "$HITS" ]; then
  echo "Brand-prose violations:"
  echo "$HITS"
  echo ""
  echo "See docs/branding-style-guide.md for replacement rules."
  echo "Or add the file to $ALLOWLIST if it is toolkit-internal navigation."
  exit 1
fi

echo "lint-brand-prose: clean."
exit 0
