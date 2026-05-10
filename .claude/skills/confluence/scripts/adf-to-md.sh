#!/usr/bin/env bash
# adf-to-md.sh - convert Confluence ADF JSON to macro-aware Markdown.
#
# Modes:
#   stdin:  bash adf-to-md.sh < input.json
#   fetch:  bash adf-to-md.sh --page-id 12345

set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PY="$ROOT/.claude/skills/.venv/bin/python3"
SCRIPT="$ROOT/.claude/skills/confluence/scripts/adf_to_md.py"
WRAPPER="$ROOT/.claude/skills/confluence/scripts/confluence-as.sh"

if [ ! -x "$PY" ]; then
  echo "[adf-to-md] venv not found at $PY - run \`.claude/scripts/bin/setup-workflow\` first" >&2
  exit 127
fi

if [ "${1:-}" = "--page-id" ]; then
  PAGE_ID="${2:-}"
  if [[ ! "$PAGE_ID" =~ ^[0-9]+$ ]]; then
    echo "[adf-to-md] invalid --page-id: must be numeric" >&2
    exit 1
  fi
  RAW=$("$WRAPPER" page get --page-id "$PAGE_ID" --representation atlas_doc_format)
  if ! printf '%s' "$RAW" | jq -e '.body.atlas_doc_format.value' >/dev/null 2>&1; then
    echo "[adf-to-md] body.atlas_doc_format.value missing for page $PAGE_ID -" \
         "page may not support ADF (storage-only, blog, or v1-style)" >&2
    exit 4
  fi
  printf '%s' "$RAW" | jq -r '.body.atlas_doc_format.value' | jq '.' | "$PY" "$SCRIPT"
else
  "$PY" "$SCRIPT"
fi
