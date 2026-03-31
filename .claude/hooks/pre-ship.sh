#!/bin/sh
# pre-ship.sh — Run full test + lint + typecheck before shipping.
# Usage: pre-ship.sh [command]
# When registered as PreToolUse hook on Bash, $1 = the bash command.
# Only triggers on git commit/push commands. Exits 0 for everything else.

COMMAND="$1"

# Only run pre-ship checks on git commit or push commands
case "$COMMAND" in
  *"git commit"*|*"git push"*|*"git merge"*) ;;
  *) exit 0 ;; # Not a ship command — skip
esac

CHECKS_RUN=""
CHECKS_FAILED=""
FAIL_COUNT=0

run_check() {
  _name="$1"
  shift
  echo "Running: $_name"
  CHECKS_RUN="$CHECKS_RUN $_name"

  if "$@" > /dev/null 2>&1; then
    echo "  PASS: $_name"
  else
    echo "  FAIL: $_name"
    CHECKS_FAILED="$CHECKS_FAILED $_name"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# Check for script existence helper
has_npm_script() {
  _script="$1"
  if [ -f "package.json" ]; then
    grep -q "\"$_script\"" package.json 2>/dev/null
    return $?
  fi
  return 1
}

command_exists() {
  command -v "$1" > /dev/null 2>&1
}

echo "=== Pre-Ship Checks ==="
echo ""

# Detect project type and run appropriate checks
if [ -f "package.json" ]; then
  echo "Detected: Node.js project"
  echo ""

  # Tests
  if has_npm_script "test"; then
    run_check "npm test" npm test
  else
    echo "SKIP: No test script in package.json"
  fi

  # Lint
  if has_npm_script "lint"; then
    run_check "npm run lint" npm run lint
  else
    echo "SKIP: No lint script in package.json"
  fi

  # TypeScript
  if [ -f "tsconfig.json" ]; then
    run_check "tsc --noEmit" npx tsc --noEmit
  else
    echo "SKIP: No tsconfig.json found"
  fi
fi

if [ -f "Package.swift" ]; then
  echo "Detected: Swift project"
  echo ""

  run_check "swift test" swift test

  if command_exists swiftlint; then
    run_check "swiftlint" swiftlint
  else
    echo "SKIP: swiftlint not installed"
  fi
fi

if [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "pytest.ini" ]; then
  echo "Detected: Python project"
  echo ""

  if command_exists pytest; then
    run_check "pytest" pytest
  else
    echo "SKIP: pytest not installed"
  fi

  if command_exists ruff; then
    run_check "ruff check" ruff check .
  elif command_exists flake8; then
    run_check "flake8" flake8
  else
    echo "SKIP: No Python linter found (ruff or flake8)"
  fi
fi

echo ""
echo "=== Summary ==="
echo "Checks run:$CHECKS_RUN"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "PRE-SHIP BLOCKED:$CHECKS_FAILED failed"
  exit 1
fi

echo "PRE-SHIP PASS: All checks passed. Ready to ship."
exit 0
