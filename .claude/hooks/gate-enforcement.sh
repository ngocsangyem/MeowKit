#!/bin/bash
# MeowKit Gate Enforcement Hook
# PreToolUse: Block code writes before Gate 1 (plan approval) AND (Phase 4) before sprint contract sign.
# Upgrades gate-rules.md + Phase 4 sprint contract from behavioral to preventive.
#
# Matches: Edit, Write tool calls targeting source code files
# Blocks: if no approved plan in tasks/plans/ OR no signed contract in tasks/contracts/ AND target is source code
# Allows: plan files, test files, docs, config, contract files themselves, and any write after both gates pass
#
# Gate 1 bypass: /meow:fix --simple OR scale-routing one-shot
# Contract gate bypass: MEOWKIT_HARNESS_MODE=LEAN env var (adaptive density for COMPLEX/Opus 4.6)
#
# Phase 4 extension (260408): also validates contract files on edit so hand-edits cannot
# break the schema. Triggered when $1 matches tasks/contracts/*.md.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Hook profile gating — safety-critical: NEVER skip regardless of profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"

# settings.json matcher already filters to Edit|Write — no need to check tool name
# $1 = file path (positional convention preserved per meowkit-rules.md §3)
FILE_PATH="$1"

# If no file path provided, allow (safety fallback)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize the file path: strip leading $CLAUDE_PROJECT_DIR (or current pwd) so
# absolute paths get treated identically to relative paths in the matchers below.
# Closes red-team C1: case-glob `tasks/contracts/*.md` previously failed on abs paths.
NORMALIZED_PATH="$FILE_PATH"
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  case "$NORMALIZED_PATH" in
    "$CLAUDE_PROJECT_DIR"/*) NORMALIZED_PATH="${NORMALIZED_PATH#"$CLAUDE_PROJECT_DIR"/}" ;;
  esac
fi
# Also strip leading "./"
NORMALIZED_PATH="${NORMALIZED_PATH#./}"

# Phase 4 extension: contract files themselves get schema-validated on edit.
# Match both `tasks/contracts/foo.md` AND any path ending in that segment.
# Closes C1 (abs paths) and C2 (substring leak — anchor on segment boundaries).
case "$NORMALIZED_PATH" in
  tasks/contracts/*.md|*/tasks/contracts/*.md)
    validator=".claude/skills/meow:sprint-contract/scripts/validate-contract.sh"
    if [ -x "$validator" ]; then
      if ! "$validator" "$FILE_PATH" >/dev/null 2>&1; then
        echo "@@GATE_BLOCK@@"
        echo "Contract file $FILE_PATH failed schema validation."
        echo "Run for diagnostics: $validator $FILE_PATH"
        exit 1
      fi
    fi
    # Contract file edits are otherwise allowed (validator passed or not installed yet)
    exit 0
    ;;
esac

# Reject suspicious backup/legacy directories BEFORE any allow rule.
# Closes red-team C3+C4: `tasks/contracts.bak/foo.ts` and `tasks/contracts.bak/foo.md`
# previously bypassed the gate via substring or extension allowlists.
case "$NORMALIZED_PATH" in
  *.bak/*|*_legacy/*|*_old/*|*.tmp/*|*.backup/*)
    echo "@@GATE_BLOCK@@"
    echo "Suspicious backup/legacy directory in path: $NORMALIZED_PATH"
    echo "Move the file to a clean location or rename the parent directory."
    exit 1
    ;;
esac

# Allow writes to non-source files. Use anchored segment matchers to prevent
# substring leaks like `tasks/plansold/foo.ts` or `srctasks/plans/foo.ts`.
# (Round 1 closed C2 via case patterns; round 2 dropped the bare `plans/*` branch
# that was a residual substring-leak vector — canonical path is `tasks/plans/`.)
case "$NORMALIZED_PATH" in
  tasks/plans/*|*/tasks/plans/*) exit 0 ;;
  tasks/reviews/*|*/tasks/reviews/*) exit 0 ;;
  tasks/contracts/*|*/tasks/contracts/*) exit 0 ;;
  docs/*|*/docs/*) exit 0 ;;
  .claude/*|*/.claude/*) exit 0 ;;
esac

# Allow writes to test files (extension/path-marker checks).
# Note: blanket markdown/JSON/YAML allowlist DROPPED in round 2 (was C4 bypass vector).
# Root-level config files (README.md, package.json, etc.) are not pre-allowed —
# they fall through to Gate 1 check below, which is satisfied once a plan exists.
# This means: writing root configs requires Gate 1 first, which is the intended discipline.
case "$NORMALIZED_PATH" in
  *.test.*|*.spec.*|*/__tests__/*|*/test/*|*/tests/*) exit 0 ;;
esac

# Gate 1: check if any approved plan exists (directory structure: tasks/plans/YYMMDD-name/plan.md)
gate1_passed=0
if ls tasks/plans/*/plan.md 2>/dev/null | head -1 > /dev/null 2>&1; then
  gate1_passed=1
fi
# Also check flat file format for backward compatibility
if [ "$gate1_passed" -eq 0 ] && ls tasks/plans/*.md 2>/dev/null | head -1 > /dev/null 2>&1; then
  gate1_passed=1
fi

if [ "$gate1_passed" -eq 0 ]; then
  echo "@@GATE_BLOCK@@"
  echo "No approved plan found in tasks/plans/."
  echo "Gate 1 requires an approved plan before source code changes."
  echo "Create a plan first: /meow:plan-creator or /meow:fix for simple fixes."
  exit 1
fi

# Phase 4: Sprint contract gate. Only runs if a plan-creator-style date-prefixed plan dir exists
# (otherwise check-contract-signed.sh defers and exits 0 — no false blocks on legacy plans).
contract_check=".claude/skills/meow:sprint-contract/scripts/check-contract-signed.sh"
if [ -x "$contract_check" ]; then
  if ! "$contract_check"; then
    # check-contract-signed.sh already prints @@CONTRACT_GATE_BLOCK@@ + diagnostics on stderr
    exit 1
  fi
fi

exit 0
