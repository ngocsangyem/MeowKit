#!/bin/sh
# pre-ship.sh — Run full test + lint + typecheck before shipping.
# Usage: pre-ship.sh [command]
# When registered as PreToolUse hook on Bash, $1 = the bash command.
# Only triggers on git commit/push commands. Exits 0 for everything else.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Load .claude/.env (each hook is a separate subprocess).
# The `[ -f ]` guard is load-bearing: `.` is a POSIX special builtin, so sourcing
# a MISSING file aborts the whole script — `2>/dev/null || true` does not catch
# it. That would kill this hook before the Gate 2 check below ever runs, and an
# aborted hook exits non-2, which is advisory: the ship would proceed unchecked.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
fi

# Phase 7 (260408): JSON-on-stdin parser; prefer $HOOK_COMMAND, fall back to $1.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
COMMAND="${HOOK_COMMAND:-$1}"

# ---------------------------------------------------------------------------
# Gate 2 structural check — safety-critical: NEVER skip regardless of profile.
# ---------------------------------------------------------------------------
# Placed ABOVE the fast-profile early-exit ON PURPOSE. gate-rules.md: Gate 2 has
# no exceptions, "even fast mode". A check that any profile can switch off is not
# a gate — and `fast` is exactly the profile under which someone is most tempted
# to ship unreviewed. The build/lint/test checks below stay profile-gated: those
# are speed trade-offs, this is not.
#
# Exits 2 (hard block) rather than 1: per this repo's hook contract, exit 1 is
# ADVISORY and the tool call proceeds — printing "BLOCKED" and shipping anyway.
GATE2_CHECK="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/gate2-check.sh"
if [ -f "$GATE2_CHECK" ]; then
  sh "$GATE2_CHECK" "$COMMAND" || exit 2
else
  # Missing checker = NOT a quiet pass. A broken install must not silently
  # downgrade to "no Gate 2 enforcement" — at a ship boundary that is
  # indistinguishable from a passing gate at the one moment it matters. On a ship
  # command, FAIL CLOSED (exit 2): a ship with no enforceable Gate 2 is exactly
  # what the gate exists to stop. Non-ship commands are none of this hook's
  # business and pass through untouched.
  case "$COMMAND" in
    *"git commit"*|*"git push"*|*"git merge"*)
      {
        echo "@@GATE_BLOCK@@"
        echo "Gate 2 checker $GATE2_CHECK not found — Gate 2 cannot be enforced."
        echo "A ship with no enforceable Gate 2 is blocked, not waved through."
        echo "Fix: reinstall or restore the hook library, then retry."
      } >&2
      exit 2
      ;;
  esac
fi

# Hook profile gating — skip pre-deploy checks in fast profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"
case "$MEOW_PROFILE" in
  fast) exit 0 ;;
esac

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
  # exit 2, NOT 1: per this repo's hook contract exit 1 is ADVISORY — it prints
  # "BLOCKED" and lets the ship proceed anyway. A failed pre-ship check must
  # actually stop the ship.
  echo "PRE-SHIP BLOCKED:$CHECKS_FAILED failed" >&2
  exit 2
fi

echo "PRE-SHIP PASS: All checks passed. Ready to ship."
exit 0
