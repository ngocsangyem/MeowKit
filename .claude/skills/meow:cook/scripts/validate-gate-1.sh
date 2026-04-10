#!/bin/sh
# validate-gate-1.sh — Check plan.md has required sections for Gate 1 approval
# Usage: sh validate-gate-1.sh <path-to-plan.md>
# Exit 0 = GATE_1_READY, Exit 1 = GATE_1_BLOCKED

set -e

PLAN_FILE="${1:?Usage: validate-gate-1.sh <path-to-plan.md>}"

if [ ! -f "$PLAN_FILE" ]; then
  echo "GATE_1_BLOCKED: Plan file not found: $PLAN_FILE"
  exit 1
fi

MISSING=""

# Check required sections (case-insensitive grep)
for section in "Problem" "Success Criteria" "Technical Approach"; do
  if ! grep -qiE "## .*${section}|# .*${section}" "$PLAN_FILE" 2>/dev/null; then
    # Also check for common variants
    case "$section" in
      "Problem") grep -qiE "## Problem|## Goal|## Overview" "$PLAN_FILE" 2>/dev/null || MISSING="$MISSING $section" ;;
      "Success Criteria") grep -qiE "Success Criteria|Acceptance Criteria|Definition of Done" "$PLAN_FILE" 2>/dev/null || MISSING="$MISSING $section" ;;
      "Technical Approach") grep -qiE "Technical Approach|Architecture|Implementation|## Phases" "$PLAN_FILE" 2>/dev/null || MISSING="$MISSING $section" ;;
    esac
  fi
done

# Check plan is not empty (more than just frontmatter)
CONTENT_LINES=$(grep -cvE '^---$|^$|^#' "$PLAN_FILE" 2>/dev/null || echo "0")
if [ "$CONTENT_LINES" -lt 5 ]; then
  MISSING="$MISSING substantive-content(min-5-lines)"
fi

if [ -n "$MISSING" ]; then
  echo "GATE_1_BLOCKED: Missing sections:$MISSING"
  exit 1
fi

echo "GATE_1_READY"
exit 0
