#!/bin/sh
# validate-bootstrap.sh — Post-scaffold validation (deterministic)
# Exits 0 = BOOTSTRAP_VALID, 1 = BOOTSTRAP_INCOMPLETE
# Usage: validate-bootstrap.sh [project-dir]

set -e

DIR="${1:-.}"
ERRORS=""

# Check basic structure exists
check_exists() {
  if [ ! -e "$DIR/$1" ]; then
    ERRORS="${ERRORS}\n  MISSING: $1"
  fi
}

# Check no placeholder tokens remain in generated files
check_placeholders() {
  FOUND=$(grep -rlE '\[TODO\]|\[PROJECT_NAME\]|\[PLACEHOLDER\]' "$DIR/src" "$DIR/tests" 2>/dev/null || true)
  if [ -n "$FOUND" ]; then
    ERRORS="${ERRORS}\n  PLACEHOLDER_LEAK: $FOUND"
  fi
}

# Basic checks — any project should have these after bootstrap
check_exists "src"
check_exists "tests"

# Check for at least one source file
SRC_COUNT=$(find "$DIR/src" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$SRC_COUNT" = "0" ] 2>/dev/null; then
  ERRORS="${ERRORS}\n  EMPTY: src/ has no files"
fi

# Check placeholders only if src/ exists
if [ -d "$DIR/src" ]; then
  check_placeholders
fi

# Report
if [ -z "$ERRORS" ]; then
  echo "BOOTSTRAP_VALID"
  exit 0
else
  echo "BOOTSTRAP_INCOMPLETE:$ERRORS"
  exit 1
fi
