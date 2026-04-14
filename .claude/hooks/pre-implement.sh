#!/bin/sh
# pre-implement.sh — Blocks implementation if no failing test exists for the current feature.
# Usage: pre-implement.sh <feature-name-or-file-path>
#
# This hook is OPT-IN (TDD-optional migration).
# Default: exits 0 silently. Opt in via:
#   - export MEOWKIT_TDD=1                          (CI / shell rc)
#   - echo on > .claude/session-state/tdd-mode      (slash command --tdd flag)
#   - MEOW_PROFILE=fast still bypasses (legacy, deprecated)
#
# When TDD is enabled, blocks the calling tool unless a failing test exists.
set -e

# Load .claude/.env — this script is invoked manually by the developer agent
# (not wired to a system event), so CLAUDE_PROJECT_DIR may or may not be set.
# Fall back to script-relative resolution.
# [M-1 GUARD] Skip .env load if project root doesn't contain .claude/ (catches
# symlinked installs where ../../ walks into the install source, not the user project).
_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
_PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$_SCRIPT_DIR/../.." && pwd 2>/dev/null || echo .)}"
if [ -d "$_PROJECT_ROOT/.claude" ] && [ -f "$_PROJECT_ROOT/.claude/hooks/lib/load-dotenv.sh" ]; then
  CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$_PROJECT_ROOT}" \
    . "$_PROJECT_ROOT/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
fi
unset _SCRIPT_DIR _PROJECT_ROOT

# TDD gate — source the helper. Fail-safe: missing helper means fail-CLOSED in
# strict mode (user explicitly opted in) and fail-OPEN in default mode.
HELPER="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/tdd-detect.sh"
if [ ! -f "$HELPER" ]; then
  echo "[tdd] WARN: tdd-detect.sh missing at $HELPER" >&2
  if [ "${MEOWKIT_TDD:-}" = "1" ]; then
    echo "BLOCKED: TDD helper missing, cannot verify strict mode" >&2
    exit 1
  fi
  exit 0
fi

# shellcheck source=lib/tdd-detect.sh
. "$HELPER"
if ! is_tdd_enabled; then
  exit 0
fi

# At this point: TDD mode is ON (env or sentinel). Proceed with the check.

# Phase 7 (260408): JSON-on-stdin parser; prefer $HOOK_FILE_PATH, fall back to $1.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
FEATURE="${HOOK_FILE_PATH:-$1}"

if [ -z "$FEATURE" ]; then
  echo "Usage: pre-implement.sh <feature-name-or-file-path>"
  exit 1
fi

# Extract a simple name from a file path if given.
# inject ANSI escape sequences into terminal output of subsequent echo lines.
FEATURE_NAME=$(basename "$FEATURE" | sed 's/\.[^.]*$//' | tr -cd '[:alnum:]._-')

echo "Checking for failing tests for: $FEATURE_NAME"

# Search for test files referencing the feature
FOUND_TESTS=""

for dir in __tests__ tests; do
  if [ -d "$dir" ]; then
    matches=$(grep -rl "$FEATURE_NAME" "$dir" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      FOUND_TESTS="$matches"
    fi
  fi
done

# Also search for *.test.ts, *.spec.ts, *.test.swift in current tree
if [ -z "$FOUND_TESTS" ]; then
  matches=$(find . -type f \( -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.swift" -o -name "*.test.js" -o -name "*.spec.js" -o -name "*.test.py" \) -exec grep -l "$FEATURE_NAME" {} + 2>/dev/null || true)
  if [ -n "$matches" ]; then
    FOUND_TESTS="$matches"
  fi
fi

if [ -z "$FOUND_TESTS" ]; then
  echo "BLOCKED: TDD mode is ON but no test file found for [$FEATURE_NAME]." >&2
  echo "Write failing tests first (Phase 2), or unset MEOWKIT_TDD / drop --tdd to proceed without TDD gate." >&2
  exit 1
fi

echo "Found test files referencing $FEATURE_NAME. Running test suite..."

# Detect test runner and run tests
TEST_EXIT=0

if [ -f "package.json" ]; then
  # Check for vitest or jest
  if grep -q '"vitest"' package.json 2>/dev/null; then
    npx vitest run 2>&1 || TEST_EXIT=$?
  elif grep -q '"jest"' package.json 2>/dev/null; then
    npx jest 2>&1 || TEST_EXIT=$?
  elif grep -q '"test"' package.json 2>/dev/null; then
    npm test 2>&1 || TEST_EXIT=$?
  else
    echo "No test runner detected in package.json."
    TEST_EXIT=0
  fi
elif [ -f "Package.swift" ]; then
  swift test 2>&1 || TEST_EXIT=$?
elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "pytest.ini" ]; then
  pytest 2>&1 || TEST_EXIT=$?
else
  echo "No recognized test runner found."
  TEST_EXIT=0
fi

if [ "$TEST_EXIT" -eq 0 ]; then
  echo "BLOCKED: TDD mode requires failing tests before implementation." >&2
  echo "Your tests are passing — they don't test new behavior yet." >&2
  echo "Unset MEOWKIT_TDD or drop --tdd to proceed without TDD gate." >&2
  exit 1
else
  echo "PASS: Failing tests confirmed. Proceeding to implementation."
  exit 0
fi
